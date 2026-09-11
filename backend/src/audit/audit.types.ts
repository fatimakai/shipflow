import type { Prisma } from '../generated/prisma/client';
import {
  AuditActorType,
  AuditOutcome,
  AuditSeverity,
} from '../generated/prisma/enums';
import type { AuditEventType } from './audit.constants';

export interface AuditRecordInput {
  eventType: AuditEventType;
  outcome: AuditOutcome;
  severity?: AuditSeverity;
  actorType?: AuditActorType;
  actorUserId?: string;
  organizationId?: string;
  targetType?: string;
  targetId?: string;
  reasonCode?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
  occurredAt?: Date;
}

export type AuditValueSource = 'param' | 'request-user' | 'response';

export interface AuditValueReference {
  source: AuditValueSource;
  key?: string;
}

export interface AuditEventOptions {
  eventType: AuditEventType;
  severity?: AuditSeverity;
  actor?: 'anonymous' | 'request-user' | 'response-user' | 'system';
  organization?: AuditValueReference;
  target?: AuditValueReference & { type: string };
}
