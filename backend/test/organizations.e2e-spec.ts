import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { TokenService } from '../src/auth/token.service';
import { Capability } from '../src/authorization/capability';
import { configureApplication } from '../src/app.setup';
import { EnvironmentVariables } from '../src/config/env.validation';
import { PrismaService } from '../src/database/prisma.service';
import {
  TRANSACTIONAL_EMAIL_DELIVERY,
  type EmailDeliveryResult,
  type TransactionalEmailDelivery,
} from '../src/email/email.types';
import {
  InvitationStatus,
  MembershipRole,
  NotificationType,
} from '../src/generated/prisma/enums';

interface OrganizationBody {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  membershipId: string;
  currentUserRole: MembershipRole;
  currentUserCapabilities: Capability[];
  memberCount: number;
}

interface InvitationBody {
  id: string;
  email: string;
  role: MembershipRole;
  status: InvitationStatus;
}

interface MembershipBody {
  id: string;
  organizationId: string;
  role: MembershipRole;
  user: { id: string; email: string };
}

class CapturingOrganizationDelivery implements TransactionalEmailDelivery {
  readonly tokens = new Map<string, string>();

  sendOrganizationInvitation(
    email: string,
    token: string,
  ): Promise<EmailDeliveryResult> {
    this.tokens.set(email, token);
    return Promise.resolve({ status: 'sent' });
  }

  sendEmailVerification(): Promise<EmailDeliveryResult> {
    return Promise.resolve({ status: 'sent' });
  }

  sendPasswordReset(): Promise<EmailDeliveryResult> {
    return Promise.resolve({ status: 'sent' });
  }

  sendSecurityNotice(): Promise<EmailDeliveryResult> {
    return Promise.resolve({ status: 'sent' });
  }
}

describe('Organizations and multi-tenancy (e2e)', () => {
  const marker = randomUUID();
  const ownerAEmail = `organization-owner-a-${marker}@example.test`;
  const ownerBEmail = `organization-owner-b-${marker}@example.test`;
  const memberEmail = `organization-member-${marker}@example.test`;
  const viewerEmail = `organization-viewer-${marker}@example.test`;
  const pendingEmail = `organization-pending-${marker}@example.test`;
  const organizationName = `Tenant Boundary ${marker}`;
  const delivery = new CapturingOrganizationDelivery();
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenService: TokenService;
  let ownerA: { id: string; email: string };
  let ownerB: { id: string; email: string };
  let member: { id: string; email: string };
  let viewer: { id: string; email: string };
  let ownerAToken: string;
  let ownerBToken: string;
  let memberToken: string;
  let viewerToken: string;

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
    tokenService = app.get(TokenService);

    ownerA = await createUser(ownerAEmail, 1, true);
    ownerB = await createUser(ownerBEmail, 2, true);
    member = await createUser(memberEmail, 3, true);
    viewer = await createUser(viewerEmail, 4, false);

    [ownerAToken, ownerBToken, memberToken, viewerToken] = await Promise.all([
      tokenService.signAccessToken(ownerA),
      tokenService.signAccessToken(ownerB),
      tokenService.signAccessToken(member),
      tokenService.signAccessToken(viewer),
    ]);
  });

  it('enforces organization lifecycle and tenant isolation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .auth(viewerToken, { type: 'bearer' })
      .send({ name: 'Unverified Organization' })
      .expect(403);

    const organizationAResponse = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .auth(ownerAToken, { type: 'bearer' })
      .send({ name: organizationName })
      .expect(201);
    const organizationA = organizationAResponse.body as OrganizationBody;

    expect(organizationA).toMatchObject({
      name: organizationName,
      ownerId: ownerA.id,
      currentUserRole: MembershipRole.OWNER,
      memberCount: 1,
    });
    expect(organizationA.currentUserCapabilities).toEqual(
      expect.arrayContaining([
        Capability.ORGANIZATION_DELETE,
        Capability.OWNERSHIP_TRANSFER,
        Capability.BILLING_MANAGE,
      ]),
    );
    expect(organizationA.slug).toMatch(/^tenant-boundary-/);

    const duplicateNameResponse = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .auth(ownerAToken, { type: 'bearer' })
      .send({ name: organizationName })
      .expect(201);
    const duplicateNameOrganization =
      duplicateNameResponse.body as OrganizationBody;
    expect(duplicateNameOrganization.slug).toBe(`${organizationA.slug}-2`);

    const organizationBResponse = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .auth(ownerBToken, { type: 'bearer' })
      .send({ name: `Other Tenant ${marker}` })
      .expect(201);
    const organizationB = organizationBResponse.body as OrganizationBody;

    await request(app.getHttpServer())
      .get('/api/v1/organizations?page=1&limit=1')
      .auth(ownerAToken, { type: 'bearer' })
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          items: OrganizationBody[];
          pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
          };
        };
        expect(body.items).toHaveLength(1);
        expect(body.pagination).toMatchObject({
          page: 1,
          limit: 1,
          total: 2,
          totalPages: 2,
        });
      });

    const tenantBInvitationResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationB.id}/invitations`)
      .auth(ownerBToken, { type: 'bearer' })
      .send({ email: pendingEmail, role: MembershipRole.MEMBER })
      .expect(201);
    const tenantBInvitation = tenantBInvitationResponse.body as InvitationBody;

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationB.id}`)
      .auth(ownerAToken, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${organizationB.id}`)
      .auth(ownerAToken, { type: 'bearer' })
      .send({ name: 'Cross-tenant update' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/organizations/${organizationB.id}`)
      .auth(ownerAToken, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationB.id}/members`)
      .auth(ownerAToken, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(
        `/api/v1/organizations/${organizationB.id}/members/${organizationB.membershipId}`,
      )
      .auth(ownerAToken, { type: 'bearer' })
      .send({ role: MembershipRole.MEMBER })
      .expect(404);
    await request(app.getHttpServer())
      .delete(
        `/api/v1/organizations/${organizationB.id}/members/${organizationB.membershipId}`,
      )
      .auth(ownerAToken, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationB.id}/invitations`)
      .auth(ownerAToken, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationB.id}/invitations`)
      .auth(ownerAToken, { type: 'bearer' })
      .send({ email: memberEmail })
      .expect(404);
    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationB.id}/invitations/${tenantBInvitation.id}/resend`,
      )
      .auth(ownerAToken, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(
        `/api/v1/organizations/${organizationB.id}/invitations/${tenantBInvitation.id}`,
      )
      .auth(ownerAToken, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationB.id}/ownership-transfer`)
      .auth(ownerAToken, { type: 'bearer' })
      .send({ membershipId: organizationB.membershipId })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationB.id}/leave`)
      .auth(ownerAToken, { type: 'bearer' })
      .expect(404);

    const invitationResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationA.id}/invitations`)
      .auth(ownerAToken, { type: 'bearer' })
      .send({ email: memberEmail.toUpperCase(), role: MembershipRole.MEMBER })
      .expect(201);
    const invitation = invitationResponse.body as InvitationBody;

    expect(invitation).toMatchObject({
      email: memberEmail,
      role: MembershipRole.MEMBER,
      status: InvitationStatus.PENDING,
    });
    expect(invitationResponse.body).not.toHaveProperty('token');
    expect(invitationResponse.body).not.toHaveProperty('tokenHash');

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationA.id}/invitations`)
      .auth(ownerAToken, { type: 'bearer' })
      .send({ email: memberEmail, role: MembershipRole.MEMBER })
      .expect(409);

    const memberInvitationToken = delivery.tokens.get(memberEmail);
    expect(memberInvitationToken).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .auth(ownerBToken, { type: 'bearer' })
      .send({ token: memberInvitationToken })
      .expect(403);

    const acceptedMembershipResponse = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .auth(memberToken, { type: 'bearer' })
      .send({ token: memberInvitationToken })
      .expect(200);
    const acceptedMembership =
      acceptedMembershipResponse.body as MembershipBody;

    expect(acceptedMembership).toMatchObject({
      organizationId: organizationA.id,
      role: MembershipRole.MEMBER,
      user: { id: member.id, email: memberEmail },
    });
    await expect(
      prisma.notification.count({
        where: {
          userId: ownerA.id,
          type: NotificationType.ORGANIZATION_INVITATION_ACCEPTED,
        },
      }),
    ).resolves.toBe(1);

    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .auth(memberToken, { type: 'bearer' })
      .send({ token: memberInvitationToken })
      .expect(409);

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationA.id}`)
      .auth(memberToken, { type: 'bearer' })
      .expect(200)
      .expect((response) => {
        const body = response.body as OrganizationBody;
        expect(body.currentUserCapabilities).toEqual(
          expect.arrayContaining([
            Capability.ORGANIZATION_READ,
            Capability.FILE_UPLOAD,
          ]),
        );
        expect(body.currentUserCapabilities).not.toContain(
          Capability.ORGANIZATION_UPDATE,
        );
      });

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationA.id}/members`)
      .auth(memberToken, { type: 'bearer' })
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          pagination: { total: number };
        };
        expect(body.pagination.total).toBe(2);
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${organizationA.id}`)
      .auth(memberToken, { type: 'bearer' })
      .send({ name: 'Member update attempt' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationA.id}/invitations`)
      .auth(memberToken, { type: 'bearer' })
      .send({ email: viewerEmail })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationA.id}/leave`)
      .auth(ownerAToken, { type: 'bearer' })
      .expect(409);

    await request(app.getHttpServer())
      .patch(
        `/api/v1/organizations/${organizationA.id}/members/${acceptedMembership.id}`,
      )
      .auth(ownerAToken, { type: 'bearer' })
      .send({ role: MembershipRole.ADMIN })
      .expect(200)
      .expect((response) => {
        const body = response.body as MembershipBody;
        expect(body.role).toBe(MembershipRole.ADMIN);
      });
    await expect(
      prisma.notification.count({
        where: {
          userId: member.id,
          type: NotificationType.ORGANIZATION_ROLE_CHANGED,
        },
      }),
    ).resolves.toBe(1);

    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${organizationA.id}`)
      .auth(memberToken, { type: 'bearer' })
      .send({ name: `${organizationName} Updated` })
      .expect(200)
      .expect((response) => {
        const body = response.body as OrganizationBody;
        expect(body.slug).toBe(organizationA.slug);
      });

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationA.id}/invitations`)
      .auth(memberToken, { type: 'bearer' })
      .send({ email: viewerEmail, role: MembershipRole.ADMIN })
      .expect(403);

    const viewerInvitationResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationA.id}/invitations`)
      .auth(memberToken, { type: 'bearer' })
      .send({ email: viewerEmail, role: MembershipRole.VIEWER })
      .expect(201);
    const viewerInvitation = viewerInvitationResponse.body as InvitationBody;
    const originalViewerToken = delivery.tokens.get(viewerEmail);

    const oldCreatedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const oldExpiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.invitation.update({
      where: { id: viewerInvitation.id },
      data: { createdAt: oldCreatedAt, expiresAt: oldExpiresAt },
    });

    await request(app.getHttpServer())
      .get(
        `/api/v1/organizations/${organizationA.id}/invitations?status=${InvitationStatus.EXPIRED}`,
      )
      .auth(memberToken, { type: 'bearer' })
      .expect(200)
      .expect((response) => {
        const body = response.body as { items: InvitationBody[] };
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: viewerInvitation.id,
              status: InvitationStatus.EXPIRED,
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationA.id}/invitations/${viewerInvitation.id}/resend`,
      )
      .auth(memberToken, { type: 'bearer' })
      .expect(200)
      .expect((response) => {
        const body = response.body as InvitationBody;
        expect(body.status).toBe(InvitationStatus.PENDING);
      });

    const replacementViewerToken = delivery.tokens.get(viewerEmail);
    expect(replacementViewerToken).toEqual(expect.any(String));
    expect(replacementViewerToken).not.toBe(originalViewerToken);

    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .auth(viewerToken, { type: 'bearer' })
      .send({ token: originalViewerToken })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .auth(viewerToken, { type: 'bearer' })
      .send({ token: replacementViewerToken })
      .expect(403);

    await prisma.user.update({
      where: { id: viewer.id },
      data: { emailVerifiedAt: new Date() },
    });

    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .auth(viewerToken, { type: 'bearer' })
      .send({ token: originalViewerToken })
      .expect(400);

    const viewerMembershipResponse = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .auth(viewerToken, { type: 'bearer' })
      .send({ token: replacementViewerToken })
      .expect(200);
    const viewerMembership = viewerMembershipResponse.body as MembershipBody;

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationA.id}`)
      .auth(viewerToken, { type: 'bearer' })
      .expect(200)
      .expect((response) => {
        const body = response.body as OrganizationBody;
        expect(body.currentUserCapabilities).toContain(Capability.FILE_READ);
        expect(body.currentUserCapabilities).not.toContain(
          Capability.FILE_UPLOAD,
        );
      });
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationA.id}/members`)
      .auth(viewerToken, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${organizationA.id}`)
      .auth(viewerToken, { type: 'bearer' })
      .send({ name: 'Viewer update attempt' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationA.id}/invitations`)
      .auth(viewerToken, { type: 'bearer' })
      .send({ email: `viewer-invite-${marker}@example.test` })
      .expect(403);

    await request(app.getHttpServer())
      .delete(
        `/api/v1/organizations/${organizationA.id}/members/${viewerMembership.id}`,
      )
      .auth(memberToken, { type: 'bearer' })
      .expect(200)
      .expect({ message: 'Member removed' });
    await expect(
      prisma.notification.count({
        where: {
          userId: viewer.id,
          type: NotificationType.ORGANIZATION_MEMBER_REMOVED,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.notification.count({
        where: {
          userId: ownerA.id,
          type: NotificationType.ORGANIZATION_MEMBER_REMOVED,
        },
      }),
    ).resolves.toBe(1);

    const revocableInvitationResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationA.id}/invitations`)
      .auth(memberToken, { type: 'bearer' })
      .send({ email: pendingEmail, role: MembershipRole.MEMBER })
      .expect(201);
    const revocableInvitation =
      revocableInvitationResponse.body as InvitationBody;

    await request(app.getHttpServer())
      .delete(
        `/api/v1/organizations/${organizationA.id}/invitations/${revocableInvitation.id}`,
      )
      .auth(memberToken, { type: 'bearer' })
      .expect(200)
      .expect({ message: 'Invitation revoked' });

    await request(app.getHttpServer())
      .delete(`/api/v1/organizations/${organizationA.id}`)
      .auth(memberToken, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationA.id}/ownership-transfer`)
      .auth(memberToken, { type: 'bearer' })
      .send({ membershipId: acceptedMembership.id })
      .expect(403);

    const transferResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationA.id}/ownership-transfer`)
      .auth(ownerAToken, { type: 'bearer' })
      .send({ membershipId: acceptedMembership.id })
      .expect(200);
    const transferredOrganization = transferResponse.body as OrganizationBody;

    expect(transferredOrganization).toMatchObject({
      ownerId: member.id,
      currentUserRole: MembershipRole.ADMIN,
    });
    await expect(
      prisma.notification.count({
        where: {
          userId: member.id,
          type: NotificationType.ORGANIZATION_OWNERSHIP_TRANSFERRED,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.membership.count({
        where: {
          organizationId: organizationA.id,
          role: MembershipRole.OWNER,
        },
      }),
    ).resolves.toBe(1);

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationA.id}/leave`)
      .auth(ownerAToken, { type: 'bearer' })
      .expect(200)
      .expect({ message: 'Organization left' });

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationA.id}`)
      .auth(ownerAToken, { type: 'bearer' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/organizations/${organizationA.id}`)
      .auth(memberToken, { type: 'bearer' })
      .expect(200)
      .expect({ message: 'Organization deleted' });

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationA.id}`)
      .auth(memberToken, { type: 'bearer' })
      .expect(404);
  });

  it('publishes the organization routes in OpenAPI', async () => {
    await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          paths: Record<string, unknown>;
          components: {
            schemas: Record<string, { properties?: Record<string, unknown> }>;
          };
        };
        expect(Object.keys(body.paths)).toEqual(
          expect.arrayContaining([
            '/api/v1/organizations',
            '/api/v1/organizations/{organizationId}',
            '/api/v1/organizations/{organizationId}/invitations',
            '/api/v1/organizations/{organizationId}/members',
            '/api/v1/organizations/{organizationId}/ownership-transfer',
            '/api/v1/invitations/accept',
          ]),
        );
        expect(
          body.components.schemas.OrganizationResponseDto.properties,
        ).toHaveProperty('currentUserCapabilities');
      });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({
      where: {
        owner: {
          email: {
            in: [ownerAEmail, ownerBEmail, memberEmail, viewerEmail],
          },
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: { in: [ownerAEmail, ownerBEmail, memberEmail, viewerEmail] },
      },
    });
    await app.close();
  });

  async function createUser(
    email: string,
    sequence: number,
    verified: boolean,
  ): Promise<{ id: string; email: string }> {
    return prisma.user.create({
      data: {
        email,
        displayName: `Organization Test User ${sequence}`,
        emailVerifiedAt: verified ? new Date() : null,
      },
      select: { id: true, email: true },
    });
  }
});
