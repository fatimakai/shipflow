import { apiClient } from "@/api/api-client"
import type {
  AcceptInvitationDto,
  CreateInvitationDto,
  CreateOrganizationDto,
  InvitationListResponseDto,
  InvitationResponseDto,
  MembershipListResponseDto,
  MembershipResponseDto,
  OrganizationListResponseDto,
  OrganizationMessageResponseDto,
  OrganizationResponseDto,
  TransferOwnershipDto,
  UpdateMembershipRoleDto,
  UpdateOrganizationDto,
} from "@/api/generated"

function organizationPath(organizationId: string) {
  return `/organizations/${encodeURIComponent(organizationId)}`
}

export const organizationApi = {
  acceptInvitation: (body: AcceptInvitationDto) =>
    apiClient.post<MembershipResponseDto>("/invitations/accept", {
      auth: true,
      json: body,
    }),
  create: (body: CreateOrganizationDto) =>
    apiClient.post<OrganizationResponseDto>("/organizations", {
      auth: true,
      json: body,
    }),
  createInvitation: (organizationId: string, body: CreateInvitationDto) =>
    apiClient.post<InvitationResponseDto>(
      `${organizationPath(organizationId)}/invitations`,
      { auth: true, json: body }
    ),
  delete: (organizationId: string) =>
    apiClient.delete<OrganizationMessageResponseDto>(
      organizationPath(organizationId),
      { auth: true }
    ),
  get: (organizationId: string) =>
    apiClient.get<OrganizationResponseDto>(organizationPath(organizationId), {
      auth: true,
    }),
  leave: (organizationId: string) =>
    apiClient.post<OrganizationMessageResponseDto>(
      `${organizationPath(organizationId)}/leave`,
      { auth: true }
    ),
  list: (page = 1, limit = 100) =>
    apiClient.get<OrganizationListResponseDto>(
      `/organizations?page=${page}&limit=${limit}`,
      { auth: true }
    ),
  listInvitations: (organizationId: string, page = 1, limit = 100) =>
    apiClient.get<InvitationListResponseDto>(
      `${organizationPath(organizationId)}/invitations?page=${page}&limit=${limit}&status=PENDING`,
      { auth: true }
    ),
  listMembers: (organizationId: string, page = 1, limit = 100) =>
    apiClient.get<MembershipListResponseDto>(
      `${organizationPath(organizationId)}/members?page=${page}&limit=${limit}`,
      { auth: true }
    ),
  removeMember: (organizationId: string, membershipId: string) =>
    apiClient.delete<OrganizationMessageResponseDto>(
      `${organizationPath(organizationId)}/members/${encodeURIComponent(membershipId)}`,
      { auth: true }
    ),
  resendInvitation: (organizationId: string, invitationId: string) =>
    apiClient.post<InvitationResponseDto>(
      `${organizationPath(organizationId)}/invitations/${encodeURIComponent(invitationId)}/resend`,
      { auth: true }
    ),
  revokeInvitation: (organizationId: string, invitationId: string) =>
    apiClient.delete<OrganizationMessageResponseDto>(
      `${organizationPath(organizationId)}/invitations/${encodeURIComponent(invitationId)}`,
      { auth: true }
    ),
  transferOwnership: (organizationId: string, body: TransferOwnershipDto) =>
    apiClient.post<OrganizationResponseDto>(
      `${organizationPath(organizationId)}/ownership-transfer`,
      { auth: true, json: body }
    ),
  update: (organizationId: string, body: UpdateOrganizationDto) =>
    apiClient.patch<OrganizationResponseDto>(organizationPath(organizationId), {
      auth: true,
      json: body,
    }),
  updateMemberRole: (
    organizationId: string,
    membershipId: string,
    body: UpdateMembershipRoleDto
  ) =>
    apiClient.patch<MembershipResponseDto>(
      `${organizationPath(organizationId)}/members/${encodeURIComponent(membershipId)}`,
      { auth: true, json: body }
    ),
}
