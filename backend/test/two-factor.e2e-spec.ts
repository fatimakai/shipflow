import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { generate } from 'otplib';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import { AuthService } from '../src/auth/auth.service';
import { TokenService } from '../src/auth/token.service';
import { TwoFactorService } from '../src/auth/two-factor/two-factor.service';
import { EnvironmentVariables } from '../src/config/env.validation';
import { PrismaService } from '../src/database/prisma.service';
import {
  TRANSACTIONAL_EMAIL_DELIVERY,
  type EmailDeliveryResult,
  type TransactionalEmailDelivery,
} from '../src/email/email.types';

interface AuthResponseBody {
  accessToken: string;
  user: { id: string; email: string };
}

interface ChallengeResponseBody {
  requiresTwoFactor: true;
  challengeToken: string;
  expiresIn: number;
}

interface EnabledResponseBody {
  enabled: true;
  backupCodes: string[];
}

class NoopDelivery implements TransactionalEmailDelivery {
  sendEmailVerification(): Promise<EmailDeliveryResult> {
    return Promise.resolve({ status: 'sent' });
  }

  sendPasswordReset(): Promise<EmailDeliveryResult> {
    return Promise.resolve({ status: 'sent' });
  }

  sendOrganizationInvitation(): Promise<EmailDeliveryResult> {
    return Promise.resolve({ status: 'sent' });
  }

  sendSecurityNotice(): Promise<EmailDeliveryResult> {
    return Promise.resolve({ status: 'sent' });
  }
}

describe('Two-factor authentication (e2e)', () => {
  const marker = randomUUID();
  const email = `two-factor-flow-${marker}@example.test`;
  const oauthEmail = `two-factor-oauth-${marker}@example.test`;
  const password = 'correct horse battery staple';
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;
  let twoFactorService: TwoFactorService;
  let tokenService: TokenService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TRANSACTIONAL_EMAIL_DELIVERY)
      .useValue(new NoopDelivery())
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    const configService = app.get(ConfigService<EnvironmentVariables, true>);
    configureApplication(app, configService);
    await app.init();
    prisma = app.get(PrismaService);
    authService = app.get(AuthService);
    twoFactorService = app.get(TwoFactorService);
    tokenService = app.get(TokenService);
  });

  it('enforces setup, login challenges, recovery codes, and step-up changes', async () => {
    const browser = request.agent(app.getHttpServer());
    const registration = await browser
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201);
    const authentication = registration.body as AuthResponseBody;
    const authorization = `Bearer ${authentication.accessToken}`;

    await browser
      .get('/api/v1/auth/2fa/status')
      .set('Authorization', authorization)
      .expect(200)
      .expect({ enabled: false, setupPending: false, backupCodesRemaining: 0 });

    const setup = await browser
      .post('/api/v1/auth/2fa/setup')
      .set('Authorization', authorization)
      .expect(200);
    const setupBody = setup.body as {
      provisioningUri: string;
      manualEntryKey: string;
    };

    expect(setupBody.provisioningUri).toContain('otpauth://totp/');
    expect(setupBody.manualEntryKey).toMatch(/^[A-Z2-7]{32}$/);

    const storedCredential = await prisma.twoFactorCredential.findUniqueOrThrow(
      { where: { userId: authentication.user.id } },
    );
    expect(
      Buffer.from(storedCredential.encryptedSecret).toString('utf8'),
    ).not.toContain(setupBody.manualEntryKey);

    await browser
      .post('/api/v1/auth/2fa/setup/confirm')
      .set('Authorization', authorization)
      .send({ code: '000000' })
      .expect(401);

    const setupCode = await generate({
      epoch: Date.now() / 1000 - 30,
      secret: setupBody.manualEntryKey,
    });
    const confirmation = await browser
      .post('/api/v1/auth/2fa/setup/confirm')
      .set('Authorization', authorization)
      .send({ code: setupCode })
      .expect(200);
    const confirmationBody = confirmation.body as EnabledResponseBody;

    expect(confirmationBody.backupCodes).toHaveLength(10);
    await browser.post('/api/v1/auth/refresh').expect(401);
    await expect(
      prisma.twoFactorBackupCode.count({
        where: { credentialId: storedCredential.id, consumedAt: null },
      }),
    ).resolves.toBe(10);

    await browser
      .get('/api/v1/auth/2fa/status')
      .set('Authorization', authorization)
      .expect(200)
      .expect({ enabled: true, setupPending: false, backupCodesRemaining: 10 });

    const sessionsBeforeFirstFactor = await prisma.session.count({
      where: { userId: authentication.user.id },
    });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const challenge = login.body as ChallengeResponseBody;

    expect(challenge).toMatchObject({
      requiresTwoFactor: true,
      challengeToken: expect.any(String) as string,
      expiresIn: 300,
    });
    expect(login.headers['set-cookie']).toBeUndefined();
    await expect(
      prisma.session.count({ where: { userId: authentication.user.id } }),
    ).resolves.toBe(sessionsBeforeFirstFactor);
    const storedChallenge = await prisma.twoFactorChallenge.findUniqueOrThrow({
      where: {
        tokenHash: tokenService.hashOpaqueToken(challenge.challengeToken),
      },
    });
    expect(
      storedChallenge.expiresAt.getTime() - storedChallenge.createdAt.getTime(),
    ).toBeGreaterThanOrEqual(299_000);
    expect(
      storedChallenge.expiresAt.getTime() - storedChallenge.createdAt.getTime(),
    ).toBeLessThanOrEqual(300_000);

    const currentCode = await generate({
      epoch: Date.now() / 1000,
      secret: setupBody.manualEntryKey,
    });
    const completed = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/challenge/verify')
      .send({ challengeToken: challenge.challengeToken, code: currentCode })
      .expect(200);

    expect((completed.body as AuthResponseBody).accessToken).toEqual(
      expect.any(String),
    );
    expect(getRefreshCookie(completed.headers)).toContain('shipflow_refresh=');

    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/challenge/verify')
      .send({ challengeToken: challenge.challengeToken, code: currentCode })
      .expect(401);

    const recoveryLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const recoveryChallenge = recoveryLogin.body as ChallengeResponseBody;
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/challenge/verify')
      .send({
        challengeToken: recoveryChallenge.challengeToken,
        code: confirmationBody.backupCodes[0],
      })
      .expect(200);

    const replayLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/challenge/verify')
      .send({
        challengeToken: (replayLogin.body as ChallengeResponseBody)
          .challengeToken,
        code: confirmationBody.backupCodes[0],
      })
      .expect(401);

    const expiredLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const expiredChallenge = expiredLogin.body as ChallengeResponseBody;
    await prisma.twoFactorChallenge.update({
      where: {
        tokenHash: tokenService.hashOpaqueToken(
          expiredChallenge.challengeToken,
        ),
      },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/challenge/verify')
      .send({
        challengeToken: expiredChallenge.challengeToken,
        code: confirmationBody.backupCodes[2],
      })
      .expect(401);

    await browser
      .post('/api/v1/auth/2fa/backup-codes/regenerate')
      .set('Authorization', authorization)
      .send({
        code: confirmationBody.backupCodes[1],
        currentPassword: 'incorrect password',
      })
      .expect(401);

    const regeneration = await browser
      .post('/api/v1/auth/2fa/backup-codes/regenerate')
      .set('Authorization', authorization)
      .send({
        code: confirmationBody.backupCodes[1],
        currentPassword: password,
      })
      .expect(200);
    const regenerated = regeneration.body as EnabledResponseBody;

    expect(regenerated.backupCodes).toHaveLength(10);
    expect(regenerated.backupCodes).not.toEqual(confirmationBody.backupCodes);

    await browser
      .delete('/api/v1/auth/2fa')
      .set('Authorization', authorization)
      .send({ code: regenerated.backupCodes[0], currentPassword: password })
      .expect(200)
      .expect({ message: 'Two-factor authentication disabled' });

    await expect(
      prisma.twoFactorCredential.findUnique({
        where: { userId: authentication.user.id },
      }),
    ).resolves.toBeNull();
    await browser.post('/api/v1/auth/refresh').expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).not.toHaveProperty('requiresTwoFactor');
      });
  });

  it('requires ShipFlow 2FA after a successful OAuth first factor', async () => {
    const profile = {
      provider: 'google' as const,
      providerAccountId: `google-2fa-${marker}`,
      email: oauthEmail,
      displayName: 'OAuth 2FA User',
      avatarUrl: null,
    };
    const initialAuthentication = await authService.authenticateOAuth(
      profile,
      {},
    );

    expect(initialAuthentication.kind).toBe('authenticated');
    if (initialAuthentication.kind !== 'authenticated') {
      throw new Error('Expected initial OAuth authentication to complete');
    }

    const authorization = `Bearer ${initialAuthentication.response.accessToken}`;
    const setup = await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/setup')
      .set('Authorization', authorization)
      .expect(200);
    const secret = (setup.body as { manualEntryKey: string }).manualEntryKey;
    const setupCode = await generate({
      epoch: Date.now() / 1000 - 30,
      secret,
    });
    await request(app.getHttpServer())
      .post('/api/v1/auth/2fa/setup/confirm')
      .set('Authorization', authorization)
      .send({ code: setupCode })
      .expect(200);

    const sessionsBeforeOAuth = await prisma.session.count({
      where: { userId: initialAuthentication.response.user.id },
    });
    const repeatedAuthentication = await authService.authenticateOAuth(
      profile,
      {},
    );

    expect(repeatedAuthentication.kind).toBe('two-factor');
    if (repeatedAuthentication.kind !== 'two-factor') {
      throw new Error('Expected an OAuth two-factor challenge');
    }
    await expect(
      prisma.session.count({
        where: { userId: initialAuthentication.response.user.id },
      }),
    ).resolves.toBe(sessionsBeforeOAuth);

    const currentCode = await generate({
      epoch: Date.now() / 1000,
      secret,
    });
    const completed = await twoFactorService.verifyLoginChallenge(
      repeatedAuthentication.response.challengeToken,
      currentCode,
    );

    expect(completed.response.user.email).toBe(oauthEmail);
    await expect(
      prisma.session.count({
        where: { userId: initialAuthentication.response.user.id },
      }),
    ).resolves.toBe(sessionsBeforeOAuth + 1);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [email, oauthEmail] } },
    });
    await app.close();
  });
});

function getRefreshCookie(headers: Record<string, unknown>): string {
  const setCookie = headers['set-cookie'];
  const values = Array.isArray(setCookie) ? (setCookie as string[]) : [];
  const cookie = values.find((value) => value.startsWith('shipflow_refresh='));

  if (!cookie) throw new Error('Expected a refresh cookie');

  return cookie.split(';', 1)[0];
}
