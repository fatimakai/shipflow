import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  SessionRevocationReason,
  TwoFactorChallengePurpose,
  UserStatus,
} from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import type { ClientContext } from '../auth.types';
import type { IssuedAuthentication } from '../authentication-result.types';
import type { TwoFactorStepUpDto } from '../dto/auth-request.dto';
import type {
  MessageResponseDto,
  TwoFactorChallengeResponseDto,
  TwoFactorEnabledResponseDto,
  TwoFactorSetupResponseDto,
  TwoFactorStatusResponseDto,
} from '../dto/auth-response.dto';
import { PasswordService } from '../password.service';
import { TokenService } from '../token.service';
import { BackupCodeService } from './backup-code.service';
import { TotpService } from './totp.service';
import { TwoFactorCryptoService } from './two-factor-crypto.service';

const LOGIN_CHALLENGE_TTL_SECONDS = 5 * 60;

interface CredentialForVerification {
  id: string;
  userId: string;
  encryptedSecret: Uint8Array;
  initializationVector: Uint8Array;
  authenticationTag: Uint8Array;
  encryptionKeyVersion: number;
  enabledAt: Date | null;
  lastUsedTimeStep: bigint | null;
}

type SecondFactorProof =
  | { kind: 'totp'; timeStep: number }
  | { kind: 'backup-code'; backupCodeId: string };

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly cryptoService: TwoFactorCryptoService,
    private readonly totpService: TotpService,
    private readonly backupCodeService: BackupCodeService,
  ) {}

  async getStatus(userId: string): Promise<TwoFactorStatusResponseDto> {
    const credential = await this.prisma.twoFactorCredential.findUnique({
      where: { userId },
      include: {
        _count: {
          select: { backupCodes: { where: { consumedAt: null } } },
        },
      },
    });

    return {
      enabled: credential?.enabledAt !== null && credential !== null,
      setupPending: credential !== null && credential.enabledAt === null,
      backupCodesRemaining:
        credential?.enabledAt === null
          ? 0
          : (credential?._count.backupCodes ?? 0),
    };
  }

  async beginSetup(userId: string): Promise<TwoFactorSetupResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE, deletedAt: null },
      select: { id: true, email: true, twoFactorCredential: true },
    });

    if (!user) {
      throw new UnauthorizedException('The authenticated user is unavailable');
    }
    if (user.twoFactorCredential?.enabledAt) {
      throw new ConflictException(
        'Two-factor authentication is already enabled',
      );
    }

    const secret = this.totpService.generateSecret();
    const encrypted = this.cryptoService.encryptSecret(secret, user.id);
    const encryptedData = {
      encryptedSecret: Uint8Array.from(encrypted.encryptedSecret),
      initializationVector: Uint8Array.from(encrypted.initializationVector),
      authenticationTag: Uint8Array.from(encrypted.authenticationTag),
      encryptionKeyVersion: encrypted.encryptionKeyVersion,
    };

    await this.prisma.twoFactorCredential.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...encryptedData },
      update: {
        ...encryptedData,
        enabledAt: null,
        lastUsedTimeStep: null,
        backupCodes: { deleteMany: {} },
      },
    });

    return {
      provisioningUri: this.totpService.createProvisioningUri(
        user.email,
        secret,
      ),
      manualEntryKey: secret,
    };
  }

  async confirmSetup(
    userId: string,
    code: string,
  ): Promise<TwoFactorEnabledResponseDto> {
    const credential = await this.prisma.twoFactorCredential.findUnique({
      where: { userId },
    });

    if (!credential || credential.enabledAt !== null) {
      throw new ConflictException('Two-factor setup is not pending');
    }

    const secret = this.decryptCredential(credential);
    const verification = await this.totpService.verifyToken(secret, code);

    if (!verification.valid) {
      throw new UnauthorizedException('Invalid authenticator code');
    }

    const backupCodes = this.backupCodeService.generate(userId);
    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      const enabled = await transaction.twoFactorCredential.updateMany({
        where: { id: credential.id, enabledAt: null },
        data: {
          enabledAt: now,
          lastUsedTimeStep: BigInt(verification.timeStep),
        },
      });

      if (enabled.count !== 1) {
        throw new ConflictException('Two-factor setup is no longer pending');
      }

      await transaction.twoFactorBackupCode.deleteMany({
        where: { credentialId: credential.id },
      });
      await transaction.twoFactorBackupCode.createMany({
        data: backupCodes.codeHashes.map((codeHash) => ({
          credentialId: credential.id,
          codeHash,
        })),
      });
      await transaction.session.updateMany({
        where: { userId, revokedAt: null },
        data: {
          revokedAt: now,
          revocationReason: SessionRevocationReason.ADMINISTRATIVE,
        },
      });
    });

    return { enabled: true, backupCodes: backupCodes.plaintextCodes };
  }

  async regenerateBackupCodes(
    userId: string,
    dto: TwoFactorStepUpDto,
  ): Promise<TwoFactorEnabledResponseDto> {
    const { credential, proof } = await this.verifyStepUp(userId, dto);
    const backupCodes = this.backupCodeService.generate(userId);
    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      await this.claimSecondFactor(transaction, credential, proof, now);
      await transaction.twoFactorBackupCode.deleteMany({
        where: { credentialId: credential.id },
      });
      await transaction.twoFactorBackupCode.createMany({
        data: backupCodes.codeHashes.map((codeHash) => ({
          credentialId: credential.id,
          codeHash,
        })),
      });
    });

    return { enabled: true, backupCodes: backupCodes.plaintextCodes };
  }

  async disable(
    userId: string,
    dto: TwoFactorStepUpDto,
  ): Promise<MessageResponseDto> {
    const { credential, proof } = await this.verifyStepUp(userId, dto);
    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      await this.claimSecondFactor(transaction, credential, proof, now);
      await transaction.twoFactorChallenge.deleteMany({ where: { userId } });
      await transaction.twoFactorCredential.delete({
        where: { id: credential.id },
      });
      await transaction.session.updateMany({
        where: { userId, revokedAt: null },
        data: {
          revokedAt: now,
          revocationReason: SessionRevocationReason.LOGOUT_ALL,
        },
      });
    });

    return { message: 'Two-factor authentication disabled' };
  }

  async isEnabled(userId: string): Promise<boolean> {
    const credential = await this.prisma.twoFactorCredential.findUnique({
      where: { userId },
      select: { enabledAt: true },
    });

    return credential?.enabledAt !== null && credential !== null;
  }

  async createLoginChallenge(
    userId: string,
    context: ClientContext,
  ): Promise<TwoFactorChallengeResponseDto> {
    const token = this.tokenService.createOpaqueToken();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + LOGIN_CHALLENGE_TTL_SECONDS * 1000,
    );

    await this.prisma.$transaction([
      this.prisma.twoFactorChallenge.deleteMany({
        where: {
          userId,
          OR: [{ expiresAt: { lte: now } }, { consumedAt: { not: null } }],
        },
      }),
      this.prisma.twoFactorChallenge.create({
        data: {
          userId,
          tokenHash: this.tokenService.hashOpaqueToken(token),
          purpose: TwoFactorChallengePurpose.LOGIN,
          expiresAt,
          ...this.sessionContext(context),
        },
      }),
    ]);

    return {
      requiresTwoFactor: true,
      challengeToken: token,
      expiresIn: LOGIN_CHALLENGE_TTL_SECONDS,
    };
  }

  async verifyLoginChallenge(
    challengeToken: string,
    code: string,
  ): Promise<IssuedAuthentication> {
    const now = new Date();
    const challenge = await this.prisma.twoFactorChallenge.findUnique({
      where: {
        tokenHash: this.tokenService.hashOpaqueToken(challengeToken),
      },
      include: { user: true },
    });

    if (
      !challenge ||
      challenge.purpose !== TwoFactorChallengePurpose.LOGIN ||
      challenge.consumedAt !== null ||
      challenge.expiresAt.getTime() <= now.getTime() ||
      challenge.user.status !== UserStatus.ACTIVE ||
      challenge.user.deletedAt !== null
    ) {
      throw new UnauthorizedException(
        'Invalid or expired two-factor challenge',
      );
    }

    const credential = await this.prisma.twoFactorCredential.findUnique({
      where: { userId: challenge.userId },
    });

    if (!credential || credential.enabledAt === null) {
      throw new UnauthorizedException(
        'Invalid or expired two-factor challenge',
      );
    }

    const proof = await this.resolveSecondFactor(credential, code);

    if (!proof) {
      throw new UnauthorizedException('Invalid two-factor code');
    }

    const refreshToken = this.tokenService.createOpaqueToken();
    const refreshExpiresAt = this.tokenService.getRefreshExpiration();

    await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.twoFactorChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });

      if (consumed.count !== 1) {
        throw new UnauthorizedException(
          'Invalid or expired two-factor challenge',
        );
      }

      await this.claimSecondFactor(transaction, credential, proof, now);
      await transaction.user.update({
        where: { id: challenge.userId },
        data: { lastLoginAt: now },
      });
      await transaction.session.create({
        data: {
          userId: challenge.userId,
          tokenHash: this.tokenService.hashOpaqueToken(refreshToken),
          expiresAt: refreshExpiresAt,
          ipAddress: challenge.ipAddress,
          userAgent: challenge.userAgent,
        },
      });
    });

    return {
      kind: 'authenticated',
      response: {
        accessToken: await this.tokenService.signAccessToken(challenge.user),
        tokenType: 'Bearer',
        expiresIn: this.tokenService.getAccessTokenTtlSeconds(),
        user: {
          id: challenge.user.id,
          email: challenge.user.email,
          displayName: challenge.user.displayName,
          avatarUrl: challenge.user.avatarUrl,
          emailVerified: challenge.user.emailVerifiedAt !== null,
        },
      },
      refreshToken,
      refreshExpiresAt,
    };
  }

  private async verifyStepUp(
    userId: string,
    dto: TwoFactorStepUpDto,
  ): Promise<{
    credential: CredentialForVerification;
    proof: SecondFactorProof;
  }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE, deletedAt: null },
      select: { passwordHash: true, twoFactorCredential: true },
    });
    const credential = user?.twoFactorCredential;

    if (!user || !credential || credential.enabledAt === null) {
      throw new ConflictException('Two-factor authentication is not enabled');
    }

    if (
      user.passwordHash !== null &&
      (!dto.currentPassword ||
        !(await this.passwordService.verify(
          user.passwordHash,
          dto.currentPassword,
        )))
    ) {
      throw new UnauthorizedException('Password re-authentication failed');
    }

    const proof = await this.resolveSecondFactor(credential, dto.code);

    if (!proof) {
      throw new UnauthorizedException('Invalid two-factor code');
    }

    return { credential, proof };
  }

  private async resolveSecondFactor(
    credential: CredentialForVerification,
    code: string,
  ): Promise<SecondFactorProof | null> {
    if (/^\d{6}$/.test(code)) {
      const verification = await this.totpService.verifyToken(
        this.decryptCredential(credential),
        code,
        credential.lastUsedTimeStep === null
          ? undefined
          : Number(credential.lastUsedTimeStep),
      );

      return verification.valid
        ? { kind: 'totp', timeStep: verification.timeStep }
        : null;
    }

    const codeHash = this.backupCodeService.hash(code, credential.userId);

    if (!codeHash) return null;

    const backupCode = await this.prisma.twoFactorBackupCode.findUnique({
      where: { codeHash },
      select: { id: true, credentialId: true, consumedAt: true },
    });

    return backupCode &&
      backupCode.credentialId === credential.id &&
      backupCode.consumedAt === null
      ? { kind: 'backup-code', backupCodeId: backupCode.id }
      : null;
  }

  private async claimSecondFactor(
    transaction: Prisma.TransactionClient,
    credential: CredentialForVerification,
    proof: SecondFactorProof,
    now: Date,
  ): Promise<void> {
    const claim =
      proof.kind === 'totp'
        ? await transaction.twoFactorCredential.updateMany({
            where: {
              id: credential.id,
              enabledAt: { not: null },
              OR: [
                { lastUsedTimeStep: null },
                { lastUsedTimeStep: { lt: BigInt(proof.timeStep) } },
              ],
            },
            data: { lastUsedTimeStep: BigInt(proof.timeStep) },
          })
        : await transaction.twoFactorBackupCode.updateMany({
            where: {
              id: proof.backupCodeId,
              credentialId: credential.id,
              consumedAt: null,
            },
            data: { consumedAt: now },
          });

    if (claim.count !== 1) {
      throw new UnauthorizedException('Two-factor code has already been used');
    }
  }

  private decryptCredential(credential: CredentialForVerification): string {
    return this.cryptoService.decryptSecret(
      {
        encryptedSecret: Buffer.from(credential.encryptedSecret),
        initializationVector: Buffer.from(credential.initializationVector),
        authenticationTag: Buffer.from(credential.authenticationTag),
        encryptionKeyVersion: credential.encryptionKeyVersion,
      },
      credential.userId,
    );
  }

  private sessionContext(context: ClientContext): ClientContext {
    return {
      ipAddress: context.ipAddress?.slice(0, 45),
      userAgent: context.userAgent?.slice(0, 512),
    };
  }
}
