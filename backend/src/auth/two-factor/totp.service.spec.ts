import { ConfigService } from '@nestjs/config';
import { generate } from 'otplib';
import { EnvironmentVariables } from '../../config/env.validation';
import { TotpService } from './totp.service';

describe('TotpService', () => {
  const configService = new ConfigService<EnvironmentVariables, true>({
    TWO_FACTOR_ISSUER: 'ShipFlow',
  });
  const service = new TotpService(configService);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-11T12:00:15.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('generates an authenticator-compatible secret and provisioning URI', () => {
    const secret = service.generateSecret();
    const uri = new URL(
      service.createProvisioningUri('person@example.com', secret),
    );

    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(uri.protocol).toBe('otpauth:');
    expect(uri.hostname).toBe('totp');
    expect(decodeURIComponent(uri.pathname)).toContain(
      'ShipFlow:person@example.com',
    );
    expect(uri.searchParams.get('issuer')).toBe('ShipFlow');
    expect(uri.searchParams.get('secret')).toBe(secret);
  });

  it('verifies a current token and rejects replay of the same time step', async () => {
    const secret = service.generateSecret();
    const token = await generate({
      epoch: Date.now() / 1000,
      secret,
    });
    const firstResult = await service.verifyToken(secret, token);

    expect(firstResult.valid).toBe(true);
    if (!firstResult.valid) throw new Error('Expected a valid TOTP result');

    await expect(
      service.verifyToken(secret, token, firstResult.timeStep),
    ).resolves.toEqual({ valid: false });
  });

  it('rejects malformed tokens and secrets without leaking library errors', async () => {
    await expect(service.verifyToken('invalid', '12345')).resolves.toEqual({
      valid: false,
    });
    await expect(service.verifyToken('invalid', '123456')).resolves.toEqual({
      valid: false,
    });
  });
});
