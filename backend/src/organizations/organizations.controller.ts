import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  CurrentOrganizationContext,
  RequireOrganizationCapabilities,
} from '../authorization/authorization.decorators';
import type { OrganizationContext } from '../authorization/organization-context.service';
import { Capability } from '../authorization/capability';
import { API_VERSION } from '../common/http/api.constants';
import { ApiStandardErrors } from '../common/http/decorators/api-standard-errors.decorator';
import { ApiErrorResponseDto } from '../common/http/dto/api-error-response.dto';
import {
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
} from './dto/organization-response.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('Organizations')
@ApiBearerAuth('access-token')
@ApiStandardErrors()
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@ApiForbiddenResponse({ type: ApiErrorResponseDto })
@ApiNotFoundResponse({ type: ApiErrorResponseDto })
@UseGuards(AccessTokenGuard)
@Controller({ path: 'organizations', version: API_VERSION })
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an organization and Owner membership' })
  @ApiCreatedResponse({ type: OrganizationResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  createOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    return this.organizationsService.createOrganization(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List organizations for the current user' })
  @ApiOkResponse({ type: OrganizationListResponseDto })
  listOrganizations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<OrganizationListResponseDto> {
    return this.organizationsService.listOrganizations(user.id, query);
  }

  @Get(':organizationId')
  @RequireOrganizationCapabilities(Capability.ORGANIZATION_READ)
  @ApiOperation({ summary: 'Get an organization in the current user context' })
  @ApiOkResponse({ type: OrganizationResponseDto })
  getOrganization(
    @CurrentOrganizationContext() context: OrganizationContext,
  ): OrganizationResponseDto {
    return this.organizationsService.getOrganization(context);
  }

  @Patch(':organizationId')
  @RequireOrganizationCapabilities(Capability.ORGANIZATION_UPDATE)
  @ApiOperation({ summary: 'Update an organization name' })
  @ApiOkResponse({ type: OrganizationResponseDto })
  updateOrganization(
    @CurrentOrganizationContext() context: OrganizationContext,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    return this.organizationsService.updateOrganization(context, dto);
  }

  @Delete(':organizationId')
  @RequireOrganizationCapabilities(Capability.ORGANIZATION_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete an organization' })
  @ApiOkResponse({ type: OrganizationMessageResponseDto })
  deleteOrganization(
    @CurrentOrganizationContext() context: OrganizationContext,
  ): Promise<OrganizationMessageResponseDto> {
    return this.organizationsService.deleteOrganization(context);
  }

  @Post(':organizationId/invitations')
  @RequireOrganizationCapabilities(Capability.INVITATION_CREATE)
  @ApiOperation({ summary: 'Invite a user to an organization' })
  @ApiCreatedResponse({ type: InvitationResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  createInvitation(
    @CurrentOrganizationContext() context: OrganizationContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInvitationDto,
  ): Promise<InvitationResponseDto> {
    return this.organizationsService.createInvitation(context, user.id, dto);
  }

  @Get(':organizationId/invitations')
  @RequireOrganizationCapabilities(Capability.INVITATION_READ)
  @ApiOperation({ summary: 'List organization invitations' })
  @ApiOkResponse({ type: InvitationListResponseDto })
  listInvitations(
    @CurrentOrganizationContext() context: OrganizationContext,
    @Query() query: InvitationListQueryDto,
  ): Promise<InvitationListResponseDto> {
    return this.organizationsService.listInvitations(context, query);
  }

  @Post(':organizationId/invitations/:invitationId/resend')
  @RequireOrganizationCapabilities(Capability.INVITATION_RESEND)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate and resend an organization invitation' })
  @ApiOkResponse({ type: InvitationResponseDto })
  resendInvitation(
    @CurrentOrganizationContext() context: OrganizationContext,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InvitationResponseDto> {
    return this.organizationsService.resendInvitation(
      context,
      invitationId,
      user.id,
    );
  }

  @Delete(':organizationId/invitations/:invitationId')
  @RequireOrganizationCapabilities(Capability.INVITATION_REVOKE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a pending organization invitation' })
  @ApiOkResponse({ type: OrganizationMessageResponseDto })
  revokeInvitation(
    @CurrentOrganizationContext() context: OrganizationContext,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<OrganizationMessageResponseDto> {
    return this.organizationsService.revokeInvitation(context, invitationId);
  }

  @Get(':organizationId/members')
  @RequireOrganizationCapabilities(Capability.MEMBERSHIP_READ)
  @ApiOperation({ summary: 'List organization members' })
  @ApiOkResponse({ type: MembershipListResponseDto })
  listMembers(
    @CurrentOrganizationContext() context: OrganizationContext,
    @Query() query: PaginationQueryDto,
  ): Promise<MembershipListResponseDto> {
    return this.organizationsService.listMembers(context, query);
  }

  @Patch(':organizationId/members/:membershipId')
  @RequireOrganizationCapabilities(Capability.MEMBERSHIP_CHANGE_ROLE)
  @ApiOperation({ summary: 'Update an organization member role' })
  @ApiOkResponse({ type: MembershipResponseDto })
  updateMemberRole(
    @CurrentOrganizationContext() context: OrganizationContext,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() dto: UpdateMembershipRoleDto,
  ): Promise<MembershipResponseDto> {
    return this.organizationsService.updateMemberRole(
      context,
      membershipId,
      dto,
    );
  }

  @Delete(':organizationId/members/:membershipId')
  @RequireOrganizationCapabilities(Capability.MEMBERSHIP_REMOVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a member from an organization' })
  @ApiOkResponse({ type: OrganizationMessageResponseDto })
  removeMember(
    @CurrentOrganizationContext() context: OrganizationContext,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
  ): Promise<OrganizationMessageResponseDto> {
    return this.organizationsService.removeMember(context, membershipId);
  }

  @Post(':organizationId/leave')
  @RequireOrganizationCapabilities(Capability.ORGANIZATION_LEAVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Leave an organization' })
  @ApiOkResponse({ type: OrganizationMessageResponseDto })
  leaveOrganization(
    @CurrentOrganizationContext() context: OrganizationContext,
  ): Promise<OrganizationMessageResponseDto> {
    return this.organizationsService.leaveOrganization(context);
  }

  @Post(':organizationId/ownership-transfer')
  @RequireOrganizationCapabilities(Capability.OWNERSHIP_TRANSFER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer organization ownership to a member' })
  @ApiOkResponse({ type: OrganizationResponseDto })
  transferOwnership(
    @CurrentOrganizationContext() context: OrganizationContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TransferOwnershipDto,
  ): Promise<OrganizationResponseDto> {
    return this.organizationsService.transferOwnership(context, user.id, dto);
  }
}
