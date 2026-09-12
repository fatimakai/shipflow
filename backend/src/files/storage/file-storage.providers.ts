import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation';
import { LocalFileStorageProvider } from './local-file-storage.provider';
import { S3FileStorageProvider } from './s3-file-storage.provider';
import type { ObjectStorageProvider } from './file-storage.types';

export function createFileStorageProvider(
  config: ConfigService<EnvironmentVariables, true>,
): ObjectStorageProvider {
  if (config.getOrThrow('FILE_STORAGE_PROVIDER') === 's3') {
    return new S3FileStorageProvider({
      region: config.getOrThrow('AWS_REGION'),
      bucket: config.getOrThrow('S3_BUCKET'),
      endpoint: config.get('S3_ENDPOINT'),
      forcePathStyle: config.getOrThrow('S3_FORCE_PATH_STYLE'),
      accessKeyId: config.getOrThrow('AWS_ACCESS_KEY_ID'),
      secretAccessKey: config.getOrThrow('AWS_SECRET_ACCESS_KEY'),
    });
  }

  return new LocalFileStorageProvider(
    config.getOrThrow('FILE_LOCAL_ROOT'),
    config.getOrThrow('JWT_ACCESS_SECRET'),
  );
}
