import { Inject } from '@nestjs/common';
import { FileStorageProvider } from '../../generated/prisma/enums';

export const FILE_STORAGE = Symbol('FILE_STORAGE');
export const InjectFileStorage = () => Inject(FILE_STORAGE);

export interface CreateUploadTargetInput {
  key: string;
  uploadPath: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  organizationId: string;
  fileId: string;
  expiresAt: Date;
}

export interface FileUploadTarget {
  method: 'POST' | 'PUT';
  url: string;
  fields: Record<string, string>;
  headers: Record<string, string>;
  fileField?: 'file';
  expiresAt: Date;
}

export interface FileDownloadTarget {
  method: 'GET';
  url: string;
  expiresAt: Date;
}

export interface StoredObject {
  body: Buffer;
  sizeBytes: number;
  contentType: string | null;
}

export interface StoredObjectReference {
  key: string;
  lastModified: Date | null;
}

export interface ObjectStorageProvider {
  readonly provider: FileStorageProvider;
  createUploadTarget(input: CreateUploadTargetInput): Promise<FileUploadTarget>;
  verifyLocalSignature(
    action: 'upload' | 'download',
    key: string,
    expires: number,
    signature: string,
  ): boolean;
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  inspectObject(key: string): Promise<StoredObject>;
  createDownloadTarget(
    key: string,
    downloadPath: string,
    fileName: string,
    contentType: string,
  ): Promise<FileDownloadTarget>;
  deleteObject(key: string): Promise<void>;
  objectExists(key: string): Promise<boolean>;
  listObjects(prefix: string): Promise<StoredObjectReference[]>;
  setLifecycleState(
    key: string,
    state: 'pending' | 'scanning' | 'ready' | 'deleted' | 'rejected',
  ): Promise<void>;
}
