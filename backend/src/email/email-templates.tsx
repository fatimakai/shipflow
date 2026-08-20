import { render, toPlainText } from '@react-email/render';
import type { ReactNode } from 'react';
import { EmailCategory } from '../generated/prisma/enums';

interface TemplateInput {
  category: EmailCategory;
  actionUrl?: string;
  organizationName?: string;
  securityMessage?: string;
  securityTitle?: string;
  supportEmail: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const colors = {
  background: '#f4f5f7',
  border: '#d9dde3',
  button: '#166534',
  muted: '#5f6875',
  surface: '#ffffff',
  text: '#20242a',
};

function EmailLayout({
  children,
  preview,
  supportEmail,
}: {
  children: ReactNode;
  preview: string;
  supportEmail: string;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width" />
        <title>{preview}</title>
      </head>
      <body
        style={{
          backgroundColor: colors.background,
          color: colors.text,
          fontFamily: 'Arial, Helvetica, sans-serif',
          margin: 0,
          padding: '32px 16px',
        }}
      >
        <div
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            boxSizing: 'border-box',
            margin: '0 auto',
            maxWidth: '600px',
            padding: '32px',
          }}
        >
          <p style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 28px' }}>
            NestShip
          </p>
          {children}
          <hr
            style={{
              border: 0,
              borderTop: `1px solid ${colors.border}`,
              margin: '28px 0 20px',
            }}
          />
          <p style={{ color: colors.muted, fontSize: '13px', lineHeight: 1.5 }}>
            Need help? Contact{' '}
            <a href={`mailto:${supportEmail}`} style={{ color: colors.button }}>
              {supportEmail}
            </a>
            .
          </p>
        </div>
      </body>
    </html>
  );
}

function ActionButton({ href, label }: { href: string; label: string }) {
  return (
    <p style={{ margin: '28px 0' }}>
      <a
        href={href}
        style={{
          backgroundColor: colors.button,
          borderRadius: '6px',
          color: '#ffffff',
          display: 'inline-block',
          fontSize: '15px',
          fontWeight: 700,
          padding: '12px 18px',
          textDecoration: 'none',
        }}
      >
        {label}
      </a>
    </p>
  );
}

function ActionEmail({
  actionUrl,
  body,
  buttonLabel,
  heading,
  preview,
  supportEmail,
}: {
  actionUrl: string;
  body: string;
  buttonLabel: string;
  heading: string;
  preview: string;
  supportEmail: string;
}) {
  return (
    <EmailLayout preview={preview} supportEmail={supportEmail}>
      <h1 style={{ fontSize: '24px', lineHeight: 1.25, margin: '0 0 16px' }}>
        {heading}
      </h1>
      <p style={{ fontSize: '16px', lineHeight: 1.6, margin: 0 }}>{body}</p>
      <ActionButton href={actionUrl} label={buttonLabel} />
      <p style={{ color: colors.muted, fontSize: '13px', lineHeight: 1.5 }}>
        If the button does not work, open this link: {actionUrl}
      </p>
    </EmailLayout>
  );
}

export async function renderEmailTemplate(
  input: TemplateInput,
): Promise<RenderedEmail> {
  const { subject, node } = templateFor(input);
  const html = await render(node);

  return { subject, html, text: toPlainText(html) };
}

function templateFor(input: TemplateInput): {
  subject: string;
  node: ReactNode;
} {
  switch (input.category) {
    case EmailCategory.EMAIL_VERIFICATION: {
      const subject = 'Verify your NestShip email';
      return {
        subject,
        node: (
          <ActionEmail
            actionUrl={requiredActionUrl(input)}
            body="Confirm this email address to finish setting up your account."
            buttonLabel="Verify email"
            heading="Verify your email"
            preview={subject}
            supportEmail={input.supportEmail}
          />
        ),
      };
    }
    case EmailCategory.PASSWORD_RESET: {
      const subject = 'Reset your NestShip password';
      return {
        subject,
        node: (
          <ActionEmail
            actionUrl={requiredActionUrl(input)}
            body="Use this secure link to choose a new password. If you did not request this, you can ignore this email."
            buttonLabel="Reset password"
            heading="Reset your password"
            preview={subject}
            supportEmail={input.supportEmail}
          />
        ),
      };
    }
    case EmailCategory.ORGANIZATION_INVITATION: {
      const organizationName = input.organizationName ?? 'an organization';
      const subject = `Join ${organizationName} on NestShip`;
      return {
        subject,
        node: (
          <ActionEmail
            actionUrl={requiredActionUrl(input)}
            body={`You have been invited to join ${organizationName}.`}
            buttonLabel="Accept invitation"
            heading="You are invited"
            preview={subject}
            supportEmail={input.supportEmail}
          />
        ),
      };
    }
    case EmailCategory.SECURITY_NOTICE: {
      const subject = input.securityTitle ?? 'NestShip security notice';
      return {
        subject,
        node: (
          <EmailLayout preview={subject} supportEmail={input.supportEmail}>
            <h1
              style={{ fontSize: '24px', lineHeight: 1.25, margin: '0 0 16px' }}
            >
              {subject}
            </h1>
            <p style={{ fontSize: '16px', lineHeight: 1.6, margin: 0 }}>
              {input.securityMessage ??
                'A security-related change was made to your account.'}
            </p>
          </EmailLayout>
        ),
      };
    }
  }
}

function requiredActionUrl(input: TemplateInput): string {
  if (!input.actionUrl) {
    throw new Error(`Action URL is required for ${input.category}`);
  }

  return input.actionUrl;
}
