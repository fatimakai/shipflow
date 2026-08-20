import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import { OAuthStateStore } from './oauth-state.store';
import { GitHubStrategy, GoogleStrategy } from './oauth.strategy';

describe('OAuth strategies', () => {
  const configService = new ConfigService<EnvironmentVariables, true>({
    JWT_ACCESS_SECRET: 'unit-test-jwt-secret-that-is-at-least-32-characters',
    AUTH_COOKIE_SECURE: false,
    GOOGLE_CLIENT_ID: 'google-id',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    GOOGLE_CALLBACK_URL: 'http://localhost/google',
    GITHUB_CLIENT_ID: 'github-id',
    GITHUB_CLIENT_SECRET: 'github-secret',
    GITHUB_CALLBACK_URL: 'http://localhost/github',
  });
  const stateStore = new OAuthStateStore(configService);

  it('accepts only a verified Google email', () => {
    const strategy = new GoogleStrategy(configService, stateStore);
    const profile = {
      id: 'google-account',
      displayName: 'Google User',
      emails: [{ value: 'USER@example.test', verified: true }],
      photos: [{ value: 'https://example.test/avatar.png' }],
    } as Parameters<typeof strategy.validate>[2];

    expect(strategy.validate('', '', profile)).toEqual({
      provider: 'google',
      providerAccountId: 'google-account',
      email: 'user@example.test',
      displayName: 'Google User',
      avatarUrl: 'https://example.test/avatar.png',
    });

    expect(() =>
      strategy.validate('', '', {
        ...profile,
        emails: [{ value: 'user@example.test', verified: false }],
      }),
    ).toThrow('Google did not provide a verified email address');
  });

  it('selects a verified GitHub email', () => {
    const strategy = new GitHubStrategy(configService, stateStore);
    const profile = {
      id: 'github-account',
      displayName: 'GitHub User',
      emails: [
        { value: 'unverified@example.test', primary: true, verified: false },
        { value: 'VERIFIED@example.test', verified: true },
      ],
    } as Parameters<typeof strategy.validate>[2];

    expect(strategy.validate('', '', profile)).toMatchObject({
      provider: 'github',
      providerAccountId: 'github-account',
      email: 'verified@example.test',
    });
  });
});
