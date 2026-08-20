import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFileStorageProvider } from './local-file-storage.provider';

describe('LocalFileStorageProvider', () => {
  let root: string;
  let provider: LocalFileStorageProvider;
  let key: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'nestship-file-provider-'));
    provider = new LocalFileStorageProvider(root, 'test-signing-secret');
    key = `objects/${randomUUID()}/${randomUUID()}`;
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('creates expiring signed targets and stores private objects', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const target = await provider.createUploadTarget({
      key,
      uploadPath: '/api/v1/file-content/id',
      contentType: 'application/json',
      sizeBytes: 2,
      checksumSha256: '0'.repeat(64),
      organizationId: randomUUID(),
      fileId: randomUUID(),
      expiresAt,
    });
    const url = new URL(target.url, 'http://localhost');
    expect(
      provider.verifyLocalSignature(
        'upload',
        key,
        Number(url.searchParams.get('expires')),
        url.searchParams.get('signature')!,
      ),
    ).toBe(true);
    expect(target.fileField).toBe('file');

    await provider.putObject(key, Buffer.from('{}'), 'application/json');
    await expect(provider.objectExists(key)).resolves.toBe(true);
    await expect(provider.inspectObject(key)).resolves.toMatchObject({
      body: Buffer.from('{}'),
      sizeBytes: 2,
    });
    await expect(provider.listObjects('objects')).resolves.toEqual([
      expect.objectContaining({ key }),
    ]);

    const download = await provider.createDownloadTarget(
      key,
      '/api/v1/file-content/id',
      'data.json',
      'application/json',
    );
    expect(download.url).toContain('signature=');

    await provider.deleteObject(key);
    await expect(provider.objectExists(key)).resolves.toBe(false);
  });

  it('rejects expired, altered, and unsafe signed requests', async () => {
    expect(
      provider.verifyLocalSignature('upload', key, 1, '0'.repeat(64)),
    ).toBe(false);
    await expect(provider.inspectObject('../outside')).rejects.toThrow(
      'Invalid storage object key',
    );
  });
});
