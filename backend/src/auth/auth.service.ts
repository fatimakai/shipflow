import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../database/prisma.service';
import {
  InjectTransactionalEmailDelivery,
  type TransactionalEmailDelivery,
} from '../email/email.types';
import {
  NotificationCategory,
  NotificationType,
  SessionRevocationReason,
  UserStatus,
} from '../generated/prisma/enums';
import { writeNotification } from '../notifications/notification.writer';
import type {
  AuthenticationAttempt,
  IssuedAuthentication,
} from './authentication-result.types';
import type { ClientContext, OAuthProfile } from './auth.types';
import {
  AuthUserResponseDto,
  MessageResponseDto,
} from './dto/auth-response.dto';
import {
  EmailDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  TokenDto,
  UpdateProfileDto,
} from './dto/auth-request.dto';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { TwoFactorService } from './two-factor/two-factor.service';

interface UserForResponse {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  emailVerifiedAt: Date | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly twoFactorService: TwoFactorService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    @InjectTransactionalEmailDelivery()
    private readonly delivery: TransactionalEmailDelivery,
  ) {}

  async register(
    dto: RegisterDto,
    context: ClientContext,
  ): Promise<IssuedAuthentication> {
    const email = this.normalizeEmail(dto.email);
    const passwordHash = await this.passwordService.hash(dto.password);
    const refreshToken = this.tokenService.createOpaqueToken();
    const verificationToken = this.tokenService.createOpaqueToken();
    const refreshExpiresAt = this.tokenService.getRefreshExpiration();
    const verificationExpiresAt = this.getEmailVerificationExpiration();
    const now = new Date();

    let user: UserForResponse;

    try {
      user = await this.prisma.$transaction(async (transaction) => {
        const createdUser = await transaction.user.create({
          data: {
            email,
            displayName: dto.displayName,
            passwordHash,
            lastLoginAt: now,
          },
          select: this.userResponseSelection,
        });

        await transaction.emailVerificationToken.create({
          data: {
            userId: createdUser.id,
            email,
            tokenHash: this.tokenService.hashOpaqueToken(verificationToken),
            expiresAt: verificationExpiresAt,
          },
        });

        await transaction.session.create({
          data: {
            userId: createdUser.id,
            tokenHash: this.tokenService.hashOpaqueToken(refreshToken),
            expiresAt: refreshExpiresAt,
            ...this.sessionContext(context),
          },
        });

        return createdUser;
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }

      throw error;
    }

    await this.delivery.sendEmailVerification(email, verificationToken);

    return this.buildAuthentication(user, refreshToken, refreshExpiresAt);
  }

  async login(
    dto: LoginDto,
    context: ClientContext,
  ): Promise<AuthenticationAttempt> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        ...this.userResponseSelection,
        passwordHash: true,
        status: true,
        deletedAt: true,
      },
    });

    const passwordValid =
      user?.passwordHash !== null && user?.passwordHash !== undefined
        ? await this.passwordService.verify(user.passwordHash, dto.password)
        : false;

    if (
      !user ||
      !passwordValid ||
      user.status !== UserStatus.ACTIVE ||
      user.deletedAt !== null
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.completeFirstFactor(user, context);
  }

  async authenticateOAuth(
    profile: OAuthProfile,
    context: ClientContext,
  ): Promise<AuthenticationAttempt> {
    const email = this.normalizeEmail(profile.email);
    const now = new Date();

    const user = await this.prisma.$transaction(async (transaction) => {
      const existingAccount = await transaction.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: profile.provider,
            providerAccountId: profile.providerAccountId,
          },
        },
        include: { user: true },
      });

      let authenticatedUser = existingAccount?.user;

      if (!authenticatedUser) {
        authenticatedUser = await transaction.user.upsert({
          where: { email },
          update: {},
          create: {
            email,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            emailVerifiedAt: now,
          },
        });

        await transaction.oAuthAccount.create({
          data: {
            userId: authenticatedUser.id,
            provider: profile.provider,
            providerAccountId: profile.providerAccountId,
          },
        });
      }

      if (
        authenticatedUser.status !== UserStatus.ACTIVE ||
        authenticatedUser.deletedAt !== null
      ) {
        throw new UnauthorizedException('OAuth authentication is unavailable');
      }

      authenticatedUser = await transaction.user.update({
        where: { id: authenticatedUser.id },
        data: {
          avatarUrl: authenticatedUser.avatarUrl ?? profile.avatarUrl,
          displayName: authenticatedUser.displayName ?? profile.displayName,
          emailVerifiedAt: authenticatedUser.emailVerifiedAt ?? now,
        },
      });
      return authenticatedUser;
    });

    return this.completeFirstFactor(user, context);
  }

  async refresh(
    refreshToken: string,
    context: ClientContext,
  ): Promise<IssuedAuthentication> {
    const tokenHash = this.tokenService.hashOpaqueToken(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.revokedAt !== null) {
      if (session.revocationReason === SessionRevocationReason.ROTATED) {
        await this.revokeTokenFamily(session.tokenFamilyId);
      }

      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (
      session.expiresAt.getTime() <= Date.now() ||
      session.user.status !== UserStatus.ACTIVE ||
      session.user.deletedAt !== null
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const replacementToken = this.tokenService.createOpaqueToken();
    const replacementExpiresAt = this.tokenService.getRefreshExpiration();
    const now = new Date();

    try {
      await this.prisma.$transaction(async (transaction) => {
        const replacement = await transaction.session.create({
          data: {
            userId: session.userId,
            tokenHash: this.tokenService.hashOpaqueToken(replacementToken),
            tokenFamilyId: session.tokenFamilyId,
            expiresAt: replacementExpiresAt,
            ...this.sessionContext(context),
          },
        });
        const rotation = await transaction.session.updateMany({
          where: { id: session.id, revokedAt: null },
          data: {
            revokedAt: now,
            revocationReason: SessionRevocationReason.ROTATED,
            replacedById: replacement.id,
            lastUsedAt: now,
          },
        });

        if (rotation.count !== 1) {
          throw new UnauthorizedException(
            'Refresh token has already been used',
          );
        }
      });
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        await this.revokeTokenFamily(session.tokenFamilyId);
      }

      throw error;
    }

    return this.buildAuthentication(
      session.user,
      replacementToken,
      replacementExpiresAt,
    );
  }

  async logout(refreshToken?: string): Promise<MessageResponseDto> {
    if (refreshToken) {
      await this.prisma.session.updateMany({
        where: {
          tokenHash: this.tokenService.hashOpaqueToken(refreshToken),
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revocationReason: SessionRevocationReason.LOGOUT,
        },
      });
    }

    return { message: 'Signed out' };
  }

  async logoutAll(userId: string): Promise<MessageResponseDto> {
    await this.prisma.$transaction([
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revocationReason: SessionRevocationReason.LOGOUT_ALL,
        },
      }),
      this.prisma.twoFactorChallenge.deleteMany({ where: { userId } }),
    ]);

    return { message: 'Signed out from all sessions' };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<AuthUserResponseDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { displayName: dto.displayName },
      select: this.userResponseSelection,
    });

    return this.toUserResponse(user);
  }

  async requestEmailVerification(userId: string): Promise<MessageResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE, deletedAt: null },
      select: { id: true, email: true, emailVerifiedAt: true },
    });

    if (!user || user.emailVerifiedAt !== null) {
      return { message: 'Verification request accepted' };
    }

    const token = this.tokenService.createOpaqueToken();

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.deleteMany({
        where: { userId, consumedAt: null },
      }),
      this.prisma.emailVerificationToken.create({
        data: {
          userId,
          email: user.email,
          tokenHash: this.tokenService.hashOpaqueToken(token),
          expiresAt: this.getEmailVerificationExpiration(),
        },
      }),
    ]);

    await this.delivery.sendEmailVerification(user.email, token);

    return { message: 'Verification request accepted' };
  }

  async confirmEmailVerification(dto: TokenDto): Promise<MessageResponseDto> {
    const token = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: this.tokenService.hashOpaqueToken(dto.token) },
      include: { user: true },
    });

    if (
      !token ||
      token.consumedAt !== null ||
      token.expiresAt.getTime() <= Date.now() ||
      token.user.email !== token.email ||
      token.user.status !== UserStatus.ACTIVE ||
      token.user.deletedAt !== null
    ) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.emailVerificationToken.updateMany({
        where: { id: token.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      if (consumed.count !== 1) {
        throw new BadRequestException(
          'Verification token has already been used',
        );
      }

      await transaction.user.update({
        where: { id: token.userId },
        data: { emailVerifiedAt: new Date() },
      });
    });

    return { message: 'Email verified' };
  }

  async forgotPassword(dto: EmailDto): Promise<MessageResponseDto> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        passwordHash: { not: null },
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      select: { id: true, email: true },
    });

    if (user) {
      const token = this.tokenService.createOpaqueToken();

      await this.prisma.$transaction([
        this.prisma.passwordResetToken.deleteMany({
          where: { userId: user.id, consumedAt: null },
        }),
        this.prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: this.tokenService.hashOpaqueToken(token),
            expiresAt: this.getPasswordResetExpiration(),
          },
        }),
      ]);

      await this.delivery.sendPasswordReset(user.email, token);
    }

    return { message: 'Password reset request accepted' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<MessageResponseDto> {
    const token = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.tokenService.hashOpaqueToken(dto.token) },
      include: { user: true },
    });

    if (
      !token ||
      token.consumedAt !== null ||
      token.expiresAt.getTime() <= Date.now() ||
      token.user.status !== UserStatus.ACTIVE ||
      token.user.deletedAt !== null
    ) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.passwordResetToken.updateMany({
        where: { id: token.id, consumedAt: null },
        data: { consumedAt: now },
      });

      if (consumed.count !== 1) {
        throw new BadRequestException(
          'Password reset token has already been used',
        );
      }

      await transaction.user.update({
        where: { id: token.userId },
        data: { passwordHash },
      });
      await transaction.passwordResetToken.deleteMany({
        where: { userId: token.userId, id: { not: token.id } },
      });
      await transaction.session.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: {
          revokedAt: now,
          revocationReason: SessionRevocationReason.LOGOUT_ALL,
        },
      });
      await transaction.twoFactorChallenge.deleteMany({
        where: { userId: token.userId },
      });
      await writeNotification(transaction, {
        userId: token.userId,
        category: NotificationCategory.SECURITY,
        type: NotificationType.PASSWORD_CHANGED,
        title: 'Password changed',
        message:
          'Your password was changed and all existing sessions were signed out.',
        actionPath: '/settings/password',
        dedupeKey: `password-changed:${token.id}`,
        createdAt: now,
      });
    });

    return { message: 'Password reset successfully' };
  }

  private async buildAuthentication(
    user: UserForResponse,
    refreshToken: string,
    refreshExpiresAt: Date,
  ): Promise<IssuedAuthentication> {
    return {
      kind: 'authenticated',
      response: {
        accessToken: await this.tokenService.signAccessToken(user),
        tokenType: 'Bearer',
        expiresIn: this.tokenService.getAccessTokenTtlSeconds(),
        user: this.toUserResponse(user),
      },
      refreshToken,
      refreshExpiresAt,
    };
  }

  private async completeFirstFactor(
    user: UserForResponse,
    context: ClientContext,
  ): Promise<AuthenticationAttempt> {
    if (await this.twoFactorService.isEnabled(user.id)) {
      return {
        kind: 'two-factor',
        response: await this.twoFactorService.createLoginChallenge(
          user.id,
          context,
        ),
      };
    }

    const refreshToken = this.tokenService.createOpaqueToken();
    const refreshExpiresAt = this.tokenService.getRefreshExpiration();
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: now },
      }),
      this.prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: this.tokenService.hashOpaqueToken(refreshToken),
          expiresAt: refreshExpiresAt,
          ...this.sessionContext(context),
        },
      }),
    ]);

    return this.buildAuthentication(user, refreshToken, refreshExpiresAt);
  }

  private toUserResponse(user: UserForResponse): AuthUserResponseDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerifiedAt !== null,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private getEmailVerificationExpiration(): Date {
    const hours = this.configService.getOrThrow<number>(
      'EMAIL_VERIFICATION_TOKEN_TTL_HOURS',
    );
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  private getPasswordResetExpiration(): Date {
    const minutes = this.configService.getOrThrow<number>(
      'PASSWORD_RESET_TOKEN_TTL_MINUTES',
    );
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  private sessionContext(context: ClientContext): ClientContext {
    return {
      ipAddress: context.ipAddress?.slice(0, 45),
      userAgent: context.userAgent?.slice(0, 512),
    };
  }

  private async revokeTokenFamily(tokenFamilyId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenFamilyId, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revocationReason: SessionRevocationReason.REUSE_DETECTED,
      },
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private readonly userResponseSelection = {
    id: true,
    email: true,
    displayName: true,
    avatarUrl: true,
    emailVerifiedAt: true,
  } as const;
}
