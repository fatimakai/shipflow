import { Inject } from '@nestjs/common';

export const EMAIL_PROVIDER_CLIENT = Symbol('EMAIL_PROVIDER_CLIENT');
export const TRANSACTIONAL_EMAIL_DELIVERY = Symbol(
  'TRANSACTIONAL_EMAIL_DELIVERY',
);

export type EmailProviderName = 'log' | 'capture' | 'resend';

export interface EmailMessage {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  category: string;
}

export interface EmailSendOptions {
  idempotencyKey: string;
}

export interface EmailProviderResult {
  messageId: string;
}

export interface EmailProvider {
  readonly name: EmailProviderName;
  send(
    message: EmailMessage,
    options: EmailSendOptions,
  ): Promise<EmailProviderResult>;
}

export interface EmailDeliveryResult {
  deliveryId?: string;
  providerMessageId?: string;
  status: 'sent' | 'failed';
}

export interface TransactionalEmailDelivery {
  sendEmailVerification(
    email: string,
    token: string,
  ): Promise<EmailDeliveryResult>;
  sendPasswordReset(email: string, token: string): Promise<EmailDeliveryResult>;
  sendOrganizationInvitation(
    email: string,
    token: string,
    organizationName: string,
  ): Promise<EmailDeliveryResult>;
  sendSecurityNotice(
    email: string,
    title: string,
    message: string,
  ): Promise<EmailDeliveryResult>;
}

export class EmailProviderError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    readonly retryAfterMs?: number,
  ) {
    super(code);
    this.name = EmailProviderError.name;
  }
}

export const InjectTransactionalEmailDelivery = () =>
  Inject(TRANSACTIONAL_EMAIL_DELIVERY);
