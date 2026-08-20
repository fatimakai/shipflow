-- CreateEnum
CREATE TYPE "notification_category" AS ENUM ('security', 'organization', 'billing');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('password_changed', 'organization_invitation_accepted', 'organization_role_changed', 'organization_member_removed', 'organization_ownership_transferred', 'billing_trial_started', 'billing_payment_failed', 'billing_grace_period_started', 'billing_cancellation_scheduled', 'billing_subscription_canceled', 'billing_full_refund', 'billing_dispute');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "category" "notification_category" NOT NULL,
    "type" "notification_type" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "action_path" VARCHAR(500),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "dedupe_key" VARCHAR(255) NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notifications_content_check" CHECK (
        "title" = BTRIM("title") AND "title" <> ''
        AND "message" = BTRIM("message") AND "message" <> ''
        AND "dedupe_key" = BTRIM("dedupe_key") AND "dedupe_key" <> ''
    ),
    CONSTRAINT "notifications_action_path_check" CHECK (
        "action_path" IS NULL
        OR ("action_path" = BTRIM("action_path") AND "action_path" LIKE '/%' AND "action_path" NOT LIKE '//%')
    ),
    CONSTRAINT "notifications_metadata_check" CHECK (jsonb_typeof("metadata") = 'object'),
    CONSTRAINT "notifications_lifecycle_check" CHECK (
        "expires_at" > "created_at" AND ("read_at" IS NULL OR "read_at" >= "created_at")
    ),
    CONSTRAINT "notifications_category_type_check" CHECK (
        ("category" = 'security' AND "type" = 'password_changed')
        OR ("category" = 'organization' AND "type" IN (
            'organization_invitation_accepted',
            'organization_role_changed',
            'organization_member_removed',
            'organization_ownership_transferred'
        ))
        OR ("category" = 'billing' AND "type" IN (
            'billing_trial_started',
            'billing_payment_failed',
            'billing_grace_period_started',
            'billing_cancellation_scheduled',
            'billing_subscription_canceled',
            'billing_full_refund',
            'billing_dispute'
        ))
    )
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "organization_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_id_idx" ON "notifications"("user_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "notifications_organization_id_user_id_created_at_idx" ON "notifications"("organization_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_expires_at_idx" ON "notifications"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_dedupe_key_key" ON "notifications"("user_id", "dedupe_key");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
