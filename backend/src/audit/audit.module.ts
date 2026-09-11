import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './audit.interceptor';
import { AuditRetentionService } from './audit-retention.service';
import { AuditService } from './audit.service';

@Global()
@Module({
  providers: [
    AuditService,
    AuditRetentionService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
