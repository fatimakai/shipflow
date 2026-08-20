import { ApiProperty } from '@nestjs/swagger';
import {
  FileMalwareStatus,
  FileStatus,
  FileStorageProvider,
} from '../../generated/prisma/enums';

export class FileUploaderResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  displayName!: string | null;
}

export class FileResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty()
  originalName!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty({ minimum: 1 })
  sizeBytes!: number;

  @ApiProperty({ enum: FileStatus })
  status!: FileStatus;

  @ApiProperty({ enum: FileMalwareStatus })
  malwareStatus!: FileMalwareStatus;

  @ApiProperty({ enum: FileStorageProvider })
  storageProvider!: FileStorageProvider;

  @ApiProperty({ type: FileUploaderResponseDto })
  uploadedBy!: FileUploaderResponseDto;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  uploadedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  deletedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class FileUploadTargetResponseDto {
  @ApiProperty({ enum: ['POST'] })
  method!: 'POST';

  @ApiProperty()
  url!: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  fields!: Record<string, string>;

  @ApiProperty({ enum: ['file'] })
  fileField!: 'file';

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: Date;
}

export class FileUploadReservationResponseDto {
  @ApiProperty({ type: FileResponseDto })
  file!: FileResponseDto;

  @ApiProperty({ type: FileUploadTargetResponseDto })
  upload!: FileUploadTargetResponseDto;
}

export class FileDownloadTargetResponseDto {
  @ApiProperty({ enum: ['GET'] })
  method!: 'GET';

  @ApiProperty()
  url!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: Date;
}

export class FilePaginationMetaResponseDto {
  @ApiProperty({ type: Number, minimum: 1 })
  page!: number;

  @ApiProperty({ type: Number, minimum: 1 })
  limit!: number;

  @ApiProperty({ type: Number, minimum: 0 })
  total!: number;

  @ApiProperty({ type: Number, minimum: 0 })
  totalPages!: number;
}

export class FileListResponseDto {
  @ApiProperty({ type: [FileResponseDto] })
  items!: FileResponseDto[];

  @ApiProperty({ type: FilePaginationMetaResponseDto })
  pagination!: FilePaginationMetaResponseDto;
}

export class FileUsageResponseDto {
  @ApiProperty()
  usedBytes!: number;

  @ApiProperty()
  maxBytes!: number;

  @ApiProperty()
  usedFiles!: number;

  @ApiProperty()
  maxFiles!: number;
}
