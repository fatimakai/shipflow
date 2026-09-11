import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { isUUID } from 'class-validator';
import { AuditEvent } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedRequest } from '../auth/auth.types';
import type { RequestWithId } from '../common/http/request-id.middleware';
import { AuditOutcome, AuditSeverity } from '../generated/prisma/enums';
import {
  ORGANIZATION_MEMBERSHIP_REQUIRED_KEY,
  REQUIRED_CAPABILITIES_KEY,
} from './authorization.constants';
import { AuthorizationService } from './authorization.service';
import type { OrganizationAuthorizedRequest } from './authorization.types';
import { Capability } from './capability';
import { OrganizationContextService } from './organization-context.service';

@Injectable()
export class OrganizationAuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly contextService: OrganizationContextService,
    private readonly authorizationService: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const membershipRequired = this.reflector.getAllAndOverride<boolean>(
      ORGANIZATION_MEMBERSHIP_REQUIRED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!membershipRequired) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & RequestWithId>();
    const authenticatedRequest = request as AuthenticatedRequest;
    let organizationId: string | undefined;
    let capabilities: Capability[] = [];

    try {
      if (!authenticatedRequest.user) {
        throw new UnauthorizedException('Authentication is required');
      }

      const rawOrganizationId = request.params.organizationId;

      if (typeof rawOrganizationId !== 'string' || !isUUID(rawOrganizationId)) {
        throw new BadRequestException('Organization ID must be a valid UUID');
      }
      organizationId = rawOrganizationId;

      const organizationContext = await this.contextService.resolve(
        organizationId,
        authenticatedRequest.user.id,
      );
      capabilities =
        this.reflector.getAllAndOverride<Capability[]>(
          REQUIRED_CAPABILITIES_KEY,
          [context.getHandler(), context.getClass()],
        ) ?? [];

      this.authorizationService.assertCapabilities(
        organizationContext.role,
        capabilities,
      );
      (request as OrganizationAuthorizedRequest).organizationContext =
        organizationContext;

      return true;
    } catch (error) {
      const statusCode =
        error instanceof HttpException ? error.getStatus() : 500;
      await this.audit.recordSafely({
        eventType: AuditEvent.AUTHORIZATION_ORGANIZATION_ACCESS_DENIED,
        outcome: AuditOutcome.FAILURE,
        severity: AuditSeverity.WARNING,
        actorUserId: authenticatedRequest.user?.id,
        organizationId,
        targetType: 'organization',
        targetId: organizationId,
        reasonCode: `http.${statusCode}`,
        requestId: request.requestId,
        ipAddress: request.ip ?? request.socket.remoteAddress,
        userAgent: request.get('user-agent'),
        metadata: {
          capabilities,
          httpMethod: request.method,
          httpPath: request.path,
          statusCode,
        },
      });
      throw error;
    }
  }
}
