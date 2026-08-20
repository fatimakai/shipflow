import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../database/prisma.service';
import { EmailCategory, EmailDeliveryStatus } from '../generated/prisma/enums';
import { renderEmailTemplate } from './email-templates';
import {
  EMAIL_PROVIDER_CLIENT,
  EmailProviderError,
  type EmailDeliveryResult,
  type EmailMessage,
  type EmailProvider,
  type TransactionalEmailDelivery,
} from './email.types';

const MAX_DELIVERY_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [500, 1500];

interface DeliveryInput {
  category: EmailCategory;
  email: string;
  discriminator: string;
  actionPath?: string;
  organizationName?: string;
  securityMessage?: string;
  securityTitle?: string;
}

@Injectable()
export class TransactionalEmailService implements TransactionalEmailDelivery {
  private readonly logger = new Logger(TransactionalEmailService.name);

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
    @Inject(EMAIL_PROVIDER_CLIENT)
    private readonly provider: EmailProvider,
  ) {}

  sendEmailVerification(
    email: string,
    token: string,
  ): Promise<EmailDeliveryResult> {
    return this.deliver({
      category: EmailCategory.EMAIL_VERIFICATION,
      email,
      discriminator: token,
      actionPath: 'verify-email',
    });
  }

  sendPasswordReset(
    email: string,
    token: string,
  ): Promise<EmailDeliveryResult> {
    return this.deliver({
      category: EmailCategory.PASSWORD_RESET,
      email,
      discriminator: token,
      actionPath: 'reset-password',
    });
  }

  sendOrganizationInvitation(
    email: string,
    token: string,
    organizationName: string,
  ): Promise<EmailDeliveryResult> {
    return this.deliver({
      category: EmailCategory.ORGANIZATION_INVITATION,
      email,
      discriminator: token,
      actionPath: 'invitations/accept',
      organizationName,
    });
  }

  sendSecurityNotice(
    email: string,
    title: string,
    message: string,
  ): Promise<EmailDeliveryResult> {
    return this.deliver({
      category: EmailCategory.SECURITY_NOTICE,
      email,
      discriminator: randomUUID(),
      securityTitle: title,
      securityMessage: message,
    });
  }

  private async deliver(input: DeliveryInput): Promise<EmailDeliveryResult> {
    const email = input.email.trim().toLowerCase();
    const idempotencyKey = this.idempotencyKey(input, email);
    let deliveryId: string | undefined;

    try {
      const existing = await this.prisma.emailDelivery.upsert({
        where: { idempotencyKey },
        create: {
          category: input.category,
          provider: this.provider.name,
          recipientEmail: email,
          idempotencyKey,
        },
        update: {},
      });
      deliveryId = existing.id;

      if (
        existing.status === EmailDeliveryStatus.SENT ||
        existing.status === EmailDeliveryStatus.DELIVERED
      ) {
        return {
          deliveryId,
          providerMessageId: existing.providerMessageId ?? undefined,
          status: 'sent',
        };
      }
      if (
        existing.providerMessageId ||
        existing.attempts >= MAX_DELIVERY_ATTEMPTS
      ) {
        return { deliveryId, status: 'failed' };
      }

      const message = await this.buildMessage(input, email);
      return await this.attemptDelivery(
        deliveryId,
        existing.attempts,
        idempotencyKey,
        message,
      );
    } catch (error: unknown) {
      const code =
        error instanceof EmailProviderError
          ? error.code
          : 'email_delivery_internal_error';
      this.logger.error(
        `Transactional email ${input.category} failed with code ${code}`,
      );

      if (deliveryId) {
        await this.recordUnexpectedFailure(deliveryId, code);
      }

      return { deliveryId, status: 'failed' };
    }
  }

  private async attemptDelivery(
    deliveryId: string,
    previousAttempts: number,
    idempotencyKey: string,
    message: EmailMessage,
  ): Promise<EmailDeliveryResult> {
    for (
      let attempt = previousAttempts + 1;
      attempt <= MAX_DELIVERY_ATTEMPTS;
      attempt += 1
    ) {
      await this.prisma.emailDelivery.update({
        where: { id: deliveryId },
        data: {
          attempts: { increment: 1 },
          status: EmailDeliveryStatus.SENDING,
        },
      });

      try {
        const result = await this.provider.send(message, { idempotencyKey });
        await this.prisma.emailDelivery.update({
          where: { id: deliveryId },
          data: {
            failedAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
            providerMessageId: result.messageId,
            sentAt: new Date(),
            status: EmailDeliveryStatus.SENT,
          },
        });

        return {
          deliveryId,
          providerMessageId: result.messageId,
          status: 'sent',
        };
      } catch (error: unknown) {
        const providerError = this.toProviderError(error);
        const isFinalAttempt =
          !providerError.retryable || attempt === MAX_DELIVERY_ATTEMPTS;

        await this.prisma.emailDelivery.update({
          where: { id: deliveryId },
          data: {
            failedAt: isFinalAttempt ? new Date() : null,
            lastErrorCode: providerError.code,
            lastErrorMessage: providerError.retryable
              ? 'Temporary email provider failure'
              : 'Email provider rejected the request',
            status: isFinalAttempt
              ? EmailDeliveryStatus.FAILED
              : EmailDeliveryStatus.PENDING,
          },
        });

        if (isFinalAttempt) {
          throw providerError;
        }

        await this.sleep(
          providerError.retryAfterMs ?? this.retryDelay(attempt - 1),
        );
      }
    }

    return { deliveryId, status: 'failed' };
  }

  private async buildMessage(
    input: DeliveryInput,
    email: string,
  ): Promise<EmailMessage> {
    const actionUrl = input.actionPath
      ? this.actionUrl(input.actionPath, input.discriminator)
      : undefined;
    const rendered = await renderEmailTemplate({
      actionUrl,
      category: input.category,
      organizationName: input.organizationName,
      securityMessage: input.securityMessage,
      securityTitle: input.securityTitle,
      supportEmail: this.configService.getOrThrow<string>(
        'EMAIL_SUPPORT_ADDRESS',
      ),
    });
    const fromName = this.configService.getOrThrow<string>('EMAIL_FROM_NAME');
    const fromAddress =
      this.configService.getOrThrow<string>('EMAIL_FROM_ADDRESS');

    return {
      category: input.category,
      from: `${fromName} <${fromAddress}>`,
      html: rendered.html,
      replyTo: this.configService.getOrThrow<string>('EMAIL_REPLY_TO'),
      subject: rendered.subject,
      text: rendered.text,
      to: email,
    };
  }

  private actionUrl(path: string, token: string): string {
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    const url = new URL(path, `${frontendUrl}/`);
    url.searchParams.set('token', token);
    return url.toString();
  }

  private idempotencyKey(input: DeliveryInput, email: string): string {
    return createHash('sha256')
      .update(`${input.category}\0${email}\0${input.discriminator}`)
      .digest('hex');
  }

  private toProviderError(error: unknown): EmailProviderError {
    return error instanceof EmailProviderError
      ? error
      : new EmailProviderError('provider_network_error', true);
  }

  private retryDelay(index: number): number {
    const base = RETRY_DELAYS_MS[index] ?? RETRY_DELAYS_MS.at(-1) ?? 1500;
    return Math.round(base * (0.8 + Math.random() * 0.4));
  }

  private sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  private async recordUnexpectedFailure(
    deliveryId: string,
    code: string,
  ): Promise<void> {
    try {
      await this.prisma.emailDelivery.update({
        where: { id: deliveryId },
        data: {
          failedAt: new Date(),
          lastErrorCode: code,
          lastErrorMessage: 'Transactional email delivery failed',
          status: EmailDeliveryStatus.FAILED,
        },
      });
    } catch {
      this.logger.error(
        `Could not persist failure metadata for email delivery ${deliveryId}`,
      );
    }
  }
}
