import type { AuthenticatedRequest } from '../auth/auth.types';
import type { OrganizationContext } from './organization-context.service';

export interface OrganizationAuthorizedRequest extends AuthenticatedRequest {
  organizationContext: OrganizationContext;
}
