import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend, type WebhookEventPayload } from 'resend';
import { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../database/prisma.service';
import { EmailDeliveryStatus } from '../generated/prisma/enums';

export interface ResendWebhookHeaders {
  id: string;
  signature: string;
  timestamp: string;
}

@Injectable()
export class ResendWebhookService {
  private readonly logger = new Logger(ResendWebhookService.name);
  private readonly resend: Resend;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
  ) {
    this.resend = new Resend(
      this.configService.get<string>('RESEND_API_KEY') ??
        're_webhook_verification_only',
    );
  }

  async process(rawBody: Buffer, headers: ResendWebhookHeaders): Promise<void> {
    const webhookSecret = this.configService.get<string>(
      'RESEND_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new UnauthorizedException('Webhook verification is unavailable');
    }

    let event: WebhookEventPayload;
    try {
      event = this.resend.webhooks.verify({
        headers,
        payload: rawBody.toString('utf8'),
        webhookSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    await this.recordEvent(headers.id, event);
  }

  private async recordEvent(
    eventId: string,
    event: WebhookEventPayload,
  ): Promise<void> {
    const providerMessageId = this.providerMessageId(event);
    const eventCreatedAt = new Date(event.created_at);

    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.emailWebhookEvent.create({
          data: {
            id: eventId,
            eventType: event.type,
            providerMessageId,
            eventCreatedAt,
          },
        });

        const status = this.deliveryStatus(event.type);
        if (!providerMessageId || !status) {
          return;
        }

        await transaction.emailDelivery.updateMany({
          where: {
            providerMessageId,
            OR: [
              { lastEventAt: null },
              { lastEventAt: { lt: eventCreatedAt } },
            ],
          },
          data: {
            status,
            lastEventAt: eventCreatedAt,
            ...(status === EmailDeliveryStatus.DELIVERED
              ? {
                  deliveredAt: eventCreatedAt,
                  failedAt: null,
                  lastErrorCode: null,
                  lastErrorMessage: null,
                }
              : {}),
            ...(this.isFailureStatus(status)
              ? {
                  failedAt: eventCreatedAt,
                  lastErrorCode: event.type,
                  lastErrorMessage: 'Provider reported a delivery failure',
                }
              : {}),
          },
        });
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        return;
      }

      this.logger.error(`Failed to process Resend webhook ${eventId}`);
      throw error;
    }
  }

  private providerMessageId(event: WebhookEventPayload): string | undefined {
    if ('email_id' in event.data) {
      return event.data.email_id;
    }

    return undefined;
  }

  private deliveryStatus(type: string): EmailDeliveryStatus | undefined {
    const statuses: Partial<Record<string, EmailDeliveryStatus>> = {
      'email.bounced': EmailDeliveryStatus.BOUNCED,
      'email.complained': EmailDeliveryStatus.COMPLAINED,
      'email.delivered': EmailDeliveryStatus.DELIVERED,
      'email.failed': EmailDeliveryStatus.FAILED,
      'email.scheduled': EmailDeliveryStatus.SENT,
      'email.sent': EmailDeliveryStatus.SENT,
      'email.suppressed': EmailDeliveryStatus.SUPPRESSED,
    };
    return statuses[type];
  }

  private isFailureStatus(status: EmailDeliveryStatus): boolean {
    const failureStatuses = new Set<EmailDeliveryStatus>([
      EmailDeliveryStatus.BOUNCED,
      EmailDeliveryStatus.COMPLAINED,
      EmailDeliveryStatus.FAILED,
      EmailDeliveryStatus.SUPPRESSED,
    ]);
    return failureStatuses.has(status);
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
