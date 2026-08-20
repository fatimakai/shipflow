import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Capability } from '../../authorization/capability';
import { InvitationStatus, MembershipRole } from '../../generated/prisma/enums';

export class PaginationMetaDto {
  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  limit!: number;

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 0 })
  totalPages!: number;
}

export class OrganizationUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  displayName!: string | null;

  @ApiPropertyOptional({ format: 'uri', nullable: true, type: String })
  avatarUrl!: string | null;
}

export class OrganizationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ format: 'uuid' })
  ownerId!: string;

  @ApiProperty({ type: OrganizationUserResponseDto })
  owner!: OrganizationUserResponseDto;

  @ApiProperty({ format: 'uuid' })
  membershipId!: string;

  @ApiProperty({ enum: MembershipRole })
  currentUserRole!: MembershipRole;

  @ApiProperty({ enum: Capability, isArray: true })
  currentUserCapabilities!: Capability[];

  @ApiProperty({ minimum: 1 })
  memberCount!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class OrganizationListResponseDto {
  @ApiProperty({ type: [OrganizationResponseDto] })
  items!: OrganizationResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class MembershipResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ enum: MembershipRole })
  role!: MembershipRole;

  @ApiProperty({ type: OrganizationUserResponseDto })
  user!: OrganizationUserResponseDto;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class MembershipListResponseDto {
  @ApiProperty({ type: [MembershipResponseDto] })
  items!: MembershipResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class InvitationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty({ enum: MembershipRole })
  role!: MembershipRole;

  @ApiProperty({ enum: InvitationStatus })
  status!: InvitationStatus;

  @ApiProperty({ type: OrganizationUserResponseDto })
  invitedBy!: OrganizationUserResponseDto;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: Date;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  acceptedAt!: Date | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  revokedAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class InvitationListResponseDto {
  @ApiProperty({ type: [InvitationResponseDto] })
  items!: InvitationResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class OrganizationMessageResponseDto {
  @ApiProperty({ example: 'Organization deleted' })
  message!: string;
}
