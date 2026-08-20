import { EmailProviderError, type EmailMessage } from './email.types';
import { CaptureEmailProvider, ResendEmailProvider } from './email.providers';

const message: EmailMessage = {
  category: 'EMAIL_VERIFICATION',
  from: 'NestShip <no-reply@mail.example.com>',
  html: '<p>Verify</p>',
  replyTo: 'support@example.com',
  subject: 'Verify your email',
  text: 'Verify',
  to: 'user@example.com',
};

interface ResendClientMock {
  emails: {
    send: jest.Mock;
  };
}

describe('email providers', () => {
  it('captures complete provider-neutral messages in tests', async () => {
    const provider = new CaptureEmailProvider();

    const result = await provider.send(message, {
      idempotencyKey: 'delivery-key',
    });

    expect(result.messageId).toMatch(/^capture_/);
    expect(provider.messages).toEqual([
      expect.objectContaining({
        idempotencyKey: 'delivery-key',
        subject: 'Verify your email',
        to: 'user@example.com',
      }),
    ]);
  });

  it('maps the provider-neutral message and idempotency key to Resend', async () => {
    const provider = new ResendEmailProvider('re_test');
    const client = (provider as unknown as { client: ResendClientMock }).client;
    client.emails.send = jest.fn().mockResolvedValue({
      data: { id: 'email_123' },
      error: null,
      headers: {},
    });

    await expect(
      provider.send(message, { idempotencyKey: 'delivery-key' }),
    ).resolves.toEqual({ messageId: 'email_123' });
    expect(client.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        html: message.html,
        text: message.text,
        to: message.to,
      }),
      { idempotencyKey: 'delivery-key' },
    );
  });

  it('classifies rate limits as retryable and caps Retry-After', async () => {
    const provider = new ResendEmailProvider('re_test');
    const client = (provider as unknown as { client: ResendClientMock }).client;
    client.emails.send = jest.fn().mockResolvedValue({
      data: null,
      error: {
        message: 'Rate limited',
        name: 'rate_limit_exceeded',
        statusCode: 429,
      },
      headers: { 'retry-after': '20' },
    });

    await expect(
      provider.send(message, { idempotencyKey: 'delivery-key' }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<EmailProviderError>>({
        code: 'rate_limit_exceeded',
        retryAfterMs: 5000,
        retryable: true,
      }),
    );
  });

  it('does not retry invalid sender configuration', async () => {
    const provider = new ResendEmailProvider('re_test');
    const client = (provider as unknown as { client: ResendClientMock }).client;
    client.emails.send = jest.fn().mockResolvedValue({
      data: null,
      error: {
        message: 'Invalid sender',
        name: 'invalid_from_address',
        statusCode: 422,
      },
      headers: {},
    });

    await expect(
      provider.send(message, { idempotencyKey: 'delivery-key' }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<EmailProviderError>>({
        code: 'invalid_from_address',
        retryable: false,
      }),
    );
  });
});
