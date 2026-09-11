import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
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

const optionalBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

export class NotificationListQueryDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 20 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({
    description: 'Opaque pagination cursor',
    minLength: 1,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  cursor?: string;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @Transform(optionalBoolean)
  @IsOptional()
  @IsBoolean()
  unreadOnly = false;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

export class NotificationOrganizationFilterDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

export class UpdateNotificationPreferenceDto {
  @ApiProperty()
  @IsBoolean()
  organizationEnabled!: boolean;
}
