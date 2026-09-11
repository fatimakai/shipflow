-- CreateTable
CREATE TABLE "two_factor_credentials" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "encrypted_secret" BYTEA NOT NULL,
    "initialization_vector" BYTEA NOT NULL,
    "authentication_tag" BYTEA NOT NULL,
    "encryption_key_version" INTEGER NOT NULL DEFAULT 1,
    "enabled_at" TIMESTAMPTZ(3),
    "last_used_time_step" BIGINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_backup_codes" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "credential_id" UUID NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_credentials_user_id_key" ON "two_factor_credentials"("user_id");

-- CreateIndex
CREATE INDEX "two_factor_credentials_enabled_at_idx" ON "two_factor_credentials"("enabled_at");

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_backup_codes_code_hash_key" ON "two_factor_backup_codes"("code_hash");

-- CreateIndex
CREATE INDEX "two_factor_backup_codes_credential_consumed_idx" ON "two_factor_backup_codes"("credential_id", "consumed_at");

-- AddForeignKey
ALTER TABLE "two_factor_credentials" ADD CONSTRAINT "two_factor_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_backup_codes" ADD CONSTRAINT "two_factor_backup_codes_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "two_factor_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
