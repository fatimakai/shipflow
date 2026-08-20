import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  cookies: Record<string, string | undefined>;
}

export interface ClientContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  type: 'access';
  jti: string;
}

export interface OAuthProfile {
  provider: 'google' | 'github';
  providerAccountId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}
