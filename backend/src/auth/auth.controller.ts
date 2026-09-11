import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { minutes, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { API_PREFIX, API_VERSION } from '../common/http/api.constants';
import { ApiStandardErrors } from '../common/http/decorators/api-standard-errors.decorator';
import { ApiErrorResponseDto } from '../common/http/dto/api-error-response.dto';
import { EnvironmentVariables } from '../config/env.validation';
import { AccessTokenGuard } from './access-token.guard';
import { AuthService } from './auth.service';
import type { AuthenticatedUser, ClientContext } from './auth.types';
import { CookieOriginGuard } from './cookie-origin.guard';
import { CurrentUser } from './current-user.decorator';
import {
  AuthResponseDto,
  AuthUserResponseDto,
  MessageResponseDto,
  TwoFactorChallengeResponseDto,
} from './dto/auth-response.dto';
import {
  EmailDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  TokenDto,
  UpdateProfileDto,
} from './dto/auth-request.dto';

@ApiTags('Authentication')
@ApiStandardErrors()
@ApiExtraModels(AuthResponseDto, TwoFactorChallengeResponseDto)
@Controller({ path: 'auth', version: API_VERSION })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Post('register')
  @UseGuards(CookieOriginGuard)
  @Throttle({ default: { limit: 5, ttl: minutes(1) } })
  @ApiOperation({
    summary: 'Create a local account and authentication session',
  })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const authentication = await this.authService.register(
      dto,
      this.getClientContext(request),
    );
    this.setRefreshCookie(
      response,
      authentication.refreshToken,
      authentication.refreshExpiresAt,
    );
    return authentication.response;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CookieOriginGuard)
  @Throttle({ default: { limit: 5, ttl: minutes(1) } })
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(AuthResponseDto) },
        { $ref: getSchemaPath(TwoFactorChallengeResponseDto) },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto | TwoFactorChallengeResponseDto> {
    const authentication = await this.authService.login(
      dto,
      this.getClientContext(request),
    );

    if (authentication.kind === 'two-factor') {
      return authentication.response;
    }

    this.setRefreshCookie(
      response,
      authentication.refreshToken,
      authentication.refreshExpiresAt,
    );
    return authentication.response;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CookieOriginGuard)
  @Throttle({ default: { limit: 20, ttl: minutes(1) } })
  @ApiOperation({
    summary: 'Rotate the refresh session and issue an access token',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const refreshToken = this.getRefreshCookie(request);

    if (!refreshToken) {
      throw new UnauthorizedException('A refresh token is required');
    }

    const authentication = await this.authService.refresh(
      refreshToken,
      this.getClientContext(request),
    );
    this.setRefreshCookie(
      response,
      authentication.refreshToken,
      authentication.refreshExpiresAt,
    );
    return authentication.response;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CookieOriginGuard)
  @ApiOperation({ summary: 'Revoke the current refresh session' })
  @ApiOkResponse({ type: MessageResponseDto })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MessageResponseDto> {
    const result = await this.authService.logout(
      this.getRefreshCookie(request),
    );
    this.clearRefreshCookie(response);
    return result;
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Revoke every refresh session for the current user',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MessageResponseDto> {
    const result = await this.authService.logoutAll(user.id);
    this.clearRefreshCookie(response);
    return result;
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Return the current authenticated user' })
  @ApiOkResponse({ type: AuthUserResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  getCurrentUser(@CurrentUser() user: AuthenticatedUser): AuthUserResponseDto {
    return user;
  }

  @Patch('me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update the current authenticated user profile' })
  @ApiOkResponse({ type: AuthUserResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  updateCurrentUser(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<AuthUserResponseDto> {
    return this.authService.updateProfile(user.id, dto);
  }

  @Post('email-verification/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AccessTokenGuard)
  @Throttle({ default: { limit: 3, ttl: minutes(15) } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Request a new email verification token' })
  @ApiOkResponse({ type: MessageResponseDto })
  requestEmailVerification(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    return this.authService.requestEmailVerification(user.id);
  }

  @Post('email-verification/confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: minutes(15) } })
  @ApiOperation({ summary: 'Verify an email using a single-use token' })
  @ApiOkResponse({ type: MessageResponseDto })
  confirmEmailVerification(@Body() dto: TokenDto): Promise<MessageResponseDto> {
    return this.authService.confirmEmailVerification(dto);
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: minutes(15) } })
  @ApiOperation({
    summary: 'Request a password reset without revealing account existence',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  forgotPassword(@Body() dto: EmailDto): Promise<MessageResponseDto> {
    return this.authService.forgotPassword(dto);
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: minutes(15) } })
  @ApiOperation({ summary: 'Reset a password using a single-use token' })
  @ApiOkResponse({ type: MessageResponseDto })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponseDto> {
    return this.authService.resetPassword(dto);
  }

  private getClientContext(request: Request): ClientContext {
    return {
      ipAddress: request.ip ?? request.socket.remoteAddress,
      userAgent: request.get('user-agent'),
    };
  }

  private getRefreshCookie(request: Request): string | undefined {
    const cookieName = this.configService.getOrThrow<string>(
      'AUTH_REFRESH_COOKIE_NAME',
    );
    const cookies = request.cookies as Record<string, string | undefined>;
    return cookies?.[cookieName];
  }

  private setRefreshCookie(
    response: Response,
    token: string,
    expires: Date,
  ): void {
    response.cookie(
      this.configService.getOrThrow<string>('AUTH_REFRESH_COOKIE_NAME'),
      token,
      {
        httpOnly: true,
        secure: this.configService.getOrThrow<boolean>('AUTH_COOKIE_SECURE'),
        sameSite: 'lax',
        path: `/${API_PREFIX}/v${API_VERSION}/auth`,
        expires,
      },
    );
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
