import { createHash, randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import { TokenService } from '../src/auth/token.service';
import { EnvironmentVariables } from '../src/config/env.validation';
import { PrismaService } from '../src/database/prisma.service';
import { FileMaintenanceService } from '../src/files/file-maintenance.service';
import {
  FileMalwareStatus,
  FileStatus,
  MembershipRole,
} from '../src/generated/prisma/enums';

interface FileBody {
  id: string;
  organizationId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: FileStatus;
  malwareStatus: FileMalwareStatus;
  deletedAt: string | null;
}

interface UploadReservationBody {
  file: FileBody;
  upload: {
    method: 'POST';
    url: string;
    fields: Record<string, string>;
    headers: Record<string, string>;
    fileField?: 'file';
    expiresAt: string;
  };
}

describe('File storage backend (e2e)', () => {
  const marker = randomUUID();
  const localRoot = resolve('.data', `files-e2e-${marker}`);
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: TokenService;
  let maintenance: FileMaintenanceService;
  let organizationId: string;
  let owner: { id: string; email: string };
  let member: { id: string; email: string };
  let viewer: { id: string; email: string };
  let outsider: { id: string; email: string };
  let ownerToken: string;
  let memberToken: string;
  let viewerToken: string;
  let outsiderToken: string;

  beforeAll(async () => {
    process.env.FILE_STORAGE_PROVIDER = 'local';
    process.env.FILE_LOCAL_ROOT = localRoot;
    process.env.FILE_MALWARE_SCAN_ENABLED = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication({ rawBody: true });
    configureApplication(
      app,
      app.get(ConfigService<EnvironmentVariables, true>),
    );
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);
    maintenance = app.get(FileMaintenanceService);

    [owner, member, viewer, outsider] = await Promise.all([
      createUser('owner'),
      createUser('member'),
      createUser('viewer'),
      createUser('outsider'),
    ]);
    const organization = await prisma.organization.create({
      data: {
        name: `Files Tenant ${marker}`,
        slug: `files-${marker}`,
        ownerId: owner.id,
        memberships: {
          create: [
            { userId: owner.id, role: MembershipRole.OWNER },
            { userId: member.id, role: MembershipRole.MEMBER },
            { userId: viewer.id, role: MembershipRole.VIEWER },
          ],
        },
      },
    });
    organizationId = organization.id;
    [ownerToken, memberToken, viewerToken, outsiderToken] = await Promise.all([
      tokens.signAccessToken(owner),
      tokens.signAccessToken(member),
      tokens.signAccessToken(viewer),
      tokens.signAccessToken(outsider),
    ]);
  });

  it('enforces upload permissions, tenant isolation, and private file lifecycle', async () => {
    const body = Buffer.from('%PDF-1.7\nShipFlow private file test');
    const requestBody = {
      fileName: 'private-report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: body.length,
      checksumSha256: createHash('sha256').update(body).digest('hex'),
    };

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/files/uploads`)
      .auth(viewerToken, { type: 'bearer' })
      .send(requestBody)
      .expect(403);

    const reservationResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/files/uploads`)
      .auth(memberToken, { type: 'bearer' })
      .send(requestBody)
      .expect(201);
    const reservation = reservationResponse.body as UploadReservationBody;
    expect(reservation.file).toMatchObject({
      originalName: requestBody.fileName,
      status: FileStatus.PENDING,
      malwareStatus: FileMalwareStatus.NOT_REQUIRED,
    });
    expect(reservation.upload).toMatchObject({
      method: 'POST',
      fields: {},
      headers: {},
      fileField: 'file',
    });

    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationId}/files/${reservation.file.id}/complete`,
      )
      .auth(outsiderToken, { type: 'bearer' })
      .expect(404);

    await request(app.getHttpServer())
      .post(reservation.upload.url)
      .attach('file', body, {
        filename: requestBody.fileName,
        contentType: requestBody.mimeType,
      })
      .expect(204);

    const completedResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationId}/files/${reservation.file.id}/complete`,
      )
      .auth(memberToken, { type: 'bearer' })
      .expect(200);
    expect(completedResponse.body).toMatchObject({
      id: reservation.file.id,
      status: FileStatus.READY,
      malwareStatus: FileMalwareStatus.NOT_REQUIRED,
    });

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/files`)
      .auth(viewerToken, { type: 'bearer' })
      .expect(200)
      .expect((response) => {
        expect((response.body as { items: FileBody[] }).items).toHaveLength(1);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/files/usage`)
      .auth(ownerToken, { type: 'bearer' })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          usedBytes: body.length,
          maxBytes: 100 * 1024 * 1024,
          usedFiles: 1,
          maxFiles: 100,
        });
      });

    const downloadTargetResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/organizations/${organizationId}/files/${reservation.file.id}/download-url`,
      )
      .auth(viewerToken, { type: 'bearer' })
      .expect(200);
    const downloadTarget = downloadTargetResponse.body as {
      method: 'GET';
      url: string;
    };
    const downloadResponse = await request(app.getHttpServer())
      .get(downloadTarget.url)
      .expect(200)
      .expect('content-type', /application\/pdf/);
    expect(downloadResponse.body).toEqual(body);

    await request(app.getHttpServer())
      .delete(
        `/api/v1/organizations/${organizationId}/files/${reservation.file.id}`,
      )
      .auth(viewerToken, { type: 'bearer' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(
        `/api/v1/organizations/${organizationId}/files/${reservation.file.id}`,
      )
      .auth(memberToken, { type: 'bearer' })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ status: FileStatus.DELETED });
      });

    await request(app.getHttpServer())
      .get(
        `/api/v1/organizations/${organizationId}/files/${reservation.file.id}/download-url`,
      )
      .auth(ownerToken, { type: 'bearer' })
      .expect(409);

    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationId}/files/${reservation.file.id}/restore`,
      )
      .auth(memberToken, { type: 'bearer' })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          status: FileStatus.READY,
          deletedAt: null,
        });
      });
  });

  it('rejects unsupported declarations and cleans stale reservations', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/files/uploads`)
      .auth(memberToken, { type: 'bearer' })
      .send({
        fileName: 'active.svg',
        mimeType: 'image/svg+xml',
        sizeBytes: 20,
        checksumSha256: '0'.repeat(64),
      })
      .expect(400);

    const body = Buffer.from('stale text');
    const response = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/files/uploads`)
      .auth(memberToken, { type: 'bearer' })
      .send({
        fileName: 'stale.txt',
        mimeType: 'text/plain',
        sizeBytes: body.length,
        checksumSha256: createHash('sha256').update(body).digest('hex'),
      })
      .expect(201);
    const reservation = response.body as UploadReservationBody;
    await prisma.storedFile.update({
      where: { id: reservation.file.id },
      data: { reservationExpiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    });

    await maintenance.maintain();
    const staleFile = await prisma.storedFile.findUniqueOrThrow({
      where: { id: reservation.file.id },
      select: { status: true, purgedAt: true },
    });
    expect(staleFile.status).toBe(FileStatus.PURGED);
    expect(staleFile.purgedAt).toBeInstanceOf(Date);
  });

  it('publishes typed file transfer and pagination schemas', async () => {
    await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200)
      .expect((response) => {
        const document = response.body as {
          components: {
            schemas: Record<
              string,
              {
                required?: string[];
                properties?: Record<
                  string,
                  { format?: string; type?: string; $ref?: string }
                >;
              }
            >;
          };
        };
        expect(
          document.components.schemas.FileUploaderResponseDto.properties
            ?.displayName?.type,
        ).toBe('string');
        expect(
          document.components.schemas.FileResponseDto.properties?.uploadedAt
            ?.format,
        ).toBe('date-time');
        expect(document.components.schemas.FileResponseDto.required).toEqual(
          expect.arrayContaining(['uploadedAt', 'deletedAt']),
        );
        expect(
          document.components.schemas.FileUploadTargetResponseDto.properties
            ?.expiresAt?.format,
        ).toBe('date-time');
        expect(
          document.components.schemas.FileListResponseDto.properties?.pagination
            ?.$ref,
        ).toContain('FilePaginationMetaResponseDto');
        expect(
          document.components.schemas.FilePaginationMetaResponseDto.properties
            ?.page?.type,
        ).toBe('number');
      });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { email: { contains: marker } } });
    await app.close();
    await rm(localRoot, { recursive: true, force: true });
    delete process.env.FILE_STORAGE_PROVIDER;
    delete process.env.FILE_LOCAL_ROOT;
    delete process.env.FILE_MALWARE_SCAN_ENABLED;
  });

  function createUser(label: string) {
    return prisma.user.create({
      data: { email: `file-${label}-${marker}@example.test` },
      select: { id: true, email: true },
    });
  }
});
