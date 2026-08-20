import { Type, Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvitationStatus, MembershipRole } from '../../generated/prisma/enums';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const invitationRoles = [
  MembershipRole.ADMIN,
  MembershipRole.MEMBER,
  MembershipRole.VIEWER,
] as const;

const membershipRoles = [
  MembershipRole.ADMIN,
  MembershipRole.MEMBER,
  MembershipRole.VIEWER,
] as const;

export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, type: Number })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20, type: Number })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class InvitationListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: InvitationStatus })
  @IsOptional()
  @IsIn(Object.values(InvitationStatus))
  status?: InvitationStatus;
}

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme Operations' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}

export class UpdateOrganizationDto {
  @ApiProperty({ example: 'Acme Operations' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}

export class CreateInvitationDto {
  @ApiProperty({ format: 'email' })
  @Transform(trim)
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ enum: invitationRoles, default: MembershipRole.MEMBER })
  @IsOptional()
  @IsIn(invitationRoles)
  role: MembershipRole = MembershipRole.MEMBER;
}

export class AcceptInvitationDto {
  @ApiProperty({ minLength: 32, maxLength: 256 })
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token!: string;
}

export class UpdateMembershipRoleDto {
  @ApiProperty({ enum: membershipRoles })
  @IsIn(membershipRoles)
  role!: MembershipRole;
}

export class TransferOwnershipDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  membershipId!: string;
}
