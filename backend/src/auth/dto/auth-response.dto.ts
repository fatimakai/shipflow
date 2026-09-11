import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  displayName!: string | null;

  @ApiPropertyOptional({ type: String, format: 'uri', nullable: true })
  avatarUrl!: string | null;

  @ApiProperty()
  emailVerified!: boolean;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ enum: ['Bearer'], example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({
    description: 'Access-token lifetime in seconds',
    example: 900,
  })
  expiresIn!: number;

  @ApiProperty({ type: AuthUserResponseDto })
  user!: AuthUserResponseDto;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Request accepted' })
  message!: string;
}

export class TwoFactorChallengeResponseDto {
  @ApiProperty({ enum: [true], example: true })
  requiresTwoFactor!: true;

  @ApiProperty({
    description: 'Opaque token required to complete the challenge',
  })
  challengeToken!: string;

  @ApiProperty({ description: 'Challenge lifetime in seconds', example: 300 })
  expiresIn!: number;
}

export class TwoFactorStatusResponseDto {
  @ApiProperty()
  enabled!: boolean;

  @ApiProperty()
  setupPending!: boolean;

  @ApiProperty({ minimum: 0 })
  backupCodesRemaining!: number;
}

export class TwoFactorSetupResponseDto {
  @ApiProperty({
    description: 'Authenticator provisioning URI used to render a QR code',
  })
  provisioningUri!: string;

  @ApiProperty({ description: 'Base32 key for manual authenticator setup' })
  manualEntryKey!: string;
}

export class TwoFactorEnabledResponseDto {
  @ApiProperty({ enum: [true], example: true })
  enabled!: true;

  @ApiProperty({
    type: [String],
    description: 'Single-display recovery codes; store them securely',
  })
  backupCodes!: string[];
}
