import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { minutes, Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { API_PREFIX, API_VERSION } from '../common/http/api.constants';
import { ApiStandardErrors } from '../common/http/decorators/api-standard-errors.decorator';
import { ApiErrorResponseDto } from '../common/http/dto/api-error-response.dto';
import { EnvironmentVariables } from '../config/env.validation';
import { AccessTokenGuard } from './access-token.guard';
import type { AuthenticatedUser } from './auth.types';
import { CookieOriginGuard } from './cookie-origin.guard';
import { CurrentUser } from './current-user.decorator';
import {
  TotpCodeDto,
  TwoFactorChallengeDto,
  TwoFactorStepUpDto,
} from './dto/auth-request.dto';
import {
  AuthResponseDto,
  MessageResponseDto,
  TwoFactorEnabledResponseDto,
  TwoFactorSetupResponseDto,
  TwoFactorStatusResponseDto,
} from './dto/auth-response.dto';
import { TwoFactorService } from './two-factor/two-factor.service';

@ApiTags('Two-factor authentication')
@ApiStandardErrors()
@Controller({ path: 'auth/2fa', version: API_VERSION })
export class TwoFactorController {
  constructor(
    private readonly twoFactorService: TwoFactorService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Get('status')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Return two-factor status for the current user' })
  @ApiOkResponse({ type: TwoFactorStatusResponseDto })
  getStatus(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TwoFactorStatusResponseDto> {
    return this.twoFactorService.getStatus(user.id);
  }

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  @Throttle({ default: { limit: 5, ttl: minutes(15) } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Begin authenticator setup' })
  @ApiOkResponse({ type: TwoFactorSetupResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  beginSetup(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TwoFactorSetupResponseDto> {
    return this.twoFactorService.beginSetup(user.id);
  }

  @Post('setup/confirm')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  @Throttle({ default: { limit: 5, ttl: minutes(5) } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Confirm setup and issue recovery codes once' })
  @ApiOkResponse({ type: TwoFactorEnabledResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async confirmSetup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TotpCodeDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TwoFactorEnabledResponseDto> {
    const result = await this.twoFactorService.confirmSetup(user.id, dto.code);
    this.clearRefreshCookie(response);
    return result;
  }

  @Post('backup-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  @Throttle({ default: { limit: 5, ttl: minutes(15) } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Replace all recovery codes after step-up auth' })
  @ApiOkResponse({ type: TwoFactorEnabledResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  regenerateBackupCodes(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorStepUpDto,
  ): Promise<TwoFactorEnabledResponseDto> {
    return this.twoFactorService.regenerateBackupCodes(user.id, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard, CookieOriginGuard)
  @Throttle({ default: { limit: 5, ttl: minutes(15) } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Disable two-factor authentication after step-up' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async disable(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorStepUpDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MessageResponseDto> {
    const result = await this.twoFactorService.disable(user.id, dto);
    this.clearRefreshCookie(response);
    return result;
  }

  @Post('challenge/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CookieOriginGuard)
  @Throttle({ default: { limit: 5, ttl: minutes(1) } })
  @ApiOperation({ summary: 'Complete a login challenge with a second factor' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async verifyChallenge(
    @Body() dto: TwoFactorChallengeDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const authentication = await this.twoFactorService.verifyLoginChallenge(
      dto.challengeToken,
      dto.code,
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
    return authentication.response;
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie(
      this.configService.getOrThrow<string>('AUTH_REFRESH_COOKIE_NAME'),
      {
        httpOnly: true,
        secure: this.configService.getOrThrow<boolean>('AUTH_COOKIE_SECURE'),
        sameSite: 'lax',
        path: `/${API_PREFIX}/v${API_VERSION}/auth`,
      },
    );
  }
}
