import {
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';
import { EnvironmentVariables } from '../config/env.validation';

type GuardResult = boolean | Promise<boolean> | Observable<boolean>;

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {
    super();
  }

  canActivate(context: ExecutionContext): GuardResult {
    this.assertConfigured('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET');
    return super.canActivate(context);
  }

  private assertConfigured(
    clientIdKey: 'GOOGLE_CLIENT_ID',
    clientSecretKey: 'GOOGLE_CLIENT_SECRET',
  ): void {
    if (
      !this.configService.get<string>(clientIdKey) ||
      !this.configService.get<string>(clientSecretKey)
    ) {
      throw new ServiceUnavailableException('Google OAuth is not configured');
    }
  }
}

@Injectable()
export class GitHubOAuthGuard extends AuthGuard('github') {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {
    super();
  }

  canActivate(context: ExecutionContext): GuardResult {
    if (
      !this.configService.get<string>('GITHUB_CLIENT_ID') ||
      !this.configService.get<string>('GITHUB_CLIENT_SECRET')
    ) {
      throw new ServiceUnavailableException('GitHub OAuth is not configured');
    }

    return super.canActivate(context);
  }
}
