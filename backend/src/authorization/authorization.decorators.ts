import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import {
  ORGANIZATION_MEMBERSHIP_REQUIRED_KEY,
  REQUIRED_CAPABILITIES_KEY,
} from './authorization.constants';
import type { OrganizationAuthorizedRequest } from './authorization.types';
import { Capability } from './capability';
import { OrganizationAuthorizationGuard } from './organization-authorization.guard';
import type { OrganizationContext } from './organization-context.service';

export function RequireOrganizationMembership(): MethodDecorator {
  return applyDecorators(
    SetMetadata(ORGANIZATION_MEMBERSHIP_REQUIRED_KEY, true),
    UseGuards(OrganizationAuthorizationGuard),
  );
}

export function RequireOrganizationCapabilities(
  ...capabilities: Capability[]
): MethodDecorator {
  return applyDecorators(
    SetMetadata(ORGANIZATION_MEMBERSHIP_REQUIRED_KEY, true),
    SetMetadata(REQUIRED_CAPABILITIES_KEY, capabilities),
    UseGuards(OrganizationAuthorizationGuard),
  );
}

export const CurrentOrganizationContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): OrganizationContext =>
    context.switchToHttp().getRequest<OrganizationAuthorizedRequest>()
      .organizationContext,
);
