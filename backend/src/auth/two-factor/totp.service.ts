import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateSecret, generateURI, verify } from 'otplib';
import { EnvironmentVariables } from '../../config/env.validation';
import { TotpVerificationResult } from './two-factor.types';

const TOTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_PAST_TOLERANCE_SECONDS = 30;
const TOTP_TOKEN_PATTERN = /^\d{6}$/;

@Injectable()
export class TotpService {
  private readonly issuer: string;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    this.issuer = configService.getOrThrow<string>('TWO_FACTOR_ISSUER');
  }

  generateSecret(): string {
    return generateSecret();
  }

  createProvisioningUri(accountLabel: string, secret: string): string {
    return generateURI({
      algorithm: 'sha1',
      digits: TOTP_DIGITS,
      issuer: this.issuer,
      label: accountLabel,
      period: TOTP_PERIOD_SECONDS,
      secret,
    });
  }

  async verifyToken(
    secret: string,
    token: string,
    afterTimeStep?: number,
  ): Promise<TotpVerificationResult> {
    if (!TOTP_TOKEN_PATTERN.test(token)) {
      return { valid: false };
    }

    try {
      const result = await verify({
        algorithm: 'sha1',
        digits: TOTP_DIGITS,
        epochTolerance: [TOTP_PAST_TOLERANCE_SECONDS, 0],
        period: TOTP_PERIOD_SECONDS,
        secret,
        strategy: 'totp',
        token,
        ...(afterTimeStep === undefined ? {} : { afterTimeStep }),
      });

      if (!result.valid || !('timeStep' in result)) {
        return { valid: false };
      }

      return { valid: true, timeStep: result.timeStep };
    } catch {
      return { valid: false };
    }
  }
}
