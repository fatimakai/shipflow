import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../auth.constants';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDto {
  @ApiProperty({ format: 'email', maxLength: 320 })
  @Transform(trim)
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({
    format: 'password',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
    writeOnly: true,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName?: string;
}

export class LoginDto {
  @ApiProperty({ format: 'email', maxLength: 320 })
  @Transform(trim)
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({
    format: 'password',
    minLength: 1,
    maxLength: PASSWORD_MAX_LENGTH,
    writeOnly: true,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}

export class UpdateProfileDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName!: string;
}

export class EmailDto {
  @ApiProperty({ format: 'email', maxLength: 320 })
  @Transform(trim)
  @IsEmail()
  @MaxLength(320)
  email!: string;
}

export class TokenDto {
  @ApiProperty({ minLength: 32, maxLength: 256, writeOnly: true })
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token!: string;
}

export class ResetPasswordDto extends TokenDto {
  @ApiProperty({
    format: 'password',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
    writeOnly: true,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}

export class TotpCodeDto {
  @ApiProperty({ example: '123456', writeOnly: true })
  @Transform(trim)
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class TwoFactorCodeDto {
  @ApiProperty({
    description: 'A six-digit authenticator code or a recovery code',
    example: '2345-ABCD-EFGH-JKLM',
    minLength: 6,
    maxLength: 32,
    writeOnly: true,
  })
  @Transform(trim)
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  code!: string;
}

export class TwoFactorChallengeDto extends TwoFactorCodeDto {
  @ApiProperty({ minLength: 32, maxLength: 256, writeOnly: true })
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  challengeToken!: string;
}

export class TwoFactorStepUpDto extends TwoFactorCodeDto {
  @ApiPropertyOptional({
    description: 'Required when the account has a local password',
    format: 'password',
    minLength: 1,
    maxLength: PASSWORD_MAX_LENGTH,
    writeOnly: true,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_MAX_LENGTH)
  currentPassword?: string;
}
