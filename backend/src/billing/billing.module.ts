import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import type { EnvironmentVariables } from '../config/env.validation';
import {
  BillingPlansController,
  OrganizationBillingController,
} from './billing.controller';
import { BillingEntitlementService } from './billing-entitlement.service';
import { createBillingProvider } from './billing.providers';
import { BillingService } from './billing.service';
import { BILLING_PROVIDER_CLIENT } from './billing.types';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';

@Module({
  imports: [AuthModule, AuthorizationModule],
  controllers: [
    BillingPlansController,
    OrganizationBillingController,
    StripeWebhookController,
  ],
  providers: [
    {
      provide: BILLING_PROVIDER_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables, true>) =>
        createBillingProvider(configService),
    },
    BillingEntitlementService,
    BillingService,
    StripeWebhookService,
  ],
  exports: [BILLING_PROVIDER_CLIENT, BillingEntitlementService, BillingService],
})
export class BillingModule {}
