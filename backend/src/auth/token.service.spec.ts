import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EnvironmentVariables } from '../config/env.validation';
import { TokenService } from './token.service';

describe('TokenService', () => {
  const configService = new ConfigService<EnvironmentVariables, true>({
    JWT_ACCESS_SECRET: 'unit-test-jwt-secret-that-is-at-least-32-characters',
    JWT_ACCESS_TTL_SECONDS: 900,
    REFRESH_TOKEN_TTL_DAYS: 30,
  });
  const service = new TokenService(new JwtService(), configService);

  it('signs and verifies typed access tokens', async () => {
    const token = await service.signAccessToken({
      id: '0198-identifier',
      email: 'user@example.test',
    });

    await expect(service.verifyAccessToken(token)).resolves.toMatchObject({
      sub: '0198-identifier',
      email: 'user@example.test',
      type: 'access',
    });
  });

  it('creates opaque tokens and stable non-reversible hashes', () => {
    const token = service.createOpaqueToken();

    expect(token).toHaveLength(43);
    expect(service.hashOpaqueToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(service.hashOpaqueToken(token)).not.toBe(token);
  });

  it('rejects an invalid access token', async () => {
    await expect(service.verifyAccessToken('invalid')).rejects.toThrow(
      'Invalid or expired access token',
    );
  });
});
