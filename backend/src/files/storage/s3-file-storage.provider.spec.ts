import { randomUUID } from 'node:crypto';
import { S3FileStorageProvider } from './s3-file-storage.provider';

describe('S3FileStorageProvider', () => {
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;

  beforeAll(() => {
    process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
  });

  afterAll(() => {
    if (accessKey) process.env.AWS_ACCESS_KEY_ID = accessKey;
    else delete process.env.AWS_ACCESS_KEY_ID;
    if (secretKey) process.env.AWS_SECRET_ACCESS_KEY = secretKey;
    else delete process.env.AWS_SECRET_ACCESS_KEY;
  });

  it('creates a constrained, encrypted presigned POST without network access', async () => {
    const provider = new S3FileStorageProvider({
      region: 'us-east-1',
      bucket: 'nestship-test-files',
      forcePathStyle: false,
      malwareScanningEnabled: true,
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

    expect(target.url).toContain('nestship-test-files');
    expect(target.fields).toMatchObject({
      'Content-Type': 'application/pdf',
      'x-amz-server-side-encryption': 'AES256',
      'x-amz-tagging': 'nestship-state=pending',
    });
    expect(
      Object.keys(target.fields).some((key) => key.toLowerCase() === 'policy'),
    ).toBe(true);
    expect(target.fileField).toBe('file');
  });
});
