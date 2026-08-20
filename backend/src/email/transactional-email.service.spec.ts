import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation';
import type { PrismaService } from '../database/prisma.service';
import { EmailCategory, EmailDeliveryStatus } from '../generated/prisma/enums';
import { EmailProviderError, type EmailProvider } from './email.types';
import { TransactionalEmailService } from './transactional-email.service';

const configValues: Record<string, string> = {
  EMAIL_FROM_ADDRESS: 'no-reply@mail.example.com',
  EMAIL_FROM_NAME: 'NestShip',
  EMAIL_REPLY_TO: 'support@example.com',
  EMAIL_SUPPORT_ADDRESS: 'support@example.com',
  FRONTEND_URL: 'https://app.example.com',
};

function createHarness(provider: EmailProvider) {
  let lastUpdateArgs: unknown;
  let lastUpsertArgs: unknown;
  const update = jest.fn((args: unknown): Promise<void> => {
    lastUpdateArgs = args;
    return Promise.resolve();
  });
  const upsert = jest
    .fn<
      (args: unknown) => Promise<{
        attempts: number;
        id: string;
        providerMessageId: string | null;
        status: EmailDeliveryStatus;
      }>
    >()
    .mockImplementation((args: unknown) => {
      lastUpsertArgs = args;
      return Promise.resolve({
        attempts: 0,
        id: 'delivery-id',
        providerMessageId: null,
        status: EmailDeliveryStatus.PENDING,
      });
    });
  const emailDelivery = {
    update,
    upsert,
  };
  const prisma = { emailDelivery } as unknown as PrismaService;
  const config = {
    getOrThrow: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService<EnvironmentVariables, true>;
  const service = new TransactionalEmailService(config, prisma, provider);

  return {
    emailDelivery,
    getLastUpdateArgs: () => lastUpdateArgs,
    getLastUpsertArgs: () => lastUpsertArgs,
    service,
  };
}

describe('TransactionalEmailService', () => {
  it('records provider acceptance without storing the token or rendered body', async () => {
    const provider: EmailProvider = {
      name: 'capture',
      send: jest.fn().mockResolvedValue({ messageId: 'provider-id' }),
    };
    const { getLastUpsertArgs, service } = createHarness(provider);

    await expect(
      service.sendEmailVerification('User@Example.com', 'raw-secret-token'),
    ).resolves.toEqual({
      deliveryId: 'delivery-id',
      providerMessageId: 'provider-id',
      status: 'sent',
    });

    expect(getLastUpsertArgs()).toMatchObject({
      create: {
        category: EmailCategory.EMAIL_VERIFICATION,
        recipientEmail: 'user@example.com',
      },
    });
    const persistedInput = JSON.stringify(getLastUpsertArgs());
    expect(persistedInput).not.toContain('raw-secret-token');
    expect(persistedInput).not.toContain('<html');
  });

  it('records a non-retryable failure and preserves the caller response', async () => {
    const send = jest
      .fn()
      .mockRejectedValue(new EmailProviderError('invalid_from_address', false));
    const provider: EmailProvider = {
      name: 'resend',
      send,
    };
    const { getLastUpdateArgs, service } = createHarness(provider);

    await expect(
      service.sendPasswordReset('user@example.com', 'reset-token'),
    ).resolves.toEqual({ deliveryId: 'delivery-id', status: 'failed' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(getLastUpdateArgs()).toMatchObject({
      data: {
        lastErrorCode: 'invalid_from_address',
        status: EmailDeliveryStatus.FAILED,
      },
    });
  });

  it('does not send an already accepted idempotent delivery again', async () => {
    const send = jest.fn();
    const provider: EmailProvider = {
      name: 'capture',
      send,
    };
    const { emailDelivery, service } = createHarness(provider);
    emailDelivery.upsert.mockResolvedValue({
      attempts: 1,
      id: 'delivery-id',
      providerMessageId: 'provider-id',
      status: EmailDeliveryStatus.SENT,
    });

    await expect(
      service.sendEmailVerification('user@example.com', 'same-token'),
    ).resolves.toEqual({
      deliveryId: 'delivery-id',
      providerMessageId: 'provider-id',
      status: 'sent',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('counts retries against attempts persisted before a restart', async () => {
    const send = jest
      .fn()
      .mockRejectedValue(
        new EmailProviderError('provider_network_error', true),
      );
    const provider: EmailProvider = { name: 'resend', send };
    const { emailDelivery, service } = createHarness(provider);
    emailDelivery.upsert.mockResolvedValue({
      attempts: 2,
      id: 'delivery-id',
      providerMessageId: null,
      status: EmailDeliveryStatus.PENDING,
    });

    await expect(
      service.sendPasswordReset('user@example.com', 'restart-token'),
    ).resolves.toEqual({ deliveryId: 'delivery-id', status: 'failed' });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
