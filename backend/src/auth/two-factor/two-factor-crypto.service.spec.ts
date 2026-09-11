import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';
import { TwoFactorCryptoService } from './two-factor-crypto.service';

describe('TwoFactorCryptoService', () => {
  const configService = new ConfigService<EnvironmentVariables, true>({
    TWO_FACTOR_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    TWO_FACTOR_ENCRYPTION_KEY_VERSION: 3,
  });
  const service = new TwoFactorCryptoService(configService);

  it('encrypts secrets with randomized authenticated encryption', () => {
    const first = service.encryptSecret('BASE32SECRET', 'user-1');
    const second = service.encryptSecret('BASE32SECRET', 'user-1');

    expect(first.encryptionKeyVersion).toBe(3);
    expect(first.initializationVector).toHaveLength(12);
    expect(first.authenticationTag).toHaveLength(16);
    expect(first.encryptedSecret).not.toEqual(Buffer.from('BASE32SECRET'));
    expect(first.encryptedSecret).not.toEqual(second.encryptedSecret);
    expect(first.initializationVector).not.toEqual(second.initializationVector);
    expect(service.decryptSecret(first, 'user-1')).toBe('BASE32SECRET');
  });

  it('rejects ciphertext moved to another user or modified at rest', () => {
    const encrypted = service.encryptSecret('BASE32SECRET', 'user-1');
    const modified = {
      ...encrypted,
      authenticationTag: Buffer.from(encrypted.authenticationTag),
    };
    modified.authenticationTag[0] ^= 1;

    expect(() => service.decryptSecret(encrypted, 'user-2')).toThrow(
      'Unable to decrypt two-factor secret',
    );
    expect(() => service.decryptSecret(modified, 'user-1')).toThrow(
      'Unable to decrypt two-factor secret',
    );
  });

  it('rejects unsupported key versions and malformed encryption metadata', () => {
    const encrypted = service.encryptSecret('BASE32SECRET', 'user-1');

    expect(() =>
      service.decryptSecret(
        { ...encrypted, encryptionKeyVersion: 2 },
        'user-1',
      ),
    ).toThrow('Unsupported two-factor encryption key version');
    expect(() =>
      service.decryptSecret(
        { ...encrypted, initializationVector: Buffer.alloc(8) },
        'user-1',
      ),
    ).toThrow('Invalid encrypted two-factor secret');
  });

  it('creates stable user-bound backup-code hashes', () => {
    const first = service.hashBackupCode('2345ABCDEFGHJKLM', 'user-1');

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(service.hashBackupCode('2345ABCDEFGHJKLM', 'user-1')).toBe(first);
    expect(service.hashBackupCode('2345ABCDEFGHJKLM', 'user-2')).not.toBe(
      first,
    );
  });

  it('fails fast when the configured key is not 32 bytes', () => {
    const invalidConfig = new ConfigService<EnvironmentVariables, true>({
      TWO_FACTOR_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64'),
      TWO_FACTOR_ENCRYPTION_KEY_VERSION: 1,
    });

    expect(() => new TwoFactorCryptoService(invalidConfig)).toThrow(
      'TWO_FACTOR_ENCRYPTION_KEY must decode to 32 bytes',
    );
  });
});
