import { JsonLogger } from './json-logger';
import { redactLogValue } from './log-redaction';

describe('production logging', () => {
  it('redacts sensitive keys, bearer tokens, URLs, and database passwords', () => {
    expect(
      redactLogValue({
        authorization: 'Bearer header-secret',
        password: 'plain-password',
        TWO_FACTOR_ENCRYPTION_KEY: 'base64-key-material',
        manualEntryKey: 'base32-secret',
        backupCodes: ['recovery-code'],
        provisioningUri: 'otpauth://totp/ShipFlow:user?secret=secret',
        email: 'person@example.test',
        safe: 'https://app.test/reset?token=action-secret&next=home',
        database:
          'postgresql://shipflow:database-secret@database.test:5432/shipflow',
      }),
    ).toEqual({
      authorization: '[REDACTED]',
      password: '[REDACTED]',
      TWO_FACTOR_ENCRYPTION_KEY: '[REDACTED]',
      manualEntryKey: '[REDACTED]',
      backupCodes: '[REDACTED]',
      provisioningUri: '[REDACTED]',
      email: '[REDACTED]',
      safe: 'https://app.test/reset?token=[REDACTED]&next=home',
      database: 'postgresql://shipflow:[REDACTED]@database.test:5432/shipflow',
    });
  });

  it('writes one JSON record and honors the minimum level', () => {
    const stdout = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const logger = new JsonLogger('ShipFlow API', 'info');

    logger.debug('hidden');
    logger.log(
      { event: 'security.test', password: 'secret', requestId: 'request-1' },
      'TestContext',
    );

    expect(stdout).toHaveBeenCalledTimes(1);
    const record = JSON.parse(String(stdout.mock.calls[0][0])) as {
      level: string;
      context: string;
      event: string;
      data: Record<string, unknown>;
    };
    expect(record).toMatchObject({
      level: 'info',
      context: 'TestContext',
      event: 'security.test',
    });
    expect(record.data).toMatchObject({
      password: '[REDACTED]',
      requestId: 'request-1',
    });
    stdout.mockRestore();
  });
});
