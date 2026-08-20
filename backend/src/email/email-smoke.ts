import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { EnvironmentVariables } from '../config/env.validation';
import { TransactionalEmailService } from './transactional-email.service';

async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const config = app.get(ConfigService<EnvironmentVariables, true>);
    if (config.getOrThrow<string>('EMAIL_PROVIDER') !== 'resend') {
      throw new Error(
        'EMAIL_PROVIDER must be resend for a delivery smoke test',
      );
    }
    const recipient = config.get<string>('EMAIL_SMOKE_TEST_RECIPIENT');
    if (!recipient) {
      throw new Error('EMAIL_SMOKE_TEST_RECIPIENT is required');
    }

    const result = await app
      .get(TransactionalEmailService)
      .sendSecurityNotice(
        recipient,
        'NestShip transactional email smoke test',
        'Transactional email delivery is configured correctly for this environment.',
      );

    if (result.status !== 'sent') {
      throw new Error('The provider did not accept the smoke-test email');
    }

    Logger.log(
      `Smoke-test email accepted as ${result.providerMessageId ?? result.deliveryId}`,
      'EmailSmokeTest',
    );
  } finally {
    await app.close();
  }
}

void run().catch((error: unknown) => {
  Logger.error(
    error instanceof Error ? error.message : 'Email smoke test failed',
    undefined,
    'EmailSmokeTest',
  );
  process.exitCode = 1;
});
