import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { MembershipRole } from '../generated/prisma/enums';
import { Capability } from './capability';

const ownerCapabilities = Object.values(Capability);

export const ROLE_CAPABILITIES: Readonly<
  Record<MembershipRole, readonly Capability[]>
> = Object.freeze({
  [MembershipRole.OWNER]: Object.freeze(ownerCapabilities),
  [MembershipRole.ADMIN]: Object.freeze([
    Capability.ORGANIZATION_READ,
    Capability.ORGANIZATION_UPDATE,
    Capability.ORGANIZATION_LEAVE,
    Capability.MEMBERSHIP_READ,
    Capability.MEMBERSHIP_CHANGE_ROLE,
    Capability.MEMBERSHIP_REMOVE,
    Capability.INVITATION_READ,
    Capability.INVITATION_CREATE,
    Capability.INVITATION_RESEND,
    Capability.INVITATION_REVOKE,
    Capability.NOTIFICATION_READ,
    Capability.NOTIFICATION_MANAGE,
    Capability.FILE_READ,
    Capability.FILE_UPLOAD,
    Capability.FILE_DELETE,
  ]),
  [MembershipRole.MEMBER]: Object.freeze([
    Capability.ORGANIZATION_READ,
    Capability.ORGANIZATION_LEAVE,
    Capability.MEMBERSHIP_READ,
    Capability.NOTIFICATION_READ,
    Capability.NOTIFICATION_MANAGE,
    Capability.FILE_READ,
    Capability.FILE_UPLOAD,
    Capability.FILE_DELETE,
  ]),
  [MembershipRole.VIEWER]: Object.freeze([
    Capability.ORGANIZATION_READ,
    Capability.ORGANIZATION_LEAVE,
    Capability.MEMBERSHIP_READ,
    Capability.NOTIFICATION_READ,
    Capability.NOTIFICATION_MANAGE,
    Capability.FILE_READ,
  ]),
});

@Injectable()
export class AuthorizationService {
  capabilitiesFor(role: MembershipRole): Capability[] {
    return [...ROLE_CAPABILITIES[role]];
  }

  hasCapability(role: MembershipRole, capability: Capability): boolean {
    return ROLE_CAPABILITIES[role].includes(capability);
  }

  assertCapabilities(
    role: MembershipRole,
    capabilities: readonly Capability[],
  ): void {
    if (
      capabilities.some((capability) => !this.hasCapability(role, capability))
    ) {
      throw new ForbiddenException(
        'Required organization capability is missing',
      );
    }
  }

  assertCanAssignMembershipRole(
    actorRole: MembershipRole,
    assignedRole: MembershipRole,
  ): void {
    const ownerCanAssign =
      actorRole === MembershipRole.OWNER &&
      assignedRole !== MembershipRole.OWNER;
    const adminCanAssign =
      actorRole === MembershipRole.ADMIN &&
      (assignedRole === MembershipRole.MEMBER ||
        assignedRole === MembershipRole.VIEWER);

    if (!ownerCanAssign && !adminCanAssign) {
      throw new ForbiddenException('This membership role cannot be assigned');
    }
  }

  assertCanManageMembership(
    actorRole: MembershipRole,
    actorMembershipId: string,
    targetMembershipId: string,
    targetRole: MembershipRole,
    capability:
      Capability.MEMBERSHIP_CHANGE_ROLE | Capability.MEMBERSHIP_REMOVE,
  ): void {
    this.assertCapabilities(actorRole, [capability]);

    if (targetRole === MembershipRole.OWNER) {
      throw new ConflictException(
        'Ownership must be changed through an ownership transfer',
      );
    }

    if (actorMembershipId === targetMembershipId) {
      throw new BadRequestException(
        'Use the leave endpoint for your membership',
      );
    }

    if (
      actorRole === MembershipRole.ADMIN &&
      targetRole === MembershipRole.ADMIN
    ) {
      throw new ForbiddenException('Admins cannot manage other admins');
    }
  }

  assertCanLeaveOrganization(role: MembershipRole): void {
    this.assertCapabilities(role, [Capability.ORGANIZATION_LEAVE]);

    if (role === MembershipRole.OWNER) {
      throw new ConflictException(
        'Transfer ownership before leaving the organization',
      );
    }
  }
}
