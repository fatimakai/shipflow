import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { OrganizationContext } from '../authorization/organization-context.service';
import { BillingEntitlementService } from '../billing/billing-entitlement.service';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import {
  FileMalwareStatus,
  FileStatus,
  FileStorageProvider,
} from '../generated/prisma/enums';
import {
  FILE_AUDIT_RETENTION_MS,
  FILE_FAILED_RETENTION_MS,
  FILE_MAX_ACTIVE_RESERVATIONS_PER_ORGANIZATION,
  FILE_MAX_ACTIVE_RESERVATIONS_PER_USER,
  FILE_PLAN_QUOTAS,
  FILE_RESERVATION_TTL_MS,
  FILE_SOFT_DELETE_RETENTION_MS,
  FILE_UPLOAD_URL_TTL_SECONDS,
} from './file.constants';
import { FileValidationService } from './file-validation.service';
import {
  InjectMalwareScanner,
  type MalwareScanner,
} from './malware/malware-scanner.types';
import type {
  FileListQueryDto,
  InitiateFileUploadDto,
} from './dto/file-request.dto';
import type {
  FileDownloadTargetResponseDto,
  FileListResponseDto,
  FileResponseDto,
  FileUploadReservationResponseDto,
  FileUsageResponseDto,
} from './dto/file-response.dto';
import {
  InjectFileStorage,
  type ObjectStorageProvider,
} from './storage/file-storage.types';

type FileWithUploader = Prisma.StoredFileGetPayload<{
  include: {
    uploadedBy: { select: { id: true; displayName: true } };
  };
}>;

const retainedFileStatuses = [
  FileStatus.SCANNING,
  FileStatus.READY,
  FileStatus.DELETED,
];

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: BillingEntitlementService,
    private readonly validation: FileValidationService,
    @InjectFileStorage() private readonly storage: ObjectStorageProvider,
    @InjectMalwareScanner() private readonly malwareScanner: MalwareScanner,
  ) {}

  async initiateUpload(
    context: OrganizationContext,
    userId: string,
    dto: InitiateFileUploadDto,
  ): Promise<FileUploadReservationResponseDto> {
    const declaration = this.validation.validateDeclaration(dto);
    const snapshot = await this.entitlements.getSnapshot(
      context.organization.id,
    );
    const quota = FILE_PLAN_QUOTAS[snapshot.plan.code];
    const id = randomUUID();
    const objectKey = `objects/${context.organization.id}/${id}`;
    const now = new Date();
    const reservationExpiresAt = new Date(
      now.getTime() + FILE_RESERVATION_TTL_MS,
    );

    const file = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${context.organization.id}, 0))::text`;
      const [usage, activeOrganizationReservations, activeUserReservations] =
        await Promise.all([
          transaction.storedFile.aggregate({
            where: {
              organizationId: context.organization.id,
              OR: [
                { status: { in: retainedFileStatuses } },
                {
                  status: FileStatus.PENDING,
                  reservationExpiresAt: { gt: now },
                },
              ],
            },
            _sum: { sizeBytes: true },
            _count: { _all: true },
          }),
          transaction.storedFile.count({
            where: {
              organizationId: context.organization.id,
              status: FileStatus.PENDING,
              reservationExpiresAt: { gt: now },
            },
          }),
          transaction.storedFile.count({
            where: {
              organizationId: context.organization.id,
              uploadedById: userId,
              status: FileStatus.PENDING,
              reservationExpiresAt: { gt: now },
            },
          }),
        ]);

      const usedBytes = usage._sum.sizeBytes ?? 0;
      const usedFiles = usage._count._all;
      if (
        usedBytes + dto.sizeBytes > quota.maxBytes ||
        usedFiles + 1 > quota.maxFiles
      ) {
        throw new ConflictException(
          'Organization file storage quota would be exceeded',
        );
      }
      if (
        activeOrganizationReservations >=
          FILE_MAX_ACTIVE_RESERVATIONS_PER_ORGANIZATION ||
        activeUserReservations >= FILE_MAX_ACTIVE_RESERVATIONS_PER_USER
      ) {
        throw new ConflictException('Too many active file upload reservations');
      }

      return transaction.storedFile.create({
        data: {
          id,
          organizationId: context.organization.id,
          uploadedById: userId,
          storageProvider: this.storage.provider,
          objectKey,
          originalName: declaration.fileName,
          declaredMimeType: declaration.mimeType,
          sizeBytes: dto.sizeBytes,
          checksumSha256: dto.checksumSha256,
          malwareStatus: this.malwareScanner.enabled
            ? FileMalwareStatus.PENDING
            : FileMalwareStatus.NOT_REQUIRED,
          reservationExpiresAt,
        },
        include: {
          uploadedBy: { select: { id: true, displayName: true } },
        },
      });
    });

    try {
      const upload = await this.storage.createUploadTarget({
        key: file.objectKey,
        uploadPath: `/api/v1/file-content/${file.id}`,
        contentType: file.declaredMimeType,
        sizeBytes: file.sizeBytes,
        checksumSha256: file.checksumSha256,
        organizationId: file.organizationId,
        fileId: file.id,
        expiresAt: new Date(Date.now() + FILE_UPLOAD_URL_TTL_SECONDS * 1000),
      });
      return { file: this.mapFile(file), upload };
    } catch {
      await this.prisma.storedFile.update({
        where: { id: file.id },
        data: {
          status: FileStatus.FAILED,
          purgeAfter: new Date(),
          lastLifecycleError: 'Failed to create an upload target',
        },
      });
      throw new ServiceUnavailableException(
        'File storage is temporarily unavailable',
      );
    }
  }

  async completeUpload(
    organizationId: string,
    fileId: string,
  ): Promise<FileResponseDto> {
    const file = await this.findScopedFile(organizationId, fileId);
    if (
      file.status === FileStatus.READY ||
      file.status === FileStatus.SCANNING
    ) {
      return this.mapFile(file);
    }
    if (file.status !== FileStatus.PENDING) {
      throw new ConflictException(
        'File upload cannot be completed in its current state',
      );
    }
    if (file.reservationExpiresAt.getTime() <= Date.now()) {
      throw new ConflictException('File upload reservation has expired');
    }

    let object;
    try {
      object = await this.storage.inspectObject(file.objectKey);
    } catch {
      throw new BadRequestException('Uploaded object was not found');
    }

    let validated: { detectedMimeType: string; checksumSha256: string };
    try {
      if (object.contentType && object.contentType !== file.declaredMimeType) {
        throw new BadRequestException(
          'Uploaded file content type does not match',
        );
      }
      validated = this.validation.validateObject({
        body: object.body,
        fileName: file.originalName,
        declaredMimeType: file.declaredMimeType,
        declaredSizeBytes: file.sizeBytes,
        checksumSha256: file.checksumSha256,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.slice(0, 500)
          : 'File validation failed';
      await this.prisma.storedFile.update({
        where: { id: file.id },
        data: {
          status: FileStatus.REJECTED,
          malwareStatus: FileMalwareStatus.UNSUPPORTED,
          uploadedAt: new Date(),
          purgeAfter: new Date(Date.now() + FILE_FAILED_RETENTION_MS),
          lastLifecycleError: message,
        },
      });
      await this.syncLifecycleState(file.id, file.objectKey, 'rejected');
      throw error;
    }

    const uploadedAt = new Date();
    const ready = !this.malwareScanner.enabled;
    const updated = await this.prisma.storedFile.update({
      where: { id: file.id },
      data: {
        detectedMimeType: validated.detectedMimeType,
        uploadedAt,
        status: ready ? FileStatus.READY : FileStatus.SCANNING,
        malwareStatus: ready
          ? FileMalwareStatus.NOT_REQUIRED
          : FileMalwareStatus.PENDING,
        scanCompletedAt: ready ? uploadedAt : null,
        lastLifecycleError: null,
      },
      include: {
        uploadedBy: { select: { id: true, displayName: true } },
      },
    });
    await this.syncLifecycleState(
      file.id,
      file.objectKey,
      ready ? 'ready' : 'scanning',
    );
    return this.mapFile(updated);
  }

  async listFiles(
    organizationId: string,
    query: FileListQueryDto,
  ): Promise<FileListResponseDto> {
    const where: Prisma.StoredFileWhereInput = {
      organizationId,
      status: query.status ?? {
        in: [FileStatus.PENDING, FileStatus.SCANNING, FileStatus.READY],
      },
    };
    const [files, total] = await Promise.all([
      this.prisma.storedFile.findMany({
        where,
        include: { uploadedBy: { select: { id: true, displayName: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.storedFile.count({ where }),
    ]);
    return {
      items: files.map((file) => this.mapFile(file)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      },
    };
  }

  async getFile(
    organizationId: string,
    fileId: string,
  ): Promise<FileResponseDto> {
    return this.mapFile(await this.findScopedFile(organizationId, fileId));
  }

  async getUsage(organizationId: string): Promise<FileUsageResponseDto> {
    const [snapshot, usage] = await Promise.all([
      this.entitlements.getSnapshot(organizationId),
      this.prisma.storedFile.aggregate({
        where: {
          organizationId,
          OR: [
            { status: { in: retainedFileStatuses } },
            {
              status: FileStatus.PENDING,
              reservationExpiresAt: { gt: new Date() },
            },
          ],
        },
        _sum: { sizeBytes: true },
        _count: { _all: true },
      }),
    ]);
    const quota = FILE_PLAN_QUOTAS[snapshot.plan.code];
    return {
      usedBytes: usage._sum.sizeBytes ?? 0,
      maxBytes: quota.maxBytes,
      usedFiles: usage._count._all,
      maxFiles: quota.maxFiles,
    };
  }

  async createDownloadTarget(
    organizationId: string,
    fileId: string,
  ): Promise<FileDownloadTargetResponseDto> {
    const file = await this.findScopedFile(organizationId, fileId);
    if (file.status !== FileStatus.READY) {
      throw new ConflictException('File is not ready for download');
    }
    return this.storage.createDownloadTarget(
      file.objectKey,
      `/api/v1/file-content/${file.id}`,
      file.originalName,
      file.detectedMimeType ?? file.declaredMimeType,
    );
  }

  async deleteFile(
    organizationId: string,
    fileId: string,
  ): Promise<FileResponseDto> {
    const file = await this.findScopedFile(organizationId, fileId);
    if (file.status === FileStatus.DELETED) return this.mapFile(file);
    if (file.status === FileStatus.PENDING) {
      await this.storage.deleteObject(file.objectKey);
      const now = new Date();
      const purged = await this.prisma.storedFile.update({
        where: { id: file.id },
        data: {
          status: FileStatus.PURGED,
          purgedAt: now,
          auditExpiresAt: new Date(now.getTime() + FILE_AUDIT_RETENTION_MS),
        },
        include: { uploadedBy: { select: { id: true, displayName: true } } },
      });
      return this.mapFile(purged);
    }
    if (
      file.status !== FileStatus.READY &&
      file.status !== FileStatus.SCANNING
    ) {
      throw new ConflictException(
        'File cannot be deleted in its current state',
      );
    }
    const now = new Date();
    const deleted = await this.prisma.storedFile.update({
      where: { id: file.id },
      data: {
        status: FileStatus.DELETED,
        deletedAt: now,
        purgeAfter: new Date(now.getTime() + FILE_SOFT_DELETE_RETENTION_MS),
      },
      include: { uploadedBy: { select: { id: true, displayName: true } } },
    });
    await this.syncLifecycleState(file.id, file.objectKey, 'deleted');
    return this.mapFile(deleted);
  }

  async restoreFile(
    organizationId: string,
    fileId: string,
  ): Promise<FileResponseDto> {
    const file = await this.findScopedFile(organizationId, fileId);
    if (file.status !== FileStatus.DELETED || !file.purgeAfter) {
      throw new ConflictException('File is not recoverable');
    }
    if (file.purgeAfter.getTime() <= Date.now()) {
      throw new ConflictException('File recovery period has expired');
    }
    const status =
      file.malwareStatus === FileMalwareStatus.PENDING
        ? FileStatus.SCANNING
        : FileStatus.READY;
    const restored = await this.prisma.storedFile.update({
      where: { id: file.id },
      data: { status, deletedAt: null, purgeAfter: null },
      include: { uploadedBy: { select: { id: true, displayName: true } } },
    });
    await this.syncLifecycleState(
      file.id,
      file.objectKey,
      status === FileStatus.READY ? 'ready' : 'scanning',
    );
    return this.mapFile(restored);
  }

  async storeLocalUpload(
    fileId: string,
    expires: number,
    signature: string,
    upload: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<void> {
    if (this.storage.provider !== FileStorageProvider.LOCAL) {
      throw new NotFoundException('Local file upload endpoint is unavailable');
    }
    const file = await this.findLocalFile(fileId);
    if (
      !this.storage.verifyLocalSignature(
        'upload',
        file.objectKey,
        expires,
        signature,
      )
    ) {
      throw new BadRequestException('Signed upload URL is invalid or expired');
    }
    if (
      file.status !== FileStatus.PENDING ||
      file.reservationExpiresAt < new Date()
    ) {
      throw new ConflictException(
        'File upload reservation is no longer active',
      );
    }
    if (
      upload.mimetype !== file.declaredMimeType ||
      upload.size !== file.sizeBytes
    ) {
      throw new BadRequestException(
        'Uploaded file metadata does not match the reservation',
      );
    }
    this.validation.validateObject({
      body: upload.buffer,
      fileName: file.originalName,
      declaredMimeType: file.declaredMimeType,
      declaredSizeBytes: file.sizeBytes,
      checksumSha256: file.checksumSha256,
    });
    await this.storage.putObject(
      file.objectKey,
      upload.buffer,
      file.declaredMimeType,
    );
  }

  async readLocalDownload(
    fileId: string,
    expires: number,
    signature: string,
  ): Promise<{ body: Buffer; fileName: string; contentType: string }> {
    if (this.storage.provider !== FileStorageProvider.LOCAL) {
      throw new NotFoundException(
        'Local file download endpoint is unavailable',
      );
    }
    const file = await this.findLocalFile(fileId);
    if (
      !this.storage.verifyLocalSignature(
        'download',
        file.objectKey,
        expires,
        signature,
      )
    ) {
      throw new BadRequestException(
        'Signed download URL is invalid or expired',
      );
    }
    if (file.status !== FileStatus.READY) {
      throw new NotFoundException('File not found');
    }
    const object = await this.storage.inspectObject(file.objectKey);
    return {
      body: object.body,
      fileName: file.originalName,
      contentType: file.detectedMimeType ?? file.declaredMimeType,
    };
  }

  private async findScopedFile(
    organizationId: string,
    fileId: string,
  ): Promise<FileWithUploader> {
    const file = await this.prisma.storedFile.findFirst({
      where: {
        id: fileId,
        organizationId,
        status: { not: FileStatus.PURGED },
      },
      include: { uploadedBy: { select: { id: true, displayName: true } } },
    });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  private async findLocalFile(fileId: string) {
    const file = await this.prisma.storedFile.findFirst({
      where: { id: fileId, storageProvider: FileStorageProvider.LOCAL },
    });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  private mapFile(file: FileWithUploader): FileResponseDto {
    return {
      id: file.id,
      organizationId: file.organizationId,
      originalName: file.originalName,
      mimeType: file.detectedMimeType ?? file.declaredMimeType,
      sizeBytes: file.sizeBytes,
      status: file.status,
      malwareStatus: file.malwareStatus,
      storageProvider: file.storageProvider,
      uploadedBy: file.uploadedBy,
      uploadedAt: file.uploadedAt,
      deletedAt: file.deletedAt,
      createdAt: file.createdAt,
    };
  }

  private async syncLifecycleState(
    fileId: string,
    objectKey: string,
    state: 'pending' | 'scanning' | 'ready' | 'deleted' | 'rejected',
  ): Promise<void> {
    try {
      await this.storage.setLifecycleState(objectKey, state);
    } catch {
      await this.prisma.storedFile.update({
        where: { id: fileId },
        data: {
          lastLifecycleError: 'Object lifecycle tag update will be retried',
        },
      });
    }
  }
}
