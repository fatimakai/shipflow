import { randomUUID } from 'node:crypto';
import { S3FileStorageProvider } from './s3-file-storage.provider';

describe('S3FileStorageProvider', () => {
  it('creates an R2-compatible presigned PUT without network access', async () => {
    const provider = new S3FileStorageProvider({
      region: 'us-east-1',
      bucket: 'shipflow-test-files',
      forcePathStyle: false,
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
    });
    const target = await provider.createUploadTarget({
      key: `objects/${randomUUID()}/${randomUUID()}`,
      uploadPath: '/unused',
      contentType: 'application/pdf',
      sizeBytes: 128,
      checksumSha256: 'a'.repeat(64),
      organizationId: randomUUID(),
      fileId: randomUUID(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    expect(target.url).toContain('shipflow-test-files');
    expect(target).toMatchObject({
      method: 'PUT',
      fields: {},
    });
    expect(target.fileField).toBeUndefined();
    expect(target.headers).toEqual({ 'Content-Type': 'application/pdf' });
    expect(target.url).toContain(
      `x-amz-meta-checksum-sha256=${'a'.repeat(64)}`,
    );
    expect(target.url).toContain(
      'X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost',
    );
    expect(target.url).not.toContain('x-amz-sdk-checksum-algorithm');
  });
});
