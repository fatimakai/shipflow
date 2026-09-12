import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { FileStorageProvider } from '../../generated/prisma/enums';
import { FILE_DOWNLOAD_URL_TTL_SECONDS } from '../file.constants';
import type {
  CreateUploadTargetInput,
  FileDownloadTarget,
  FileUploadTarget,
  ObjectStorageProvider,
  StoredObject,
  StoredObjectReference,
} from './file-storage.types';

interface S3FileStorageOptions {
  region: string;
  bucket: string;
  endpoint?: string;
  forcePathStyle: boolean;
  accessKeyId: string;
  secretAccessKey: string;
}

export class S3FileStorageProvider implements ObjectStorageProvider {
  readonly provider = FileStorageProvider.S3;
  private readonly client: S3Client;

  constructor(private readonly options: S3FileStorageOptions) {
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
  }

  async createUploadTarget(
    input: CreateUploadTargetInput,
  ): Promise<FileUploadTarget> {
    const expires = Math.max(
      1,
      Math.floor((input.expiresAt.getTime() - Date.now()) / 1000),
    );
    const headers = {
      'Content-Type': input.contentType,
    };
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: input.key,
        ContentLength: input.sizeBytes,
        ContentType: input.contentType,
        Metadata: {
          'file-id': input.fileId,
          'organization-id': input.organizationId,
          'checksum-sha256': input.checksumSha256,
          'size-bytes': String(input.sizeBytes),
        },
      }),
      {
        expiresIn: expires,
        signableHeaders: new Set(['content-type']),
      },
    );
    return {
      method: 'PUT',
      url,
      fields: {},
      headers,
      expiresAt: input.expiresAt,
    };
  }

  verifyLocalSignature(): boolean {
    return false;
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async inspectObject(key: string): Promise<StoredObject> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.options.bucket, Key: key }),
    );
    if (!result.Body) throw new Error('S3 returned an object without a body');
    const body = Buffer.from(await result.Body.transformToByteArray());
    return {
      body,
      sizeBytes: result.ContentLength ?? body.length,
      contentType: result.ContentType ?? null,
    };
  }

  async createDownloadTarget(
    key: string,
    _downloadPath: string,
    fileName: string,
    contentType: string,
  ): Promise<FileDownloadTarget> {
    const expiresAt = new Date(
      Date.now() + FILE_DOWNLOAD_URL_TTL_SECONDS * 1000,
    );
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        ResponseContentType: contentType,
        ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      }),
      { expiresIn: FILE_DOWNLOAD_URL_TTL_SECONDS },
    );
    return { method: 'GET', url, expiresAt };
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key }),
    );
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.options.bucket, Key: key }),
      );
      return true;
    } catch (error) {
      const metadata = (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata;
      if (metadata?.httpStatusCode === 404) return false;
      throw error;
    }
  }

  async listObjects(prefix: string): Promise<StoredObjectReference[]> {
    const objects: StoredObjectReference[] = [];
    let continuationToken: string | undefined;
    do {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.options.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const item of result.Contents ?? []) {
        if (item.Key) {
          objects.push({
            key: item.Key,
            lastModified: item.LastModified ?? null,
          });
        }
      }
      continuationToken = result.IsTruncated
        ? result.NextContinuationToken
        : undefined;
    } while (continuationToken);
    return objects;
  }

  setLifecycleState(): Promise<void> {
    // R2 does not implement S3 object tagging. The database is the authoritative
    // lifecycle ledger, so compatible object stores do not need remote tags.
    return Promise.resolve();
  }
}
