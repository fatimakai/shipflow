import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';
import { EncryptedTwoFactorSecret } from './two-factor.types';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const INITIALIZATION_VECTOR_BYTES = 12;
const AUTHENTICATION_TAG_BYTES = 16;
const BACKUP_CODE_KEY_INFO = 'shipflow:two-factor:backup-code:v1';

@Injectable()
export class TwoFactorCryptoService {
  private readonly currentKey: Buffer;
  private readonly currentKeyVersion: number;
  private readonly backupCodeHashKey: Buffer;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    this.currentKey = Buffer.from(
      configService.getOrThrow<string>('TWO_FACTOR_ENCRYPTION_KEY'),
      'base64',
    );
    this.currentKeyVersion = configService.getOrThrow<number>(
      'TWO_FACTOR_ENCRYPTION_KEY_VERSION',
    );

    if (this.currentKey.length !== 32) {
      throw new Error('TWO_FACTOR_ENCRYPTION_KEY must decode to 32 bytes');
    }

    this.backupCodeHashKey = Buffer.from(
      hkdfSync(
        'sha256',
        this.currentKey,
        Buffer.alloc(0),
        BACKUP_CODE_KEY_INFO,
        32,
      ),
    );
  }

  encryptSecret(secret: string, userId: string): EncryptedTwoFactorSecret {
    const initializationVector = randomBytes(INITIALIZATION_VECTOR_BYTES);
    const cipher = createCipheriv(
      ENCRYPTION_ALGORITHM,
      this.currentKey,
      initializationVector,
      { authTagLength: AUTHENTICATION_TAG_BYTES },
    );
    cipher.setAAD(this.createAdditionalAuthenticatedData(userId));

    const encryptedSecret = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);

    return {
      encryptedSecret,
      initializationVector,
      authenticationTag: cipher.getAuthTag(),
      encryptionKeyVersion: this.currentKeyVersion,
    };
  }

  decryptSecret(encrypted: EncryptedTwoFactorSecret, userId: string): string {
    if (encrypted.encryptionKeyVersion !== this.currentKeyVersion) {
      throw new Error('Unsupported two-factor encryption key version');
    }

    if (
      encrypted.initializationVector.length !== INITIALIZATION_VECTOR_BYTES ||
      encrypted.authenticationTag.length !== AUTHENTICATION_TAG_BYTES
    ) {
      throw new Error('Invalid encrypted two-factor secret');
    }

    try {
      const decipher = createDecipheriv(
        ENCRYPTION_ALGORITHM,
        this.currentKey,
        encrypted.initializationVector,
        { authTagLength: AUTHENTICATION_TAG_BYTES },
      );
      decipher.setAAD(this.createAdditionalAuthenticatedData(userId));
      decipher.setAuthTag(encrypted.authenticationTag);

      return Buffer.concat([
        decipher.update(encrypted.encryptedSecret),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new Error('Unable to decrypt two-factor secret');
    }
  }

  hashBackupCode(normalizedCode: string, userId: string): string {
    return createHmac('sha256', this.backupCodeHashKey)
      .update(`${this.currentKeyVersion}:${userId}:${normalizedCode}`, 'utf8')
      .digest('hex');
  }

  private createAdditionalAuthenticatedData(userId: string): Buffer {
    return Buffer.from(
      `shipflow:two-factor:secret:${this.currentKeyVersion}:${userId}`,
      'utf8',
    );
  }
}
