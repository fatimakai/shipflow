import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { EnvironmentVariables } from '../config/env.validation';
import { OAuthStateStore } from './oauth-state.store';

describe('OAuthStateStore', () => {
  const configService = new ConfigService<EnvironmentVariables, true>({
    JWT_ACCESS_SECRET: 'unit-test-jwt-secret-that-is-at-least-32-characters',
    AUTH_COOKIE_SECURE: false,
  });
  const store = new OAuthStateStore(configService);

  it('stores and verifies a signed state in an HttpOnly cookie', () => {
    const cookie = jest.fn();
    const clearCookie = jest.fn();
    const request = {
      cookies: {},
      res: { cookie, clearCookie } as unknown as Response,
    } as Request;
    let state = '';

    store.store(request, {}, (error, storedState) => {
      expect(error).toBeNull();
      state = storedState ?? '';
    });

    expect(state).not.toBe('');
    expect(cookie).toHaveBeenCalledWith(
      'shipflow_oauth_state',
      state,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );

    request.cookies = { shipflow_oauth_state: state };
    let verified = false;
    store.verify(request, state, {}, (_error, result) => {
      verified = result;
    });

    expect(verified).toBe(true);
    expect(clearCookie).toHaveBeenCalled();
  });

  it('rejects a tampered state', () => {
    const request = {
      cookies: { shipflow_oauth_state: 'tampered.state' },
      res: { clearCookie: jest.fn() } as unknown as Response,
    } as Request;
    let verified = true;

    store.verify(request, 'tampered.state', {}, (_error, result) => {
      verified = result;
    });

    expect(verified).toBe(false);
  });
});
