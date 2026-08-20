import { JsonLogger } from './json-logger';
import { redactLogValue } from './log-redaction';

describe('production logging', () => {
  it('redacts sensitive keys, bearer tokens, URLs, and database passwords', () => {
    expect(
      redactLogValue({
        authorization: 'Bearer header-secret',
        password: 'plain-password',
        email: 'person@example.test',
        safe: 'https://app.test/reset?token=action-secret&next=home',
        database:
          'postgresql://nestship:database-secret@database.test:5432/nestship',
      }),
    ).toEqual({
      authorization: '[REDACTED]',
      password: '[REDACTED]',
      email: '[REDACTED]',
      safe: 'https://app.test/reset?token=[REDACTED]&next=home',
      database: 'postgresql://nestship:[REDACTED]@database.test:5432/nestship',
    });
  });

  it('writes one JSON record and honors the minimum level', () => {
    const stdout = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const logger = new JsonLogger('NestShip API', 'info');

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
