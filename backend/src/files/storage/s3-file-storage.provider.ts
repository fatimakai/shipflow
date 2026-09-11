import {
  DeleteObjectCommand,
  GetObjectCommand,
  GetObjectTaggingCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  PutObjectTaggingCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { FileStorageProvider } from '../../generated/prisma/enums';
import { FILE_DOWNLOAD_URL_TTL_SECONDS } from '../file.constants';
import type {
  CreateUploadTargetInput,
  FileDownloadTarget,
  FileUploadTarget,
  ObjectStorageProvider,
  ProviderMalwareResult,
  StoredObject,
  StoredObjectReference,
} from './file-storage.types';

interface S3FileStorageOptions {
  region: string;
  bucket: string;
  endpoint?: string;
  forcePathStyle: boolean;
  malwareScanningEnabled: boolean;
}

export class S3FileStorageProvider implements ObjectStorageProvider {
  readonly provider = FileStorageProvider.S3;
  readonly malwareScanningEnabled: boolean;
  private readonly client: S3Client;

  constructor(private readonly options: S3FileStorageOptions) {
    this.malwareScanningEnabled = options.malwareScanningEnabled;
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle,
    });
  }

  async createUploadTarget(
    input: CreateUploadTargetInput,
  ): Promise<FileUploadTarget> {
    const checksum = Buffer.from(input.checksumSha256, 'hex').toString(
      'base64',
    );
    const expires = Math.max(
      1,
      Math.floor((input.expiresAt.getTime() - Date.now()) / 1000),
    );
    const fields = {
      'Content-Type': input.contentType,
      'x-amz-server-side-encryption': 'AES256',
      'x-amz-checksum-sha256': checksum,
      'x-amz-meta-file-id': input.fileId,
      'x-amz-meta-organization-id': input.organizationId,
      'x-amz-tagging': 'shipflow-state=pending',
    };
    const result = await createPresignedPost(this.client, {
      Bucket: this.options.bucket,
      Key: input.key,
      Expires: expires,
      Fields: fields,
      Conditions: [
        ['content-length-range', input.sizeBytes, input.sizeBytes],
        ['eq', '$Content-Type', input.contentType],
        ['eq', '$x-amz-checksum-sha256', checksum],
        ['eq', '$x-amz-server-side-encryption', 'AES256'],
      ],
    });
    return {
      method: 'POST',
      url: result.url,
      fields: result.fields,
      fileField: 'file',
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

  async getMalwareResult(key: string): Promise<ProviderMalwareResult> {
    if (!this.malwareScanningEnabled) return 'clean';
    const result = await this.client.send(
      new GetObjectTaggingCommand({ Bucket: this.options.bucket, Key: key }),
    );
    const status = result.TagSet?.find(
      (tag) => tag.Key === 'GuardDutyMalwareScanStatus',
    )?.Value;
    return (
      ({
        NO_THREATS_FOUND: 'clean',
        THREATS_FOUND: 'infected',
        UNSUPPORTED: 'unsupported',
        ACCESS_DENIED: 'failed',
        FAILED: 'failed',
      }[status ?? ''] as ProviderMalwareResult | undefined) ?? 'pending'
    );
  }

  async setLifecycleState(
    key: string,
    state: 'pending' | 'scanning' | 'ready' | 'deleted' | 'rejected',
  ): Promise<void> {
    const existing = await this.client.send(
      new GetObjectTaggingCommand({ Bucket: this.options.bucket, Key: key }),
    );
    const tagSet = (existing.TagSet ?? []).filter(
      (tag) => tag.Key !== 'shipflow-state',
    );
    tagSet.push({ Key: 'shipflow-state', Value: state });
    await this.client.send(
      new PutObjectTaggingCommand({
        Bucket: this.options.bucket,
        Key: key,
        Tagging: { TagSet: tagSet },
      }),
    );
  }
}
