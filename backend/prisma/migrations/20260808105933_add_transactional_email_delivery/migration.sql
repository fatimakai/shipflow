-- CreateEnum
CREATE TYPE "email_category" AS ENUM ('email_verification', 'password_reset', 'organization_invitation', 'security_notice');

-- CreateEnum
CREATE TYPE "email_delivery_status" AS ENUM ('pending', 'sending', 'sent', 'delivered', 'failed', 'bounced', 'complained', 'suppressed');

-- CreateTable
CREATE TABLE "email_deliveries" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "category" "email_category" NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "provider_message_id" VARCHAR(255),
    "recipient_email" VARCHAR(320) NOT NULL,
    "idempotency_key" VARCHAR(256) NOT NULL,
    "status" "email_delivery_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error_code" VARCHAR(100),
    "last_error_message" VARCHAR(500),
    "sent_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "failed_at" TIMESTAMPTZ(3),
    "last_event_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_webhook_events" (
    "id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "provider_message_id" VARCHAR(255),
    "event_created_at" TIMESTAMPTZ(3) NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_deliveries_provider_message_id_key" ON "email_deliveries"("provider_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_deliveries_idempotency_key_key" ON "email_deliveries"("idempotency_key");

-- CreateIndex
CREATE INDEX "email_deliveries_recipient_created_at_idx" ON "email_deliveries"("recipient_email", "created_at");

-- CreateIndex
CREATE INDEX "email_deliveries_status_created_at_idx" ON "email_deliveries"("status", "created_at");

-- CreateIndex
CREATE INDEX "email_webhook_events_provider_message_id_idx" ON "email_webhook_events"("provider_message_id");

-- Preserve normalized metadata and valid counters at the database boundary.
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_recipient_email_normalized_check"
    CHECK ("recipient_email" = lower(btrim("recipient_email")));

ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_provider_normalized_check"
    CHECK ("provider" = lower(btrim("provider")));

ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_attempts_check"
    CHECK ("attempts" >= 0);
