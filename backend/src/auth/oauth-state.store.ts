import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { API_PREFIX, API_VERSION } from '../common/http/api.constants';
import { EnvironmentVariables } from '../config/env.validation';

type StoreCallback = (error: Error | null, state?: string) => void;
type VerifyCallback = (
  error: Error | null,
  verified: boolean,
  state?: unknown,
) => void;

@Injectable()
export class OAuthStateStore {
  private readonly cookieName = 'nestship_oauth_state';

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  store(request: Request, done: StoreCallback): void;
  store(request: Request, metadata: unknown, done: StoreCallback): void;
  store(
    request: Request,
    metadataOrDone: Record<string, unknown> | StoreCallback,
    maybeDone?: StoreCallback,
  ): void {
    const done: StoreCallback | undefined =
      typeof metadataOrDone === 'function' ? metadataOrDone : maybeDone;

    if (!done) {
      return;
    }

    const nonce = randomBytes(24).toString('base64url');
    const state = `${nonce}.${this.sign(nonce)}`;

    request.res?.cookie(this.cookieName, state, {
      httpOnly: true,
      secure: this.configService.getOrThrow<boolean>('AUTH_COOKIE_SECURE'),
      sameSite: 'lax',
      path: `/${API_PREFIX}/v${API_VERSION}/auth/oauth`,
      maxAge: 10 * 60 * 1000,
    });
    done(null, state);
  }

  verify(request: Request, providedState: string, done: VerifyCallback): void;
  verify(
    request: Request,
    providedState: string,
    metadata: unknown,
    done: VerifyCallback,
  ): void;
  verify(
    request: Request,
    providedState: string,
    metadataOrDone: Record<string, unknown> | VerifyCallback,
    maybeDone?: VerifyCallback,
  ): void {
    const done: VerifyCallback | undefined =
      typeof metadataOrDone === 'function' ? metadataOrDone : maybeDone;

    if (!done) {
      return;
    }

    const cookies = request.cookies as Record<string, string | undefined>;
    const storedState = cookies?.[this.cookieName];

    request.res?.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: this.configService.getOrThrow<boolean>('AUTH_COOKIE_SECURE'),
      sameSite: 'lax',
      path: `/${API_PREFIX}/v${API_VERSION}/auth/oauth`,
    });

    if (
      !storedState ||
      !providedState ||
      !this.safeEqual(storedState, providedState) ||
      !this.hasValidSignature(providedState)
    ) {
      done(null, false, { message: 'Invalid OAuth state' });
      return;
    }

    done(null, true);
  }

  private hasValidSignature(state: string): boolean {
    const separator = state.lastIndexOf('.');

    if (separator <= 0) {
      return false;
    }

    const nonce = state.slice(0, separator);
    return this.safeEqual(state.slice(separator + 1), this.sign(nonce));
  }

  private sign(value: string): string {
    return createHmac(
      'sha256',
      this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    )
      .update(value)
      .digest('base64url');
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }
}
