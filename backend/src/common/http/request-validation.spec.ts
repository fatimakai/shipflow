import { getMetadataStorage } from 'class-validator';
import {
  EmailDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  TokenDto,
  TotpCodeDto,
  TwoFactorChallengeDto,
  TwoFactorCodeDto,
  TwoFactorStepUpDto,
  UpdateProfileDto,
} from '../../auth/dto/auth-request.dto';
import { CreateCheckoutSessionDto } from '../../billing/dto/billing-request.dto';
import {
  FileListQueryDto,
  InitiateFileUploadDto,
  SignedFileRequestQueryDto,
} from '../../files/dto/file-request.dto';
import {
  NotificationListQueryDto,
  NotificationOrganizationFilterDto,
  UpdateNotificationPreferenceDto,
} from '../../notifications/dto/notification-request.dto';
import {
  AcceptInvitationDto,
  CreateInvitationDto,
  CreateOrganizationDto,
  InvitationListQueryDto,
  PaginationQueryDto,
  TransferOwnershipDto,
  UpdateMembershipRoleDto,
  UpdateOrganizationDto,
} from '../../organizations/dto/organization-request.dto';

type RequestDto = new () => object;

const requestDtoProperties: Array<[RequestDto, string[]]> = [
  [RegisterDto, ['email', 'password', 'displayName']],
  [LoginDto, ['email', 'password']],
  [UpdateProfileDto, ['displayName']],
  [EmailDto, ['email']],
  [TokenDto, ['token']],
  [ResetPasswordDto, ['token', 'password']],
  [TotpCodeDto, ['code']],
  [TwoFactorCodeDto, ['code']],
  [TwoFactorChallengeDto, ['code', 'challengeToken']],
  [TwoFactorStepUpDto, ['code', 'currentPassword']],
  [CreateCheckoutSessionDto, ['interval']],
  [
    InitiateFileUploadDto,
    ['fileName', 'mimeType', 'sizeBytes', 'checksumSha256'],
  ],
  [FileListQueryDto, ['page', 'limit', 'status']],
  [SignedFileRequestQueryDto, ['expires', 'signature']],
  [
    NotificationListQueryDto,
    ['limit', 'cursor', 'unreadOnly', 'organizationId'],
  ],
  [NotificationOrganizationFilterDto, ['organizationId']],
  [UpdateNotificationPreferenceDto, ['organizationEnabled']],
  [PaginationQueryDto, ['page', 'limit']],
  [InvitationListQueryDto, ['page', 'limit', 'status']],
  [CreateOrganizationDto, ['name']],
  [UpdateOrganizationDto, ['name']],
  [CreateInvitationDto, ['email', 'role']],
  [AcceptInvitationDto, ['token']],
  [UpdateMembershipRoleDto, ['role']],
  [TransferOwnershipDto, ['membershipId']],
];

describe('request DTO validation coverage', () => {
  it.each(requestDtoProperties)(
    '%s has validation metadata for every accepted property',
    (dto, expectedProperties) => {
      const validatedProperties = new Set(
        getMetadataStorage()
          .getTargetValidationMetadatas(dto, '', false, false)
          .map((metadata) => metadata.propertyName),
      );

      expect([...validatedProperties].sort()).toEqual(
        [...expectedProperties].sort(),
      );
    },
  );
});
