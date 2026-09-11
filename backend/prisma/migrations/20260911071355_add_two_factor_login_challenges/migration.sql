-- CreateEnum
CREATE TYPE "two_factor_challenge_purpose" AS ENUM ('login');

-- CreateTable
CREATE TABLE "two_factor_challenges" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "purpose" "two_factor_challenge_purpose" NOT NULL DEFAULT 'login',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "ip_address" INET,
    "user_agent" VARCHAR(512),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_challenges_token_hash_key" ON "two_factor_challenges"("token_hash");

-- CreateIndex
CREATE INDEX "two_factor_challenges_user_consumed_idx" ON "two_factor_challenges"("user_id", "consumed_at");

-- CreateIndex
CREATE INDEX "two_factor_challenges_expires_at_idx" ON "two_factor_challenges"("expires_at");

-- AddForeignKey
ALTER TABLE "two_factor_challenges" ADD CONSTRAINT "two_factor_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
