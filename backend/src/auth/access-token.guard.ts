import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuditEvent } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import type { RequestWithId } from '../common/http/request-id.middleware';
import {
  AuditOutcome,
  AuditSeverity,
  UserStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedRequest } from './auth.types';
import { TokenService } from './token.service';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & RequestWithId>();
    let candidateUserId: string | undefined;

    try {
      const [scheme, token] = request.headers.authorization?.split(' ') ?? [];

      if (scheme !== 'Bearer' || !token) {
        throw new UnauthorizedException('A bearer access token is required');
      }

      const payload = await this.tokenService.verifyAccessToken(token);
      candidateUserId = payload.sub;
      const user = await this.prisma.user.findFirst({
        where: {
          id: payload.sub,
          status: UserStatus.ACTIVE,
          deletedAt: null,
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          emailVerifiedAt: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException(
          'The authenticated user is unavailable',
        );
      }

      (request as AuthenticatedRequest).user = {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerifiedAt !== null,
      };

      return true;
    } catch (error) {
      const statusCode =
        error instanceof HttpException ? error.getStatus() : 401;
      await this.audit.recordSafely({
        eventType: AuditEvent.AUTH_ACCESS_TOKEN_REJECTED,
        outcome: AuditOutcome.FAILURE,
        severity: AuditSeverity.WARNING,
        actorUserId: candidateUserId,
        reasonCode: `http.${statusCode}`,
        requestId: request.requestId,
        ipAddress: request.ip ?? request.socket.remoteAddress,
        userAgent: request.get('user-agent'),
        metadata: {
          httpMethod: request.method,
          httpPath: request.path,
          statusCode,
        },
      });
      throw error;
    }
  }
}
