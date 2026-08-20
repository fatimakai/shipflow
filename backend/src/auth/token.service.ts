import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EnvironmentVariables } from '../config/env.validation';
import { ACCESS_TOKEN_TYPE } from './auth.constants';
import { AccessTokenPayload } from './auth.types';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  createOpaqueToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashOpaqueToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  getAccessTokenTtlSeconds(): number {
    return this.configService.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS');
  }

  getRefreshExpiration(): Date {
    const days = this.configService.getOrThrow<number>(
      'REFRESH_TOKEN_TTL_DAYS',
    );

    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  signAccessToken(user: { id: string; email: string }): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      type: ACCESS_TOKEN_TYPE,
      jti: randomUUID(),
    };

    return this.jwtService.signAsync(payload, {
      algorithm: 'HS256',
      expiresIn: this.getAccessTokenTtlSeconds(),
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          algorithms: ['HS256'],
          secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        },
      );

      if (payload.type !== ACCESS_TOKEN_TYPE || !payload.sub) {
        throw new UnauthorizedException('Invalid access token');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
