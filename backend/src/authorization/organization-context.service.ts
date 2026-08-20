import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { MembershipRole } from '../generated/prisma/enums';

export interface OrganizationContext {
  membershipId: string;
  role: MembershipRole;
  organization: {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    owner: {
      id: string;
      email: string;
      displayName: string | null;
      avatarUrl: string | null;
    };
    _count: { memberships: number };
  };
}

@Injectable()
export class OrganizationContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationContext> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId,
        organization: { deletedAt: null },
      },
      select: {
        id: true,
        role: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            ownerId: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
            owner: {
              select: {
                id: true,
                email: true,
                displayName: true,
                avatarUrl: true,
              },
            },
            _count: { select: { memberships: true } },
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Organization not found');
    }

    return {
      membershipId: membership.id,
      role: membership.role,
      organization: membership.organization,
    };
  }

  async findMembershipById(organizationId: string, membershipId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    return membership;
  }
}
