import { createHash, timingSafeEqual } from 'node:crypto';
import { extname } from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ACCEPTED_FILE_MIME_TYPES,
  FILE_MAX_SIZE_BYTES,
} from './file.constants';

type AcceptedExtension = keyof typeof ACCEPTED_FILE_MIME_TYPES;
type OfficeExtension = '.docx' | '.xlsx' | '.pptx';

@Injectable()
export class FileValidationService {
  validateDeclaration(input: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }): { fileName: string; mimeType: string; extension: AcceptedExtension } {
    const fileName = input.fileName.normalize('NFKC').trim();
    if (
      fileName.length === 0 ||
      fileName.length > 255 ||
      fileName.includes('/') ||
      fileName.includes('\\') ||
      [...fileName].some((character) => {
        const code = character.charCodeAt(0);
        return code <= 31 || code === 127;
      })
    ) {
      throw new BadRequestException('File name is invalid');
    }
    if (input.sizeBytes < 1 || input.sizeBytes > FILE_MAX_SIZE_BYTES) {
      throw new BadRequestException(
        'File size must be between 1 byte and 25 MiB',
      );
    }

    const extension = extname(fileName).toLowerCase() as AcceptedExtension;
    const expectedMimeType = ACCEPTED_FILE_MIME_TYPES[extension];
    if (!expectedMimeType || input.mimeType !== expectedMimeType) {
      throw new BadRequestException('File type is not accepted');
    }

    return { fileName, mimeType: expectedMimeType, extension };
  }

  validateObject(input: {
    body: Buffer;
    fileName: string;
    declaredMimeType: string;
    declaredSizeBytes: number;
    checksumSha256: string;
  }): { detectedMimeType: string; checksumSha256: string } {
    if (input.body.length !== input.declaredSizeBytes) {
      throw new BadRequestException(
        'Uploaded file size does not match the reservation',
      );
    }

    const checksumSha256 = createHash('sha256')
      .update(input.body)
      .digest('hex');
    const actual = Buffer.from(checksumSha256, 'hex');
    const expected = Buffer.from(input.checksumSha256, 'hex');
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      throw new BadRequestException('Uploaded file checksum does not match');
    }

    const extension = extname(
      input.fileName,
    ).toLowerCase() as AcceptedExtension;
    const detectedMimeType = this.detectMimeType(input.body, extension);
    if (detectedMimeType !== input.declaredMimeType) {
      throw new BadRequestException(
        'Uploaded file content does not match its declared type',
      );
    }

    return { detectedMimeType, checksumSha256 };
  }

  private detectMimeType(body: Buffer, extension: AcceptedExtension): string {
    if (extension === '.pdf' && body.subarray(0, 5).toString() === '%PDF-') {
      return ACCEPTED_FILE_MIME_TYPES[extension];
    }
    if (
      (extension === '.jpg' || extension === '.jpeg') &&
      body[0] === 0xff &&
      body[1] === 0xd8 &&
      body[2] === 0xff
    ) {
      return ACCEPTED_FILE_MIME_TYPES[extension];
    }
    if (
      extension === '.png' &&
      body
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ) {
      return ACCEPTED_FILE_MIME_TYPES[extension];
    }
    if (
      extension === '.webp' &&
      body.subarray(0, 4).toString() === 'RIFF' &&
      body.subarray(8, 12).toString() === 'WEBP'
    ) {
      return ACCEPTED_FILE_MIME_TYPES[extension];
    }
    if (
      extension === '.docx' ||
      extension === '.xlsx' ||
      extension === '.pptx'
    ) {
      return this.detectOfficeDocument(body, extension);
    }
    if (extension === '.txt' || extension === '.csv' || extension === '.json') {
      return this.detectTextDocument(body, extension);
    }
    throw new BadRequestException('Uploaded file signature is not accepted');
  }

  private detectOfficeDocument(
    body: Buffer,
    extension: OfficeExtension,
  ): string {
    if (body[0] !== 0x50 || body[1] !== 0x4b) {
      throw new BadRequestException('Office file container is invalid');
    }
    const archiveText = body.toString('latin1');
    const requiredDirectory = {
      '.docx': 'word/',
      '.xlsx': 'xl/',
      '.pptx': 'ppt/',
    }[extension];
    if (
      !requiredDirectory ||
      !archiveText.includes('[Content_Types].xml') ||
      !archiveText.includes(requiredDirectory)
    ) {
      throw new BadRequestException('Office file container is invalid');
    }
    return ACCEPTED_FILE_MIME_TYPES[extension];
  }

  private detectTextDocument(
    body: Buffer,
    extension: AcceptedExtension,
  ): string {
    if (body.includes(0)) {
      throw new BadRequestException('Text files cannot contain null bytes');
    }
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(body);
    } catch {
      throw new BadRequestException('Text files must use UTF-8 encoding');
    }
    if (extension === '.json') {
      try {
        JSON.parse(text);
      } catch {
        throw new BadRequestException('JSON file content is invalid');
      }
    }
    return ACCEPTED_FILE_MIME_TYPES[extension];
  }
}
