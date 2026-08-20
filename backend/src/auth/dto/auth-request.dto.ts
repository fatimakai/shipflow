import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
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
    maxLength: PASSWORD_MAX_LENGTH,
    writeOnly: true,
  })
  @IsString()
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
