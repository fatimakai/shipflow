import { SetMetadata } from '@nestjs/common';
import type { AuditEventOptions } from './audit.types';

export const AUDIT_EVENT_METADATA = 'shipflow:audit-event';

export const Audit = (options: AuditEventOptions): MethodDecorator =>
  SetMetadata(AUDIT_EVENT_METADATA, options);
