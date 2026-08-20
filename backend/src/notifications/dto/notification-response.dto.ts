import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NotificationCategory,
  NotificationType,
} from '../../generated/prisma/enums';

export class NotificationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  organizationId!: string | null;

  @ApiProperty({ enum: NotificationCategory })
  category!: NotificationCategory;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  actionPath!: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata!: Record<string, unknown>;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  readAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: Date;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  items!: NotificationResponseDto[];

  @ApiPropertyOptional({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class NotificationUnreadCountResponseDto {
  @ApiProperty({ minimum: 0 })
  count!: number;
}

export class NotificationMarkAllReadResponseDto {
  @ApiProperty({ minimum: 0 })
  updatedCount!: number;
}

export class NotificationPreferenceResponseDto {
  @ApiProperty()
  organizationEnabled!: boolean;

  @ApiProperty({ default: true })
  securityEnabled!: true;

  @ApiProperty({ default: true })
  billingEnabled!: true;
}
