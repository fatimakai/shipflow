import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import { TokenService } from '../src/auth/token.service';
import { EnvironmentVariables } from '../src/config/env.validation';
import { PrismaService } from '../src/database/prisma.service';
import {
  MembershipRole,
  NotificationCategory,
  NotificationType,
} from '../src/generated/prisma/enums';
import { NotificationRetentionService } from '../src/notifications/notification-retention.service';

interface NotificationBody {
  id: string;
  organizationId: string | null;
  category: NotificationCategory;
  type: NotificationType;
  readAt: string | null;
  createdAt: string;
}

describe('Notification backend (e2e)', () => {
  const marker = randomUUID();
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenService: TokenService;
  let retention: NotificationRetentionService;
  let owner: { id: string; email: string };
  let member: { id: string; email: string };
  let outsider: { id: string; email: string };
  let organizationId: string;
  let memberMembershipId: string;
  let ownerToken: string;
  let memberToken: string;
  let outsiderToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication({ rawBody: true });
    const configService = app.get(ConfigService<EnvironmentVariables, true>);
    configureApplication(app, configService);
    await app.init();
    prisma = app.get(PrismaService);
    tokenService = app.get(TokenService);
    retention = app.get(NotificationRetentionService);

    [owner, member, outsider] = await Promise.all([
      createUser('owner'),
      createUser('member'),
      createUser('outsider'),
    ]);
    const organization = await prisma.organization.create({
      data: {
        name: `Notification Tenant ${marker}`,
        slug: `notification-${marker}`,
        ownerId: owner.id,
        memberships: {
          create: [
            { userId: owner.id, role: MembershipRole.OWNER },
            { userId: member.id, role: MembershipRole.MEMBER },
          ],
        },
      },
      include: { memberships: true },
    });
    organizationId = organization.id;
    memberMembershipId = organization.memberships.find(
      (membership) => membership.userId === member.id,
    )!.id;
    [ownerToken, memberToken, outsiderToken] = await Promise.all([
      tokenService.signAccessToken(owner),
      tokenService.signAccessToken(member),
      tokenService.signAccessToken(outsider),
    ]);
  });

  it('uses mandatory defaults and honors the organization preference', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/notifications/preferences')
      .auth(memberToken, { type: 'bearer' })
      .expect(200)
      .expect({
        organizationEnabled: true,
        securityEnabled: true,
        billingEnabled: true,
      });
    await request(app.getHttpServer())
      .patch('/api/v1/notifications/preferences')
      .auth(memberToken, { type: 'bearer' })
      .send({ organizationEnabled: false })
      .expect(200)
      .expect({
        organizationEnabled: false,
        securityEnabled: true,
        billingEnabled: true,
      });

    await changeMemberRole(MembershipRole.VIEWER);
    await expect(
      prisma.notification.count({ where: { userId: member.id } }),
    ).resolves.toBe(0);

    await request(app.getHttpServer())
      .patch('/api/v1/notifications/preferences')
      .auth(memberToken, { type: 'bearer' })
      .send({ organizationEnabled: true })
      .expect(200);
    await changeMemberRole(MembershipRole.MEMBER);
    await expect(
      prisma.notification.count({
        where: {
          userId: member.id,
          type: NotificationType.ORGANIZATION_ROLE_CHANGED,
        },
      }),
    ).resolves.toBe(1);
  });

  it('provides isolated cursor pagination, filters, and idempotent reads', async () => {
    const createdIds: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      const createdAt = new Date(Date.now() - (index + 1) * 1000);
      const notification = await prisma.notification.create({
        data: {
          userId: member.id,
          category: NotificationCategory.SECURITY,
          type: NotificationType.PASSWORD_CHANGED,
          title: `Security event ${index}`,
          message: `Security notification ${index}.`,
          dedupeKey: `security-${marker}-${index}`,
          createdAt,
          expiresAt: new Date(createdAt.getTime() + 90 * 24 * 60 * 60 * 1000),
        },
      });
      createdIds.push(notification.id);
    }

    const firstPageResponse = await request(app.getHttpServer())
      .get('/api/v1/notifications?limit=2')
      .auth(memberToken, { type: 'bearer' })
      .expect(200);
    const firstPage = firstPageResponse.body as {
      items: NotificationBody[];
      nextCursor: string | null;
    };
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    const secondPageResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/notifications?limit=2&cursor=${encodeURIComponent(firstPage.nextCursor!)}`,
      )
      .auth(memberToken, { type: 'bearer' })
      .expect(200);
    const secondPage = secondPageResponse.body as {
      items: NotificationBody[];
      nextCursor: string | null;
    };
    expect(secondPage.items).toHaveLength(2);
    expect(secondPage.items.map((item) => item.id)).not.toEqual(
      expect.arrayContaining(firstPage.items.map((item) => item.id)),
    );

    await request(app.getHttpServer())
      .get('/api/v1/notifications?cursor=invalid')
      .auth(memberToken, { type: 'bearer' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .auth(outsiderToken, { type: 'bearer' })
      .expect(200)
      .expect({ items: [], nextCursor: null });

    const notificationId = createdIds[0];
    await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .auth(outsiderToken, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .auth(memberToken, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .auth(memberToken, { type: 'bearer' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/notifications/mark-all-read')
      .auth(memberToken, { type: 'bearer' })
      .send({ organizationId })
      .expect(200)
      .expect({ updatedCount: 1 });
    await request(app.getHttpServer())
      .get(
        `/api/v1/notifications/unread-count?organizationId=${organizationId}`,
      )
      .auth(memberToken, { type: 'bearer' })
      .expect(200)
      .expect({ count: 0 });
    await request(app.getHttpServer())
      .get('/api/v1/notifications?unreadOnly=true')
      .auth(memberToken, { type: 'bearer' })
      .expect(200)
      .expect((response) => {
        const body = response.body as { items: NotificationBody[] };
        expect(body.items.every((item) => item.readAt === null)).toBe(true);
        expect(body.items.length).toBeGreaterThan(0);
      });
  });

  it('creates mandatory password notifications and prunes expired records', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/notifications/preferences')
      .auth(memberToken, { type: 'bearer' })
      .send({ organizationEnabled: false })
      .expect(200);

    const rawToken = tokenService.createOpaqueToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: member.id,
        tokenHash: tokenService.hashOpaqueToken(rawToken),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token: rawToken, password: 'new correct horse battery staple' })
      .expect(200);
    await expect(
      prisma.notification.findFirst({
        where: {
          userId: member.id,
          dedupeKey: { startsWith: 'password-changed:' },
        },
      }),
    ).resolves.toEqual(
      expect.objectContaining({ type: NotificationType.PASSWORD_CHANGED }),
    );

    const createdAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    const expired = await prisma.notification.create({
      data: {
        userId: member.id,
        category: NotificationCategory.SECURITY,
        type: NotificationType.PASSWORD_CHANGED,
        title: 'Expired notification',
        message: 'This notification should be pruned.',
        dedupeKey: `expired-${marker}`,
        createdAt,
        expiresAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
    });
    await expect(retention.prune()).resolves.toBeGreaterThanOrEqual(1);
    await expect(
      prisma.notification.findUnique({ where: { id: expired.id } }),
    ).resolves.toBeNull();
  });

  it('enforces database notification types and publishes the API contract', async () => {
    await expect(
      prisma.notification.create({
        data: {
          userId: member.id,
          category: NotificationCategory.SECURITY,
          type: NotificationType.BILLING_DISPUTE,
          title: 'Invalid category',
          message: 'This should violate the category contract.',
          dedupeKey: `invalid-${marker}`,
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ).rejects.toThrow();

    await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200)
      .expect((response) => {
        const document = response.body as {
          components: {
            schemas: Record<
              string,
              {
                properties?: Record<string, { format?: string; type?: string }>;
              }
            >;
          };
          paths: Record<string, unknown>;
        };
        const paths = document.paths;
        expect(Object.keys(paths)).toEqual(
          expect.arrayContaining([
            '/api/v1/notifications',
            '/api/v1/notifications/unread-count',
            '/api/v1/notifications/{notificationId}/read',
            '/api/v1/notifications/mark-all-read',
            '/api/v1/notifications/preferences',
          ]),
        );
        expect(
          document.components.schemas.NotificationResponseDto.properties
            ?.actionPath?.type,
        ).toBe('string');
        expect(
          document.components.schemas.NotificationResponseDto.properties?.readAt
            ?.format,
        ).toBe('date-time');
        expect(
          document.components.schemas.NotificationListResponseDto.properties
            ?.nextCursor?.type,
        ).toBe('string');
      });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({
      where: { email: { contains: marker } },
    });
    await app.close();
  });

  async function createUser(label: string) {
    return prisma.user.create({
      data: { email: `notification-${label}-${marker}@example.test` },
      select: { id: true, email: true },
    });
  }

  async function changeMemberRole(role: MembershipRole): Promise<void> {
    await request(app.getHttpServer())
      .patch(
        `/api/v1/organizations/${organizationId}/members/${memberMembershipId}`,
      )
      .auth(ownerToken, { type: 'bearer' })
      .send({ role })
      .expect(200);
  }
});
