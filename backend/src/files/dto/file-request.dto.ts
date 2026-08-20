import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FileStatus } from '../../generated/prisma/enums';
import {
  ACCEPTED_FILE_MIME_TYPES,
  FILE_MAX_SIZE_BYTES,
} from '../file.constants';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const visibleFileStatuses = [
  FileStatus.PENDING,
  FileStatus.SCANNING,
  FileStatus.READY,
  FileStatus.DELETED,
  FileStatus.REJECTED,
  FileStatus.FAILED,
] as const;

export class InitiateFileUploadDto {
  @ApiProperty({ example: 'quarterly-report.pdf', maxLength: 255 })
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ enum: [...new Set(Object.values(ACCEPTED_FILE_MIME_TYPES))] })
  @Transform(trim)
  @IsIn(Object.values(ACCEPTED_FILE_MIME_TYPES))
  mimeType!: string;

  @ApiProperty({ minimum: 1, maximum: FILE_MAX_SIZE_BYTES })
  @IsInt()
  @Min(1)
  @Max(FILE_MAX_SIZE_BYTES)
  sizeBytes!: number;

  @ApiProperty({ pattern: '^[0-9a-f]{64}$' })
  @Transform(trim)
  @Matches(/^[0-9a-f]{64}$/)
  checksumSha256!: string;
}

export class FileListQueryDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 20 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ enum: visibleFileStatuses })
  @IsOptional()
  @IsIn(visibleFileStatuses)
  status?: FileStatus;
}

export class SignedFileRequestQueryDto {
  @ApiProperty({ type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expires!: number;

  @ApiProperty({ pattern: '^[0-9a-f]{64}$' })
  @Matches(/^[0-9a-f]{64}$/)
  signature!: string;
}
