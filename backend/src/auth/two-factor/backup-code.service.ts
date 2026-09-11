import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { TwoFactorCryptoService } from './two-factor-crypto.service';
import { GeneratedBackupCodes } from './two-factor.types';

const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_GROUP_LENGTH = 4;
const BACKUP_CODE_GROUP_COUNT = 4;
const BACKUP_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const NORMALIZED_BACKUP_CODE_PATTERN = /^[2-9A-HJ-NP-Z]{16}$/;

@Injectable()
export class BackupCodeService {
  constructor(private readonly cryptoService: TwoFactorCryptoService) {}

  generate(userId: string): GeneratedBackupCodes {
    const plaintextCodes = new Set<string>();

    while (plaintextCodes.size < BACKUP_CODE_COUNT) {
      plaintextCodes.add(this.createCode());
    }

    const codes = [...plaintextCodes];

    return {
      plaintextCodes: codes,
      codeHashes: codes.map((code) =>
        this.cryptoService.hashBackupCode(code.replaceAll('-', ''), userId),
      ),
    };
  }

  hash(code: string, userId: string): string | null {
    const normalizedCode = this.normalize(code);

    return normalizedCode
      ? this.cryptoService.hashBackupCode(normalizedCode, userId)
      : null;
  }

  private createCode(): string {
    const characters = Array.from(
      { length: BACKUP_CODE_GROUP_LENGTH * BACKUP_CODE_GROUP_COUNT },
      () => BACKUP_CODE_ALPHABET[randomInt(BACKUP_CODE_ALPHABET.length)],
    ).join('');
    const groups = Array.from({ length: BACKUP_CODE_GROUP_COUNT }, (_, index) =>
      characters.slice(
        index * BACKUP_CODE_GROUP_LENGTH,
        (index + 1) * BACKUP_CODE_GROUP_LENGTH,
      ),
    );

    return groups.join('-');
  }

  private normalize(code: string): string | null {
    const normalized = code.replace(/[\s-]/g, '').toUpperCase();

    return NORMALIZED_BACKUP_CODE_PATTERN.test(normalized) ? normalized : null;
  }
}
