import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { configureApplication } from '../src/app.setup';
import { EnvironmentVariables } from '../src/config/env.validation';
import { PrismaService } from '../src/database/prisma.service';
import {
  TRANSACTIONAL_EMAIL_DELIVERY,
  type EmailDeliveryResult,
  type TransactionalEmailDelivery,
} from '../src/email/email.types';

interface AuthResponseBody {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
  };
}

class CapturingAuthDelivery implements TransactionalEmailDelivery {
  readonly verificationTokens = new Map<string, string>();
  readonly passwordResetTokens = new Map<string, string>();

  sendEmailVerification(
    email: string,
    token: string,
  ): Promise<EmailDeliveryResult> {
    this.verificationTokens.set(email, token);
    return Promise.resolve({ status: 'sent' });
  }

  sendPasswordReset(
    email: string,
    token: string,
  ): Promise<EmailDeliveryResult> {
    this.passwordResetTokens.set(email, token);
    return Promise.resolve({ status: 'sent' });
  }

  sendOrganizationInvitation(): Promise<EmailDeliveryResult> {
    return Promise.resolve({ status: 'sent' });
  }

  sendSecurityNotice(): Promise<EmailDeliveryResult> {
    return Promise.resolve({ status: 'sent' });
  }
}

describe('Authentication (e2e)', () => {
  const marker = randomUUID();
  const email = `auth-${marker}@example.test`;
  const secondEmail = `auth-second-${marker}@example.test`;
  const oauthEmail = `auth-oauth-${marker}@example.test`;
  const password = 'correct horse battery staple';
  const newPassword = 'new correct horse battery staple';
  const delivery = new CapturingAuthDelivery();
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TRANSACTIONAL_EMAIL_DELIVERY)
      .useValue(delivery)
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    const configService = app.get(ConfigService<EnvironmentVariables, true>);
    configureApplication(app, configService);
    await app.init();
    prisma = app.get(PrismaService);
    authService = app.get(AuthService);
  });

  it('supports the complete local account and session lifecycle', async () => {
    const primaryAgent = request.agent(app.getHttpServer());
    const registration = await primaryAgent
      .post('/api/v1/auth/register')
      .send({ email: email.toUpperCase(), password, displayName: 'Auth User' })
      .expect(201);
    const registrationBody = registration.body as AuthResponseBody;
    const originalRefreshCookie = getRefreshCookie(registration.headers);

    expect(registrationBody).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { email, emailVerified: false },
    });
    expect(registrationBody.accessToken).toEqual(expect.any(String));
    expect(registration.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/HttpOnly.*SameSite=Lax/i),
      ]),
    );
    expect(originalRefreshCookie).toContain('shipflow_refresh=');

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: ` ${email.toUpperCase()} `, password })
      .expect(409);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registrationBody.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ email, emailVerified: false });
        expect(response.body).not.toHaveProperty('passwordHash');
      });

    await request(app.getHttpServer())
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registrationBody.accessToken}`)
      .send({ displayName: '  Updated Auth User  ' })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          displayName: 'Updated Auth User',
          email,
        });
      });

    await request(app.getHttpServer())
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registrationBody.accessToken}`)
      .send({ displayName: '   ' })
      .expect(400);

    const verificationToken = delivery.verificationTokens.get(email);
    expect(verificationToken).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post('/api/v1/auth/email-verification/confirm')
      .send({ token: verificationToken })
      .expect(200)
      .expect({ message: 'Email verified' });

    await request(app.getHttpServer())
      .post('/api/v1/auth/email-verification/confirm')
      .send({ token: verificationToken })
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registrationBody.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ emailVerified: true });
      });

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'incorrect password' })
      .expect(401)
      .expect((response) => {
        const body = response.body as { message: string };
        expect(body.message).toBe('Invalid email or password');
      });

    await primaryAgent
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', originalRefreshCookie)
      .expect(401);

    await primaryAgent
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .expect(401);

    const login = await primaryAgent
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const loginCookie = getRefreshCookie(login.headers);

    await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: `missing-${marker}@example.test` })
      .expect(202)
      .expect({ message: 'Password reset request accepted' });

    await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email })
      .expect(202)
      .expect({ message: 'Password reset request accepted' });

    const resetToken = delivery.passwordResetTokens.get(email);
    expect(resetToken).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token: resetToken, password: newPassword })
      .expect(200)
      .expect({ message: 'Password reset successfully' });

    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token: resetToken, password: newPassword })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', loginCookie)
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(401);

    const newLogin = await primaryAgent
      .post('/api/v1/auth/login')
      .send({ email, password: newPassword })
      .expect(200);
    const newLoginBody = newLogin.body as AuthResponseBody;
    const newLoginCookie = getRefreshCookie(newLogin.headers);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', 'https://untrusted.example')
      .set('Cookie', newLoginCookie)
      .expect(403);

    await primaryAgent
      .post('/api/v1/auth/logout')
      .set('Origin', 'http://localhost:5173')
      .expect(200)
      .expect({ message: 'Signed out' });

    await primaryAgent.post('/api/v1/auth/refresh').expect(401);

    const secondAgent = request.agent(app.getHttpServer());
    const secondRegistration = await secondAgent
      .post('/api/v1/auth/register')
      .send({ email: secondEmail, password })
      .expect(201);
    const secondRegistrationBody = secondRegistration.body as AuthResponseBody;
    const concurrentAgent = request.agent(app.getHttpServer());

    await concurrentAgent
      .post('/api/v1/auth/login')
      .send({ email: secondEmail, password })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${secondRegistrationBody.accessToken}`)
      .expect(200)
      .expect({ message: 'Signed out from all sessions' });

    await secondAgent.post('/api/v1/auth/refresh').expect(401);
    await concurrentAgent.post('/api/v1/auth/refresh').expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/auth/oauth/google')
      .expect(503);
    await request(app.getHttpServer())
      .get('/api/v1/auth/oauth/github')
      .expect(503);

    const oauthAuthentication = await authService.authenticateOAuth(
      {
        provider: 'google',
        providerAccountId: `google-${marker}`,
        email: oauthEmail,
        displayName: 'OAuth User',
        avatarUrl: null,
      },
      {},
    );
    const repeatedOAuthAuthentication = await authService.authenticateOAuth(
      {
        provider: 'google',
        providerAccountId: `google-${marker}`,
        email: oauthEmail,
        displayName: 'OAuth User',
        avatarUrl: null,
      },
      {},
    );

    expect(oauthAuthentication.response.user).toMatchObject({
      email: oauthEmail,
      emailVerified: true,
    });
    expect(repeatedOAuthAuthentication.response.user.id).toBe(
      oauthAuthentication.response.user.id,
    );
    await expect(
      prisma.oAuthAccount.count({
        where: { provider: 'google', providerAccountId: `google-${marker}` },
      }),
    ).resolves.toBe(1);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${newLoginBody.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: newPassword })
      .expect(429);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [email, secondEmail, oauthEmail] } },
    });
    await app.close();
  });
});

function getRefreshCookie(headers: Record<string, unknown>): string {
  const setCookie = headers['set-cookie'];
  const values = Array.isArray(setCookie) ? (setCookie as string[]) : [];
  const cookie = values.find((value) => value.startsWith('shipflow_refresh='));

  if (!cookie) {
    throw new Error('Expected a refresh cookie');
  }

  return cookie.split(';', 1)[0];
}
