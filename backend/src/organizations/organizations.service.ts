import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TokenService } from '../auth/token.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { Capability } from '../authorization/capability';
import {
  OrganizationContext,
  OrganizationContextService,
} from '../authorization/organization-context.service';
import { PrismaService } from '../database/prisma.service';
import {
  InjectTransactionalEmailDelivery,
  type TransactionalEmailDelivery,
} from '../email/email.types';
import {
  InvitationStatus,
  MembershipRole,
  NotificationCategory,
  NotificationType,
} from '../generated/prisma/enums';
import { writeNotification } from '../notifications/notification.writer';
import { ORGANIZATION_INVITATION_TTL_DAYS } from './organization.constants';
import {
  AcceptInvitationDto,
  CreateInvitationDto,
  CreateOrganizationDto,
  InvitationListQueryDto,
  PaginationQueryDto,
  TransferOwnershipDto,
  UpdateMembershipRoleDto,
  UpdateOrganizationDto,
} from './dto/organization-request.dto';
import {
  InvitationListResponseDto,
  InvitationResponseDto,
  MembershipListResponseDto,
  MembershipResponseDto,
  OrganizationListResponseDto,
  OrganizationMessageResponseDto,
  OrganizationResponseDto,
  PaginationMetaDto,
} from './dto/organization-response.dto';

interface UserRecord {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface OrganizationRecord {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  owner: UserRecord;
  createdAt: Date;
  updatedAt: Date;
  _count: { memberships: number };
}

interface MembershipRecord {
  id: string;
  organizationId: string;
  role: MembershipRole;
  user: UserRecord;
  createdAt: Date;
  updatedAt: Date;
}

interface InvitationRecord {
  id: string;
  organizationId: string;
  email: string;
  role: MembershipRole;
  status: InvitationStatus;
  invitedBy: UserRecord;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: OrganizationContextService,
    private readonly authorizationService: AuthorizationService,
    private readonly tokenService: TokenService,
    @InjectTransactionalEmailDelivery()
    private readonly delivery: TransactionalEmailDelivery,
  ) {}

  async createOrganization(
    user: AuthenticatedUser,
    dto: CreateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    this.requireVerifiedEmail(user);
    const baseSlug = this.slugify(dto.name);

    for (let suffix = 1; suffix <= 100; suffix += 1) {
      const slug = this.slugWithSuffix(baseSlug, suffix);

      try {
        const result = await this.prisma.$transaction(async (transaction) => {
          const organization = await transaction.organization.create({
            data: { name: dto.name, slug, ownerId: user.id },
            select: this.organizationSelection,
          });
          const membership = await transaction.membership.create({
            data: {
              organizationId: organization.id,
              userId: user.id,
              role: MembershipRole.OWNER,
            },
            select: { id: true, role: true },
          });

          return {
            organization: {
              ...organization,
              _count: { memberships: 1 },
            },
            membership,
          };
        });

        return this.toOrganizationResponse(
          result.organization,
          result.membership.id,
          result.membership.role,
        );
      } catch (error: unknown) {
        if (this.isUniqueConstraintError(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new ConflictException('A unique organization slug is unavailable');
  }

  async listOrganizations(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<OrganizationListResponseDto> {
    const where = {
      userId,
      organization: { deletedAt: null },
    } as const;
    const [memberships, total] = await this.prisma.$transaction([
      this.prisma.membership.findMany({
        where,
        orderBy: [{ organization: { createdAt: 'desc' } }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          role: true,
          organization: { select: this.organizationSelection },
        },
      }),
      this.prisma.membership.count({ where }),
    ]);

    return {
      items: memberships.map((membership) =>
        this.toOrganizationResponse(
          membership.organization,
          membership.id,
          membership.role,
        ),
      ),
      pagination: this.pagination(query, total),
    };
  }

  getOrganization(context: OrganizationContext): OrganizationResponseDto {
    return this.toOrganizationResponse(
      context.organization,
      context.membershipId,
      context.role,
    );
  }

  async updateOrganization(
    context: OrganizationContext,
    dto: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    const organization = await this.prisma.organization.update({
      where: { id: context.organization.id },
      data: { name: dto.name },
      select: this.organizationSelection,
    });

    return this.toOrganizationResponse(
      organization,
      context.membershipId,
      context.role,
    );
  }

  async deleteOrganization(
    context: OrganizationContext,
  ): Promise<OrganizationMessageResponseDto> {
    const organizationId = context.organization.id;
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.invitation.updateMany({
        where: {
          organizationId,
          status: InvitationStatus.PENDING,
        },
        data: {
          status: InvitationStatus.REVOKED,
          revokedAt: now,
        },
      }),
      this.prisma.organization.update({
        where: { id: organizationId },
        data: { deletedAt: now },
      }),
    ]);

    return { message: 'Organization deleted' };
  }

  async createInvitation(
    context: OrganizationContext,
    userId: string,
    dto: CreateInvitationDto,
  ): Promise<InvitationResponseDto> {
    const organizationId = context.organization.id;
    this.authorizationService.assertCanAssignMembershipRole(
      context.role,
      dto.role,
    );
    const email = this.normalizeEmail(dto.email);

    await this.expireInvitations(organizationId, email);

    const existingMembership = await this.prisma.membership.findFirst({
      where: { organizationId, user: { email } },
      select: { id: true },
    });

    if (existingMembership) {
      throw new ConflictException(
        'This user is already an organization member',
      );
    }

    const token = this.tokenService.createOpaqueToken();
    let invitation: InvitationRecord;

    try {
      invitation = await this.prisma.invitation.create({
        data: {
          organizationId,
          invitedById: userId,
          email,
          role: dto.role,
          tokenHash: this.tokenService.hashOpaqueToken(token),
          expiresAt: this.invitationExpiration(),
        },
        select: this.invitationSelection,
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A pending invitation already exists for this email',
        );
      }

      throw error;
    }

    await this.delivery.sendOrganizationInvitation(
      invitation.email,
      token,
      context.organization.name,
    );

    return this.toInvitationResponse(invitation);
  }

  async listInvitations(
    context: OrganizationContext,
    query: InvitationListQueryDto,
  ): Promise<InvitationListResponseDto> {
    const organizationId = context.organization.id;
    await this.expireInvitations(organizationId);

    const where = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [invitations, total] = await this.prisma.$transaction([
      this.prisma.invitation.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: this.invitationSelection,
      }),
      this.prisma.invitation.count({ where }),
    ]);

    return {
      items: invitations.map((invitation) =>
        this.toInvitationResponse(invitation),
      ),
      pagination: this.pagination(query, total),
    };
  }

  async resendInvitation(
    context: OrganizationContext,
    invitationId: string,
    userId: string,
  ): Promise<InvitationResponseDto> {
    const organizationId = context.organization.id;
    await this.expireInvitations(organizationId);
    const existing = await this.findInvitation(organizationId, invitationId);
    this.authorizationService.assertCanAssignMembershipRole(
      context.role,
      existing.role,
    );

    if (
      existing.status === InvitationStatus.ACCEPTED ||
      existing.status === InvitationStatus.REVOKED
    ) {
      throw new ConflictException('This invitation cannot be resent');
    }

    const conflictingInvitation = await this.prisma.invitation.findFirst({
      where: {
        organizationId,
        email: existing.email,
        status: InvitationStatus.PENDING,
        id: { not: invitationId },
      },
      select: { id: true },
    });

    if (conflictingInvitation) {
      throw new ConflictException(
        'A pending invitation already exists for this email',
      );
    }

    const token = this.tokenService.createOpaqueToken();
    const invitation = await this.prisma.invitation.update({
      where: { id: invitationId },
      data: {
        invitedById: userId,
        status: InvitationStatus.PENDING,
        tokenHash: this.tokenService.hashOpaqueToken(token),
        expiresAt: this.invitationExpiration(),
        acceptedAt: null,
        acceptedById: null,
        revokedAt: null,
      },
      select: this.invitationSelection,
    });

    await this.delivery.sendOrganizationInvitation(
      invitation.email,
      token,
      context.organization.name,
    );

    return this.toInvitationResponse(invitation);
  }

  async revokeInvitation(
    context: OrganizationContext,
    invitationId: string,
  ): Promise<OrganizationMessageResponseDto> {
    const organizationId = context.organization.id;
    await this.expireInvitations(organizationId);
    const invitation = await this.findInvitation(organizationId, invitationId);
    this.authorizationService.assertCanAssignMembershipRole(
      context.role,
      invitation.role,
    );

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictException('Only pending invitations can be revoked');
    }

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: {
        status: InvitationStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    return { message: 'Invitation revoked' };
  }

  async acceptInvitation(
    user: AuthenticatedUser,
    dto: AcceptInvitationDto,
  ): Promise<MembershipResponseDto> {
    this.requireVerifiedEmail(user);
    const tokenHash = this.tokenService.hashOpaqueToken(dto.token);
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
      include: { organization: true },
    });

    if (!invitation) {
      throw new BadRequestException('Invalid invitation token');
    }

    if (
      invitation.organization.deletedAt !== null ||
      invitation.status === InvitationStatus.REVOKED
    ) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new ConflictException('Invitation has already been accepted');
    }

    if (
      invitation.status === InvitationStatus.EXPIRED ||
      invitation.expiresAt.getTime() <= Date.now()
    ) {
      await this.prisma.invitation.updateMany({
        where: { id: invitation.id, status: InvitationStatus.PENDING },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new GoneException('Invitation has expired');
    }

    if (invitation.email !== this.normalizeEmail(user.email)) {
      throw new ForbiddenException(
        'Invitation email does not match the authenticated user',
      );
    }

    const membership = await this.prisma.$transaction(async (transaction) => {
      const existingMembership = await transaction.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId: user.id,
          },
        },
        select: { id: true },
      });

      if (existingMembership) {
        throw new ConflictException(
          'This user is already an organization member',
        );
      }

      const accepted = await transaction.invitation.updateMany({
        where: {
          id: invitation.id,
          status: InvitationStatus.PENDING,
          expiresAt: { gt: new Date() },
        },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedById: user.id,
          acceptedAt: new Date(),
        },
      });

      if (accepted.count !== 1) {
        throw new ConflictException('Invitation is no longer available');
      }

      const membership = await transaction.membership.create({
        data: {
          organizationId: invitation.organizationId,
          userId: user.id,
          role: invitation.role,
        },
        select: this.membershipSelection,
      });
      await writeNotification(transaction, {
        userId: invitation.organization.ownerId,
        organizationId: invitation.organizationId,
        category: NotificationCategory.ORGANIZATION,
        type: NotificationType.ORGANIZATION_INVITATION_ACCEPTED,
        title: 'Invitation accepted',
        message: `A new member joined ${invitation.organization.name}.`,
        dedupeKey: `invitation-accepted:${invitation.id}`,
        metadata: {
          invitationId: invitation.id,
          membershipId: membership.id,
          memberUserId: user.id,
          role: membership.role,
        },
      });
      return membership;
    });

    return this.toMembershipResponse(membership);
  }

  async listMembers(
    context: OrganizationContext,
    query: PaginationQueryDto,
  ): Promise<MembershipListResponseDto> {
    const organizationId = context.organization.id;
    const where = { organizationId };
    const [memberships, total] = await this.prisma.$transaction([
      this.prisma.membership.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: this.membershipSelection,
      }),
      this.prisma.membership.count({ where }),
    ]);

    return {
      items: memberships.map((membership) =>
        this.toMembershipResponse(membership),
      ),
      pagination: this.pagination(query, total),
    };
  }

  async updateMemberRole(
    context: OrganizationContext,
    membershipId: string,
    dto: UpdateMembershipRoleDto,
  ): Promise<MembershipResponseDto> {
    const organizationId = context.organization.id;
    const target = await this.contextService.findMembershipById(
      organizationId,
      membershipId,
    );
    this.authorizationService.assertCanManageMembership(
      context.role,
      context.membershipId,
      target.id,
      target.role,
      Capability.MEMBERSHIP_CHANGE_ROLE,
    );
    this.authorizationService.assertCanAssignMembershipRole(
      context.role,
      dto.role,
    );

    const operationId = randomUUID();
    const membership = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.membership.update({
        where: { id: membershipId },
        data: { role: dto.role },
        select: this.membershipSelection,
      });
      const notification = {
        organizationId,
        category: NotificationCategory.ORGANIZATION,
        type: NotificationType.ORGANIZATION_ROLE_CHANGED,
        title: 'Organization role changed',
        message: `Your role in ${context.organization.name} is now ${dto.role.toLowerCase()}.`,
        dedupeKey: `role-changed:${operationId}`,
        metadata: { membershipId, role: dto.role },
      } as const;
      await writeNotification(transaction, {
        ...notification,
        userId: target.userId,
      });
      if (
        context.role !== MembershipRole.OWNER &&
        context.organization.ownerId !== target.userId
      ) {
        await writeNotification(transaction, {
          ...notification,
          userId: context.organization.ownerId,
          message: `A member role in ${context.organization.name} was changed to ${dto.role.toLowerCase()}.`,
        });
      }
      return updated;
    });

    return this.toMembershipResponse(membership);
  }

  async removeMember(
    context: OrganizationContext,
    membershipId: string,
  ): Promise<OrganizationMessageResponseDto> {
    const organizationId = context.organization.id;
    const target = await this.contextService.findMembershipById(
      organizationId,
      membershipId,
    );
    this.authorizationService.assertCanManageMembership(
      context.role,
      context.membershipId,
      target.id,
      target.role,
      Capability.MEMBERSHIP_REMOVE,
    );

    const operationId = randomUUID();
    await this.prisma.$transaction(async (transaction) => {
      await transaction.membership.delete({ where: { id: membershipId } });
      const notification = {
        organizationId,
        category: NotificationCategory.ORGANIZATION,
        type: NotificationType.ORGANIZATION_MEMBER_REMOVED,
        title: 'Organization membership removed',
        message: `Your membership in ${context.organization.name} was removed.`,
        dedupeKey: `member-removed:${operationId}`,
        metadata: { membershipId },
      } as const;
      await writeNotification(transaction, {
        ...notification,
        userId: target.userId,
      });
      if (
        context.role !== MembershipRole.OWNER &&
        context.organization.ownerId !== target.userId
      ) {
        await writeNotification(transaction, {
          ...notification,
          userId: context.organization.ownerId,
          message: `A member was removed from ${context.organization.name}.`,
        });
      }
    });
    return { message: 'Member removed' };
  }

  async leaveOrganization(
    context: OrganizationContext,
  ): Promise<OrganizationMessageResponseDto> {
    this.authorizationService.assertCanLeaveOrganization(context.role);
    await this.prisma.membership.delete({
      where: { id: context.membershipId },
    });
    return { message: 'Organization left' };
  }

  async transferOwnership(
    context: OrganizationContext,
    userId: string,
    dto: TransferOwnershipDto,
  ): Promise<OrganizationResponseDto> {
    const organizationId = context.organization.id;
    const target = await this.contextService.findMembershipById(
      organizationId,
      dto.membershipId,
    );

    if (target.userId === userId) {
      throw new BadRequestException(
        'The target member already owns this organization',
      );
    }

    const operationId = randomUUID();
    await this.prisma.$transaction(async (transaction) => {
      await transaction.membership.update({
        where: { id: context.membershipId },
        data: { role: MembershipRole.ADMIN },
      });
      await transaction.membership.update({
        where: { id: target.id },
        data: { role: MembershipRole.OWNER },
      });
      await transaction.organization.update({
        where: { id: organizationId },
        data: { ownerId: target.userId },
      });
      await writeNotification(transaction, {
        userId: target.userId,
        organizationId,
        category: NotificationCategory.ORGANIZATION,
        type: NotificationType.ORGANIZATION_OWNERSHIP_TRANSFERRED,
        title: 'Organization ownership transferred',
        message: `You are now the Owner of ${context.organization.name}.`,
        dedupeKey: `ownership-transferred:${operationId}`,
        metadata: { previousOwnerUserId: userId },
      });
    });

    const updatedContext = await this.contextService.resolve(
      organizationId,
      userId,
    );
    return this.getOrganization(updatedContext);
  }

  private requireVerifiedEmail(user: AuthenticatedUser): void {
    if (!user.emailVerified) {
      throw new ForbiddenException('Email verification is required');
    }
  }

  private async expireInvitations(
    organizationId: string,
    email?: string,
  ): Promise<void> {
    await this.prisma.invitation.updateMany({
      where: {
        organizationId,
        status: InvitationStatus.PENDING,
        expiresAt: { lte: new Date() },
        ...(email ? { email } : {}),
      },
      data: { status: InvitationStatus.EXPIRED },
    });
  }

  private async findInvitation(
    organizationId: string,
    invitationId: string,
  ): Promise<InvitationRecord> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId },
      select: this.invitationSelection,
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    return invitation;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private slugify(name: string): string {
    const slug = name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return slug || 'organization';
  }

  private slugWithSuffix(baseSlug: string, suffix: number): string {
    const suffixText = suffix === 1 ? '' : `-${suffix}`;
    return `${baseSlug.slice(0, 63 - suffixText.length).replace(/-+$/g, '')}${suffixText}`;
  }

  private invitationExpiration(): Date {
    return new Date(
      Date.now() + ORGANIZATION_INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
  }

  private pagination(
    query: PaginationQueryDto,
    total: number,
  ): PaginationMetaDto {
    return {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    };
  }

  private toOrganizationResponse(
    organization: OrganizationRecord,
    membershipId: string,
    currentUserRole: MembershipRole,
  ): OrganizationResponseDto {
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      ownerId: organization.ownerId,
      owner: organization.owner,
      membershipId,
      currentUserRole,
      currentUserCapabilities:
        this.authorizationService.capabilitiesFor(currentUserRole),
      memberCount: organization._count.memberships,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    };
  }

  private toMembershipResponse(
    membership: MembershipRecord,
  ): MembershipResponseDto {
    return {
      id: membership.id,
      organizationId: membership.organizationId,
      role: membership.role,
      user: membership.user,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
    };
  }

  private toInvitationResponse(
    invitation: InvitationRecord,
  ): InvitationResponseDto {
    return {
      id: invitation.id,
      organizationId: invitation.organizationId,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      invitedBy: invitation.invitedBy,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      revokedAt: invitation.revokedAt,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private readonly userSelection = {
    id: true,
    email: true,
    displayName: true,
    avatarUrl: true,
  } as const;

  private readonly organizationSelection = {
    id: true,
    name: true,
    slug: true,
    ownerId: true,
    createdAt: true,
    updatedAt: true,
    owner: { select: this.userSelection },
    _count: { select: { memberships: true } },
  } as const;

  private readonly membershipSelection = {
    id: true,
    organizationId: true,
    role: true,
    createdAt: true,
    updatedAt: true,
    user: { select: this.userSelection },
  } as const;

  private readonly invitationSelection = {
    id: true,
    organizationId: true,
    email: true,
    role: true,
    status: true,
    expiresAt: true,
    acceptedAt: true,
    revokedAt: true,
    createdAt: true,
    updatedAt: true,
    invitedBy: { select: this.userSelection },
  } as const;
}
