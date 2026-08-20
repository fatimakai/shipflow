import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { FileValidationService } from './file-validation.service';

describe('FileValidationService', () => {
  const service = new FileValidationService();

  it('accepts matching declarations, signatures, sizes, and checksums', () => {
    const body = Buffer.from('%PDF-1.7\nminimal test document');
    const checksumSha256 = createHash('sha256').update(body).digest('hex');

    expect(
      service.validateDeclaration({
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: body.length,
      }),
    ).toMatchObject({ fileName: 'report.pdf', mimeType: 'application/pdf' });
    expect(
      service.validateObject({
        body,
        fileName: 'report.pdf',
        declaredMimeType: 'application/pdf',
        declaredSizeBytes: body.length,
        checksumSha256,
      }),
    ).toEqual({ detectedMimeType: 'application/pdf', checksumSha256 });
  });

  it('parses JSON and requires UTF-8 text content', () => {
    const body = Buffer.from('{"approved":true}');
    const checksumSha256 = createHash('sha256').update(body).digest('hex');

    expect(
      service.validateObject({
        body,
        fileName: 'data.json',
        declaredMimeType: 'application/json',
        declaredSizeBytes: body.length,
        checksumSha256,
      }).detectedMimeType,
    ).toBe('application/json');
  });

  it('rejects active file types and mismatched content', () => {
    expect(() =>
      service.validateDeclaration({
        fileName: 'payload.svg',
        mimeType: 'image/svg+xml',
        sizeBytes: 20,
      }),
    ).toThrow(BadRequestException);

    const body = Buffer.from('not a pdf');
    expect(() =>
      service.validateObject({
        body,
        fileName: 'report.pdf',
        declaredMimeType: 'application/pdf',
        declaredSizeBytes: body.length,
        checksumSha256: createHash('sha256').update(body).digest('hex'),
      }),
    ).toThrow('Uploaded file signature is not accepted');
  });

  it('rejects checksum and size mismatches', () => {
    const body = Buffer.from('%PDF-1.7\ntest');
    expect(() =>
      service.validateObject({
        body,
        fileName: 'report.pdf',
        declaredMimeType: 'application/pdf',
        declaredSizeBytes: body.length,
        checksumSha256: '0'.repeat(64),
      }),
    ).toThrow('Uploaded file checksum does not match');
  });
});
