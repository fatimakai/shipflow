import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';
import { BackupCodeService } from './backup-code.service';
import { TwoFactorCryptoService } from './two-factor-crypto.service';

describe('BackupCodeService', () => {
  const configService = new ConfigService<EnvironmentVariables, true>({
    TWO_FACTOR_ENCRYPTION_KEY: Buffer.alloc(32, 11).toString('base64'),
    TWO_FACTOR_ENCRYPTION_KEY_VERSION: 1,
  });
  const service = new BackupCodeService(
    new TwoFactorCryptoService(configService),
  );

  it('generates ten unique, high-entropy recovery codes and only their hashes', () => {
    const result = service.generate('user-1');

    expect(result.plaintextCodes).toHaveLength(10);
    expect(new Set(result.plaintextCodes).size).toBe(10);
    expect(result.codeHashes).toHaveLength(10);
    expect(new Set(result.codeHashes).size).toBe(10);

    for (const [index, code] of result.plaintextCodes.entries()) {
      expect(code).toMatch(/^[2-9A-HJ-NP-Z]{4}(?:-[2-9A-HJ-NP-Z]{4}){3}$/);
      expect(result.codeHashes[index]).toMatch(/^[0-9a-f]{64}$/);
      expect(result.codeHashes[index]).not.toContain(code);
    }
  });

  it('normalizes user input before hashing', () => {
    const [code] = service.generate('user-1').plaintextCodes;
    const relaxedInput = code.toLowerCase().replaceAll('-', ' ');

    expect(service.hash(relaxedInput, 'user-1')).toBe(
      service.hash(code, 'user-1'),
    );
  });

  it('rejects malformed codes and binds valid hashes to a user', () => {
    const [code] = service.generate('user-1').plaintextCodes;

    expect(service.hash('not-a-backup-code', 'user-1')).toBeNull();
    expect(service.hash(code, 'user-2')).not.toBe(service.hash(code, 'user-1'));
  });
});
