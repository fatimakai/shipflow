import { Module } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { OrganizationAuthorizationGuard } from './organization-authorization.guard';
import { OrganizationContextService } from './organization-context.service';

@Module({
  providers: [
    AuthorizationService,
    OrganizationContextService,
    OrganizationAuthorizationGuard,
  ],
  exports: [
    AuthorizationService,
    OrganizationContextService,
    OrganizationAuthorizationGuard,
  ],
})
export class AuthorizationModule {}
