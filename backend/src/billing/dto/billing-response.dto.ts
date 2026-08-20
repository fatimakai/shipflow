import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BillingInterval,
  PlanCode,
  SubscriptionStatus,
} from '../../generated/prisma/enums';

export class BillingPlanResponseDto {
  @ApiProperty({ enum: PlanCode })
  code!: PlanCode;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ example: 'usd' })
  currency!: string;

  @ApiProperty({ minimum: 0 })
  monthlyPriceCents!: number;

  @ApiProperty({ minimum: 0 })
  annualPriceCents!: number;

  @ApiProperty({ type: [String] })
  features!: string[];
}

export class BillingPlanListResponseDto {
  @ApiProperty({ type: [BillingPlanResponseDto] })
  items!: BillingPlanResponseDto[];
}

export class BillingStateResponseDto {
  @ApiProperty({ type: BillingPlanResponseDto })
  plan!: BillingPlanResponseDto;

  @ApiPropertyOptional({ enum: SubscriptionStatus, nullable: true })
  subscriptionStatus!: SubscriptionStatus | null;

  @ApiPropertyOptional({ enum: BillingInterval, nullable: true })
  interval!: BillingInterval | null;

  @ApiProperty()
  hasPaidAccess!: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  currentPeriodStart!: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  currentPeriodEnd!: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  trialEnd!: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  gracePeriodEndsAt!: Date | null;

  @ApiProperty()
  cancelAtPeriodEnd!: boolean;
}

export class CheckoutSessionResponseDto {
  @ApiProperty()
  sessionId!: string;

  @ApiProperty({ format: 'uri' })
  url!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  expiresAt!: Date | null;
}

export class PortalSessionResponseDto {
  @ApiProperty({ format: 'uri' })
  url!: string;
}
