import { EmailCategory } from '../generated/prisma/enums';
import { renderEmailTemplate } from './email-templates';

describe('renderEmailTemplate', () => {
  it.each([
    [EmailCategory.EMAIL_VERIFICATION, 'Verify your email', 'verify-token'],
    [EmailCategory.PASSWORD_RESET, 'Reset your password', 'reset-token'],
    [EmailCategory.ORGANIZATION_INVITATION, 'You are invited', 'invite-token'],
  ])('renders HTML and text for %s', async (category, heading, token) => {
    const rendered = await renderEmailTemplate({
      actionUrl: `https://app.example.com/action?token=${token}`,
      category,
      organizationName: 'Acme',
      supportEmail: 'support@example.com',
    });

    expect(rendered.subject).toEqual(expect.any(String));
    expect(rendered.html).toContain(heading);
    expect(rendered.html).toContain(token);
    expect(rendered.text).toContain(token);
    expect(rendered.text).toContain('support@example.com');
  });

  it('renders a security notice without an action token', async () => {
    const rendered = await renderEmailTemplate({
      category: EmailCategory.SECURITY_NOTICE,
      securityMessage: 'Your password changed.',
      securityTitle: 'Password changed',
      supportEmail: 'security@example.com',
    });

    expect(rendered.subject).toBe('Password changed');
    expect(rendered.html).toContain('Your password changed.');
    expect(rendered.text).toContain('Your password changed.');
  });
});
