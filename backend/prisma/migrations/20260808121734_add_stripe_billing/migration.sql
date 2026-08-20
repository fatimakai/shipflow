-- CreateEnum
CREATE TYPE "plan_code" AS ENUM ('free', 'pro');

-- CreateEnum
CREATE TYPE "billing_interval" AS ENUM ('monthly', 'annual');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused');

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "code" "plan_code" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'usd',
    "monthly_price_cents" INTEGER NOT NULL,
    "annual_price_cents" INTEGER NOT NULL,
    "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "plans_currency_check" CHECK ("currency" = LOWER("currency") AND "currency" = 'usd'),
    CONSTRAINT "plans_prices_nonnegative_check" CHECK ("monthly_price_cents" >= 0 AND "annual_price_cents" >= 0),
    CONSTRAINT "plans_catalog_prices_check" CHECK (
        ("code" = 'free' AND "monthly_price_cents" = 0 AND "annual_price_cents" = 0)
        OR ("code" = 'pro' AND "monthly_price_cents" = 2900 AND "annual_price_cents" = 29000)
    )
);

-- CreateTable
CREATE TABLE "stripe_customers" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "stripe_customer_id" VARCHAR(255) NOT NULL,
    "trial_used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "stripe_subscription_id" VARCHAR(255) NOT NULL,
    "stripe_price_id" VARCHAR(255) NOT NULL,
    "stripe_latest_invoice_id" VARCHAR(255),
    "interval" "billing_interval" NOT NULL,
    "status" "subscription_status" NOT NULL,
    "automatic_tax_enabled" BOOLEAN NOT NULL DEFAULT true,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "current_period_start" TIMESTAMPTZ(3) NOT NULL,
    "current_period_end" TIMESTAMPTZ(3) NOT NULL,
    "trial_start" TIMESTAMPTZ(3),
    "trial_end" TIMESTAMPTZ(3),
    "grace_period_ends_at" TIMESTAMPTZ(3),
    "canceled_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    "last_stripe_event_created_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subscriptions_period_check" CHECK ("current_period_end" > "current_period_start"),
    CONSTRAINT "subscriptions_trial_period_check" CHECK (
        ("trial_start" IS NULL AND "trial_end" IS NULL)
        OR ("trial_start" IS NOT NULL AND "trial_end" IS NOT NULL AND "trial_end" > "trial_start")
    )
);

-- CreateTable
CREATE TABLE "processed_stripe_events" (
    "id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "provider_object_id" VARCHAR(255),
    "event_created_at" TIMESTAMPTZ(3) NOT NULL,
    "processed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_stripe_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_customers_organization_id_key" ON "stripe_customers"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_customers_stripe_customer_id_key" ON "stripe_customers"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_organization_id_key" ON "subscriptions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_grace_period_idx" ON "subscriptions"("status", "grace_period_ends_at");

-- CreateIndex
CREATE INDEX "processed_stripe_events_provider_object_id_idx" ON "processed_stripe_events"("provider_object_id");

-- AddForeignKey
ALTER TABLE "stripe_customers" ADD CONSTRAINT "stripe_customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the application-owned plan and entitlement catalog.
INSERT INTO "plans" (
    "code",
    "name",
    "description",
    "currency",
    "monthly_price_cents",
    "annual_price_cents",
    "features"
)
VALUES
    ('free', 'Free', 'Core organization features', 'usd', 0, 0, ARRAY['core']),
    ('pro', 'Pro', 'All Pro organization features', 'usd', 2900, 29000, ARRAY['core', 'pro']);
