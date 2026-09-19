import { PUBLIC_DEMO_UNAVAILABLE } from './public-demo.decorator';
import { AuthController } from '../auth/auth.controller';
import { ResendWebhookController } from '../email/resend-webhook.controller';
import { FilesController } from '../files/files.controller';
import { LocalFileContentController } from '../files/local-file-content.controller';

describe('public demo endpoint policy', () => {
  it.each([
    ['register', 'register'],
    ['email verification request', 'requestEmailVerification'],
    ['email verification confirmation', 'confirmEmailVerification'],
    ['password reset request', 'forgotPassword'],
    ['password reset completion', 'resetPassword'],
  ] as const)('marks %s unavailable', (_name, methodName) => {
    const handler = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      methodName,
    )?.value as unknown;
    expect(Reflect.getMetadata(PUBLIC_DEMO_UNAVAILABLE, handler)).toBe(true);
  });

  it.each([
    FilesController,
    LocalFileContentController,
    ResendWebhookController,
  ])('marks %p unavailable', (controller) => {
    expect(Reflect.getMetadata(PUBLIC_DEMO_UNAVAILABLE, controller)).toBe(true);
  });
});
