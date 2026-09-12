import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
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

export class LocalFileStorageProvider implements ObjectStorageProvider {
  readonly provider = FileStorageProvider.LOCAL;
  private readonly root: string;

  constructor(
    root: string,
    private readonly signingSecret: string,
  ) {
    this.root = resolve(root);
  }

  createUploadTarget(
    input: CreateUploadTargetInput,
  ): Promise<FileUploadTarget> {
    const expires = Math.floor(input.expiresAt.getTime() / 1000);
    const signature = this.sign('upload', input.key, expires);
    return Promise.resolve({
      method: 'POST',
      url: `${input.uploadPath}?expires=${expires}&signature=${signature}`,
      fields: {},
      headers: {},
      fileField: 'file',
      expiresAt: input.expiresAt,
    });
  }

  verifyLocalSignature(
    action: 'upload' | 'download',
    key: string,
    expires: number,
    signature: string,
  ): boolean {
    if (
      !Number.isSafeInteger(expires) ||
      expires < Math.floor(Date.now() / 1000)
    ) {
      return false;
    }
    const expected = Buffer.from(this.sign(action, key, expires), 'hex');
    const supplied = Buffer.from(signature, 'hex');
    return (
      supplied.length === expected.length && timingSafeEqual(supplied, expected)
    );
  }

  async putObject(key: string, body: Buffer): Promise<void> {
    const destination = this.pathFor(key);
    const temporary = `${destination}.${randomUUID()}.tmp`;
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(temporary, body, { flag: 'wx' });
    try {
      await rename(temporary, destination);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }

  async inspectObject(key: string): Promise<StoredObject> {
    const body = await readFile(this.pathFor(key));
    return { body, sizeBytes: body.length, contentType: null };
  }

  createDownloadTarget(
    key: string,
    downloadPath: string,
  ): Promise<FileDownloadTarget> {
    const expiresAt = new Date(
      Date.now() + FILE_DOWNLOAD_URL_TTL_SECONDS * 1000,
    );
    const expires = Math.floor(expiresAt.getTime() / 1000);
    const signature = this.sign('download', key, expires);
    return Promise.resolve({
      method: 'GET',
      url: `${downloadPath}?expires=${expires}&signature=${signature}`,
      expiresAt,
    });
  }

  async deleteObject(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await readFile(this.pathFor(key));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }

  async listObjects(prefix: string): Promise<StoredObjectReference[]> {
    const start = this.pathFor(prefix);
    const objects: StoredObjectReference[] = [];
    const visit = async (directory: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw error;
      }
      for (const entry of entries) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) await visit(path);
        if (entry.isFile() && !entry.name.endsWith('.tmp')) {
          const metadata = await stat(path);
          objects.push({
            key: relative(this.root, path).split(sep).join('/'),
            lastModified: metadata.mtime,
          });
        }
      }
    };
    await visit(start);
    return objects;
  }

  setLifecycleState(): Promise<void> {
    return Promise.resolve();
  }

  private sign(
    action: 'upload' | 'download',
    key: string,
    expires: number,
  ): string {
    return createHmac('sha256', this.signingSecret)
      .update(`${action}\n${key}\n${expires}`)
      .digest('hex');
  }

  private pathFor(key: string): string {
    if (!/^objects(?:\/[0-9a-f-]{36})?(?:\/[0-9a-f-]{36})?$/.test(key)) {
      throw new Error('Invalid storage object key');
    }
    const path = resolve(this.root, ...key.split('/'));
    if (path !== this.root && !path.startsWith(`${this.root}${sep}`)) {
      throw new Error('Storage object key escaped the configured root');
    }
    return path;
  }
}
