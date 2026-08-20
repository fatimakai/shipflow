import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Resend, type ErrorResponse } from 'resend';
import type { EnvironmentVariables } from '../config/env.validation';
import {
  EmailProviderError,
  type EmailMessage,
  type EmailProvider,
  type EmailProviderResult,
  type EmailSendOptions,
} from './email.types';

@Injectable()
export class LogEmailProvider implements EmailProvider {
  readonly name = 'log' as const;
  private readonly logger = new Logger(LogEmailProvider.name);

  send(message: EmailMessage): Promise<EmailProviderResult> {
    const messageId = `log_${randomUUID()}`;
    this.logger.log(
      `Accepted ${message.category} email ${messageId} for ${message.to}`,
    );
    return Promise.resolve({ messageId });
  }
}

@Injectable()
export class CaptureEmailProvider implements EmailProvider {
  readonly name = 'capture' as const;
  readonly messages: Array<
    EmailMessage & EmailSendOptions & { messageId: string }
  > = [];

  send(
    message: EmailMessage,
    options: EmailSendOptions,
  ): Promise<EmailProviderResult> {
    const messageId = `capture_${randomUUID()}`;
    this.messages.push({ ...message, ...options, messageId });
    return Promise.resolve({ messageId });
  }
}

export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend' as const;
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(
    message: EmailMessage,
    options: EmailSendOptions,
  ): Promise<EmailProviderResult> {
    try {
      const response = await this.client.emails.send(
        {
          from: message.from,
          html: message.html,
          replyTo: message.replyTo,
          subject: message.subject,
          tags: [{ name: 'category', value: message.category.toLowerCase() }],
          text: message.text,
          to: message.to,
        },
        { idempotencyKey: options.idempotencyKey },
      );

      if (response.error) {
        throw this.translateError(response.error, response.headers);
      }

      return { messageId: response.data.id };
    } catch (error: unknown) {
      if (error instanceof EmailProviderError) {
        throw error;
      }

      throw new EmailProviderError('provider_network_error', true);
    }
  }

  private translateError(
    error: ErrorResponse,
    headers: Record<string, string> | null,
  ): EmailProviderError {
    const retryableCodes = new Set([
      'application_error',
      'concurrent_idempotent_requests',
      'internal_server_error',
      'rate_limit_exceeded',
    ]);
    const retryAfter = Number(headers?.['retry-after']);
    const retryAfterMs = Number.isFinite(retryAfter)
      ? Math.min(retryAfter * 1000, 5000)
      : undefined;

    return new EmailProviderError(
      error.name,
      retryableCodes.has(error.name) || (error.statusCode ?? 0) >= 500,
      retryAfterMs,
    );
  }
}

export function createEmailProvider(
  configService: ConfigService<EnvironmentVariables, true>,
): EmailProvider {
  const provider =
    configService.getOrThrow<EnvironmentVariables['EMAIL_PROVIDER']>(
      'EMAIL_PROVIDER',
    );

  if (provider === 'resend') {
    return new ResendEmailProvider(
      configService.getOrThrow<string>('RESEND_API_KEY'),
    );
  }

  return provider === 'capture'
    ? new CaptureEmailProvider()
    : new LogEmailProvider();
}
