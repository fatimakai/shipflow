import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { MembershipRole } from '../generated/prisma/enums';
import { AuthorizationService } from './authorization.service';
import { Capability } from './capability';

const expectedCapabilities: Record<MembershipRole, ReadonlySet<Capability>> = {
  [MembershipRole.OWNER]: new Set(Object.values(Capability)),
  [MembershipRole.ADMIN]: new Set([
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
  [MembershipRole.MEMBER]: new Set([
    Capability.ORGANIZATION_READ,
    Capability.ORGANIZATION_LEAVE,
    Capability.MEMBERSHIP_READ,
    Capability.NOTIFICATION_READ,
    Capability.NOTIFICATION_MANAGE,
    Capability.FILE_READ,
    Capability.FILE_UPLOAD,
    Capability.FILE_DELETE,
  ]),
  [MembershipRole.VIEWER]: new Set([
    Capability.ORGANIZATION_READ,
    Capability.ORGANIZATION_LEAVE,
    Capability.MEMBERSHIP_READ,
    Capability.NOTIFICATION_READ,
    Capability.NOTIFICATION_MANAGE,
    Capability.FILE_READ,
  ]),
};

const matrixCases = Object.values(MembershipRole).flatMap((role) =>
  Object.values(Capability).map((capability) => ({
    role,
    capability,
    allowed: expectedCapabilities[role].has(capability),
  })),
);

describe('AuthorizationService', () => {
  const service = new AuthorizationService();

  it.each(matrixCases)(
    'maps $role and $capability to $allowed',
    ({ role, capability, allowed }) => {
      expect(service.hasCapability(role, capability)).toBe(allowed);

      if (allowed) {
        expect(() =>
          service.assertCapabilities(role, [capability]),
        ).not.toThrow();
      } else {
        expect(() => service.assertCapabilities(role, [capability])).toThrow(
          ForbiddenException,
        );
      }
    },
  );

  it('returns a defensive capability list', () => {
    const capabilities = service.capabilitiesFor(MembershipRole.ADMIN);
    capabilities.length = 0;

    expect(service.capabilitiesFor(MembershipRole.ADMIN)).toHaveLength(
      expectedCapabilities[MembershipRole.ADMIN].size,
    );
  });

  it.each([
    [MembershipRole.OWNER, MembershipRole.ADMIN],
    [MembershipRole.OWNER, MembershipRole.MEMBER],
    [MembershipRole.OWNER, MembershipRole.VIEWER],
    [MembershipRole.ADMIN, MembershipRole.MEMBER],
    [MembershipRole.ADMIN, MembershipRole.VIEWER],
  ])('allows %s to assign %s', (actorRole, assignedRole) => {
    expect(() =>
      service.assertCanAssignMembershipRole(actorRole, assignedRole),
    ).not.toThrow();
  });

  it.each([
    [MembershipRole.OWNER, MembershipRole.OWNER],
    [MembershipRole.ADMIN, MembershipRole.OWNER],
    [MembershipRole.ADMIN, MembershipRole.ADMIN],
    [MembershipRole.MEMBER, MembershipRole.MEMBER],
    [MembershipRole.VIEWER, MembershipRole.VIEWER],
  ])('denies %s assigning %s', (actorRole, assignedRole) => {
    expect(() =>
      service.assertCanAssignMembershipRole(actorRole, assignedRole),
    ).toThrow(ForbiddenException);
  });

  it('allows Owners to manage Admins and Admins to manage ordinary members', () => {
    expect(() =>
      service.assertCanManageMembership(
        MembershipRole.OWNER,
        'owner-membership',
        'admin-membership',
        MembershipRole.ADMIN,
        Capability.MEMBERSHIP_CHANGE_ROLE,
      ),
    ).not.toThrow();
    expect(() =>
      service.assertCanManageMembership(
        MembershipRole.ADMIN,
        'admin-membership',
        'member-membership',
        MembershipRole.MEMBER,
        Capability.MEMBERSHIP_REMOVE,
      ),
    ).not.toThrow();
  });

  it('prevents Admin peer management and direct Owner changes', () => {
    expect(() =>
      service.assertCanManageMembership(
        MembershipRole.ADMIN,
        'admin-one',
        'admin-two',
        MembershipRole.ADMIN,
        Capability.MEMBERSHIP_REMOVE,
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      service.assertCanManageMembership(
        MembershipRole.OWNER,
        'owner-membership',
        'other-owner-membership',
        MembershipRole.OWNER,
        Capability.MEMBERSHIP_CHANGE_ROLE,
      ),
    ).toThrow(ConflictException);
  });

  it('requires the leave endpoint for self-removal', () => {
    expect(() =>
      service.assertCanManageMembership(
        MembershipRole.ADMIN,
        'same-membership',
        'same-membership',
        MembershipRole.ADMIN,
        Capability.MEMBERSHIP_REMOVE,
      ),
    ).toThrow(BadRequestException);
  });

  it('requires an Owner to transfer ownership before leaving', () => {
    expect(() =>
      service.assertCanLeaveOrganization(MembershipRole.OWNER),
    ).toThrow(ConflictException);
    expect(() =>
      service.assertCanLeaveOrganization(MembershipRole.ADMIN),
    ).not.toThrow();
  });
});
