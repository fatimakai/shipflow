import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { API_PREFIX, API_VERSION } from '../common/http/api.constants';
import { ApiStandardErrors } from '../common/http/decorators/api-standard-errors.decorator';
import { ApiErrorResponseDto } from '../common/http/dto/api-error-response.dto';
import { EnvironmentVariables } from '../config/env.validation';
import { AuthService } from './auth.service';
import type { ClientContext, OAuthProfile } from './auth.types';
import { GitHubOAuthGuard, GoogleOAuthGuard } from './oauth.guard';

interface OAuthRequest extends Request {
  user: OAuthProfile;
}

@ApiTags('Authentication')
@ApiStandardErrors()
@Controller({ path: 'auth/oauth', version: API_VERSION })
export class OAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({ summary: 'Start Google OAuth authentication' })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto })
  startGoogle(): void {}

  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({ summary: 'Complete Google OAuth authentication' })
  completeGoogle(
    @Req() request: OAuthRequest,
    @Res() response: Response,
  ): Promise<void> {
    return this.completeOAuth(request, response);
  }

  @Get('github')
  @UseGuards(GitHubOAuthGuard)
  @ApiOperation({ summary: 'Start GitHub OAuth authentication' })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto })
  startGitHub(): void {}

  @Get('github/callback')
  @UseGuards(GitHubOAuthGuard)
  @ApiOperation({ summary: 'Complete GitHub OAuth authentication' })
  completeGitHub(
    @Req() request: OAuthRequest,
    @Res() response: Response,
  ): Promise<void> {
    return this.completeOAuth(request, response);
  }

  private async completeOAuth(
    request: OAuthRequest,
    response: Response,
  ): Promise<void> {
    const authentication = await this.authService.authenticateOAuth(
      request.user,
      this.getClientContext(request),
    );

    response.cookie(
      this.configService.getOrThrow<string>('AUTH_REFRESH_COOKIE_NAME'),
      authentication.refreshToken,
      {
        httpOnly: true,
        secure: this.configService.getOrThrow<boolean>('AUTH_COOKIE_SECURE'),
        sameSite: 'lax',
        path: `/${API_PREFIX}/v${API_VERSION}/auth`,
        expires: authentication.refreshExpiresAt,
      },
    );

    const callbackUrl = new URL(
      'auth/callback',
      `${this.configService.getOrThrow<string>('FRONTEND_URL')}/`,
    );
    response.redirect(callbackUrl.toString());
  }

  private getClientContext(request: Request): ClientContext {
    return {
      ipAddress: request.ip ?? request.socket.remoteAddress,
      userAgent: request.get('user-agent'),
    };
  }
}
