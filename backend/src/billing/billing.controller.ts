import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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
import {
  CurrentOrganizationContext,
  RequireOrganizationCapabilities,
} from '../authorization/authorization.decorators';
import type { OrganizationContext } from '../authorization/organization-context.service';
import { Capability } from '../authorization/capability';
import { API_VERSION } from '../common/http/api.constants';
import { ApiStandardErrors } from '../common/http/decorators/api-standard-errors.decorator';
import { ApiErrorResponseDto } from '../common/http/dto/api-error-response.dto';
import { BillingService } from './billing.service';
import { CreateCheckoutSessionDto } from './dto/billing-request.dto';
import {
  BillingPlanListResponseDto,
  BillingStateResponseDto,
  CheckoutSessionResponseDto,
  PortalSessionResponseDto,
} from './dto/billing-response.dto';

@ApiTags('Billing')
@Controller({ path: 'billing/plans', version: API_VERSION })
export class BillingPlansController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @ApiOperation({ summary: 'List the active application billing plans' })
  @ApiOkResponse({ type: BillingPlanListResponseDto })
  listPlans(): Promise<BillingPlanListResponseDto> {
    return this.billingService.listPlans();
  }
}

@ApiTags('Billing')
@ApiBearerAuth('access-token')
@ApiStandardErrors()
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@ApiForbiddenResponse({ type: ApiErrorResponseDto })
@ApiNotFoundResponse({ type: ApiErrorResponseDto })
@UseGuards(AccessTokenGuard)
@Controller({
  path: 'organizations/:organizationId/billing',
  version: API_VERSION,
})
export class OrganizationBillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @RequireOrganizationCapabilities(Capability.BILLING_READ)
  @ApiOperation({ summary: 'Get organization billing and entitlement state' })
  @ApiOkResponse({ type: BillingStateResponseDto })
  getBillingState(
    @CurrentOrganizationContext() context: OrganizationContext,
  ): Promise<BillingStateResponseDto> {
    return this.billingService.getBillingState(context.organization.id);
  }

  @Post('checkout-session')
  @RequireOrganizationCapabilities(Capability.BILLING_MANAGE)
  @ApiOperation({ summary: 'Create a hosted Stripe Checkout session' })
  @ApiCreatedResponse({ type: CheckoutSessionResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  createCheckoutSession(
    @CurrentOrganizationContext() context: OrganizationContext,
    @Body() dto: CreateCheckoutSessionDto,
  ): Promise<CheckoutSessionResponseDto> {
    return this.billingService.createCheckoutSession(context, dto.interval);
  }

  @Post('portal-session')
  @RequireOrganizationCapabilities(Capability.BILLING_MANAGE)
  @ApiOperation({ summary: 'Create a hosted Stripe Customer Portal session' })
  @ApiCreatedResponse({ type: PortalSessionResponseDto })
  createPortalSession(
    @CurrentOrganizationContext() context: OrganizationContext,
  ): Promise<PortalSessionResponseDto> {
    return this.billingService.createPortalSession(context.organization.id);
  }
}
