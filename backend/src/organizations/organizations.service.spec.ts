import type { ConfigService } from '@nestjs/config';
import type { TokenService } from '../auth/token.service';
import type { AuthorizationService } from '../authorization/authorization.service';
import type {
  OrganizationContext,
  OrganizationContextService,
} from '../authorization/organization-context.service';
import type { EnvironmentVariables } from '../config/env.validation';
import type { PrismaService } from '../database/prisma.service';
import type { TransactionalEmailDelivery } from '../email/email.types';
import { InvitationStatus, MembershipRole } from '../generated/prisma/enums';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService public demo invitations', () => {
  const invitation = {
    id: 'afeddf7d-2f95-4f05-b6a8-e84f52342b84',
    organizationId: '2b79506f-2c3c-4785-bd5e-e226e029fb64',
    email: 'member@example.com',
    role: MembershipRole.MEMBER,
    status: InvitationStatus.PENDING,
    invitedBy: {
      id: '8558e666-aabe-41cf-84ef-d32fb7bf6993',
      email: 'owner@example.com',
      displayName: 'Owner',
      avatarUrl: null,
    },
    expiresAt: new Date('2030-01-08T00:00:00.000Z'),
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
  };
  const context = {
    organization: {
      id: invitation.organizationId,
      name: 'Demo organization',
    },
    role: MembershipRole.OWNER,
  } as OrganizationContext;

  const createService = (profile: 'standard' | 'public-demo') => {
    const prisma = {
      invitation: {
        create: jest.fn().mockResolvedValue(invitation),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      membership: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const delivery = {
      sendOrganizationInvitation: jest.fn().mockResolvedValue({}),
    };
    const config = {
      getOrThrow: jest.fn((key: keyof EnvironmentVariables) =>
        key === 'DEPLOYMENT_PROFILE' ? profile : 'https://shipflow.pages.dev',
      ),
    };
    const service = new OrganizationsService(
      prisma as unknown as PrismaService,
      {} as OrganizationContextService,
      {
        assertCanAssignMembershipRole: jest.fn(),
      } as unknown as AuthorizationService,
      {
        createOpaqueToken: jest.fn().mockReturnValue('single-use-token'),
        hashOpaqueToken: jest.fn().mockReturnValue('token-hash'),
      } as unknown as TokenService,
      config as unknown as ConfigService<EnvironmentVariables, true>,
      delivery as unknown as TransactionalEmailDelivery,
    );
    return { delivery, service };
  };

  it('returns a single-display link and does not send email in public demo mode', async () => {
    const { delivery, service } = createService('public-demo');

    const result = await service.createInvitation(
      context,
      invitation.invitedBy.id,
      { email: invitation.email, role: MembershipRole.MEMBER },
    );

    expect(result.invitationUrl).toBe(
      'https://shipflow.pages.dev/invitations/accept?token=single-use-token',
    );
    expect(delivery.sendOrganizationInvitation).not.toHaveBeenCalled();
  });

  it('keeps email delivery and omits the token in the standard profile', async () => {
    const { delivery, service } = createService('standard');

    const result = await service.createInvitation(
      context,
      invitation.invitedBy.id,
      { email: invitation.email, role: MembershipRole.MEMBER },
    );

    expect(result.invitationUrl).toBeUndefined();
    expect(delivery.sendOrganizationInvitation).toHaveBeenCalledWith(
      invitation.email,
      'single-use-token',
      context.organization.name,
    );
  });
});
