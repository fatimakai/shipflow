import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import { createEmailProvider } from './email.providers';
import { ResendWebhookController } from './resend-webhook.controller';
import { ResendWebhookService } from './resend-webhook.service';
import { TransactionalEmailService } from './transactional-email.service';
import {
  EMAIL_PROVIDER_CLIENT,
  TRANSACTIONAL_EMAIL_DELIVERY,
} from './email.types';

@Global()
@Module({
  controllers: [ResendWebhookController],
  providers: [
    {
      provide: EMAIL_PROVIDER_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables, true>) =>
        createEmailProvider(configService),
    },
    TransactionalEmailService,
    {
      provide: TRANSACTIONAL_EMAIL_DELIVERY,
      useExisting: TransactionalEmailService,
    },
    ResendWebhookService,
  ],
  exports: [
    EMAIL_PROVIDER_CLIENT,
    TRANSACTIONAL_EMAIL_DELIVERY,
    TransactionalEmailService,
  ],
})
export class EmailModule {}
