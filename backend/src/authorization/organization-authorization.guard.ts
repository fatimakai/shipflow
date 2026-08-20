import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { isUUID } from 'class-validator';
import type { AuthenticatedRequest } from '../auth/auth.types';
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
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const membershipRequired = this.reflector.getAllAndOverride<boolean>(
      ORGANIZATION_MEMBERSHIP_REQUIRED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!membershipRequired) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authenticatedRequest = request as AuthenticatedRequest;

    if (!authenticatedRequest.user) {
      throw new UnauthorizedException('Authentication is required');
    }

    const organizationId = request.params.organizationId;

    if (typeof organizationId !== 'string' || !isUUID(organizationId)) {
      throw new BadRequestException('Organization ID must be a valid UUID');
    }

    const organizationContext = await this.contextService.resolve(
      organizationId,
      authenticatedRequest.user.id,
    );
    const capabilities =
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
  }
}
