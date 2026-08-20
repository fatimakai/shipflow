-- CreateTable
CREATE TABLE "billing_checkout_sessions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "request_key" UUID NOT NULL,
    "interval" "billing_interval" NOT NULL,
    "stripe_session_id" VARCHAR(255),
    "checkout_url" VARCHAR(2048),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_checkout_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "billing_checkout_sessions_provider_fields_check" CHECK (
        ("stripe_session_id" IS NULL AND "checkout_url" IS NULL)
        OR ("stripe_session_id" IS NOT NULL AND "checkout_url" IS NOT NULL)
    ),
    CONSTRAINT "billing_checkout_sessions_expiry_check" CHECK ("expires_at" > "created_at")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_checkout_sessions_organization_id_key" ON "billing_checkout_sessions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_checkout_sessions_request_key_key" ON "billing_checkout_sessions"("request_key");

-- CreateIndex
CREATE UNIQUE INDEX "billing_checkout_sessions_stripe_session_id_key" ON "billing_checkout_sessions"("stripe_session_id");

-- CreateIndex
CREATE INDEX "billing_checkout_sessions_expires_at_idx" ON "billing_checkout_sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "billing_checkout_sessions" ADD CONSTRAINT "billing_checkout_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
