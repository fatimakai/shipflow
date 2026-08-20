import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  Profile as GitHubProfile,
  Strategy as GitHubPassportStrategy,
} from 'passport-github2';
import {
  Profile as GoogleProfile,
  Strategy as GooglePassportStrategy,
} from 'passport-google-oauth20';
import { EnvironmentVariables } from '../config/env.validation';
import type { OAuthProfile } from './auth.types';
import { OAuthStateStore } from './oauth-state.store';

interface GitHubEmail {
  value: string;
  primary?: boolean;
  verified?: boolean;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(
  GooglePassportStrategy,
  'google',
) {
  constructor(
    configService: ConfigService<EnvironmentVariables, true>,
    stateStore: OAuthStateStore,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') ?? 'disabled',
      clientSecret:
        configService.get<string>('GOOGLE_CLIENT_SECRET') ?? 'disabled',
      callbackURL: configService.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
      store: stateStore,
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: GoogleProfile,
  ): OAuthProfile {
    const email = profile.emails?.find((entry) => entry.verified)?.value;

    if (!email) {
      throw new UnauthorizedException(
        'Google did not provide a verified email address',
      );
    }

    return {
      provider: 'google',
      providerAccountId: profile.id,
      email: email.trim().toLowerCase(),
      displayName: profile.displayName || null,
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
  }
}

@Injectable()
export class GitHubStrategy extends PassportStrategy(
  GitHubPassportStrategy,
  'github',
) {
  constructor(
    configService: ConfigService<EnvironmentVariables, true>,
    stateStore: OAuthStateStore,
  ) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID') ?? 'disabled',
      clientSecret:
        configService.get<string>('GITHUB_CLIENT_SECRET') ?? 'disabled',
      callbackURL: configService.getOrThrow<string>('GITHUB_CALLBACK_URL'),
      scope: ['user:email'],
      allRawEmails: true,
      store: stateStore,
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: GitHubProfile,
  ): OAuthProfile {
    const emails = (profile.emails ?? []) as GitHubEmail[];
    const email =
      emails.find((entry) => entry.primary && entry.verified)?.value ??
      emails.find((entry) => entry.verified)?.value;

    if (!email) {
      throw new UnauthorizedException(
        'GitHub did not provide a verified email address',
      );
    }

    return {
      provider: 'github',
      providerAccountId: profile.id,
      email: email.trim().toLowerCase(),
      displayName: profile.displayName || profile.username || null,
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
  }
}
