-- CreateEnum
CREATE TYPE "audit_actor_type" AS ENUM ('anonymous', 'user', 'system', 'support_admin');

-- CreateEnum
CREATE TYPE "audit_outcome" AS ENUM ('success', 'failure');

-- CreateEnum
CREATE TYPE "audit_severity" AS ENUM ('info', 'warning', 'critical');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "event_type" VARCHAR(100) NOT NULL,
    "actor_type" "audit_actor_type" NOT NULL,
    "actor_user_id" UUID,
    "organization_id" UUID,
    "target_type" VARCHAR(64),
    "target_id" VARCHAR(255),
    "outcome" "audit_outcome" NOT NULL,
    "severity" "audit_severity" NOT NULL,
    "reason_code" VARCHAR(100),
    "request_id" VARCHAR(128),
    "ip_address" INET,
    "user_agent" VARCHAR(512),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_expires_at_idx" ON "audit_logs"("expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_occurred_at_idx" ON "audit_logs"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_occurred_at_idx" ON "audit_logs"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_logs_event_type_occurred_at_idx" ON "audit_logs"("event_type", "occurred_at");
