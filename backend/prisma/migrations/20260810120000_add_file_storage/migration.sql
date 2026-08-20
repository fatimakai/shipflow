-- CreateEnum
CREATE TYPE "file_status" AS ENUM ('pending', 'scanning', 'ready', 'deleted', 'rejected', 'failed', 'purged');

-- CreateEnum
CREATE TYPE "file_malware_status" AS ENUM ('not_required', 'pending', 'clean', 'infected', 'unsupported', 'failed');

-- CreateEnum
CREATE TYPE "file_storage_provider" AS ENUM ('local', 's3');

-- CreateTable
CREATE TABLE "stored_files" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "storage_provider" "file_storage_provider" NOT NULL,
    "object_key" VARCHAR(512) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "declared_mime_type" VARCHAR(127) NOT NULL,
    "detected_mime_type" VARCHAR(127),
    "size_bytes" INTEGER NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "status" "file_status" NOT NULL DEFAULT 'pending',
    "malware_status" "file_malware_status" NOT NULL DEFAULT 'pending',
    "scan_attempts" INTEGER NOT NULL DEFAULT 0,
    "reservation_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "uploaded_at" TIMESTAMPTZ(3),
    "scan_completed_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "purge_after" TIMESTAMPTZ(3),
    "purged_at" TIMESTAMPTZ(3),
    "audit_expires_at" TIMESTAMPTZ(3),
    "last_lifecycle_error" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stored_files_size_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 26214400),
    CONSTRAINT "stored_files_checksum_check" CHECK ("checksum_sha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "stored_files_name_check" CHECK ("original_name" = BTRIM("original_name") AND "original_name" <> ''),
    CONSTRAINT "stored_files_scan_attempts_check" CHECK ("scan_attempts" >= 0),
    CONSTRAINT "stored_files_lifecycle_check" CHECK (
        ("status" = 'pending' AND "uploaded_at" IS NULL AND "deleted_at" IS NULL AND "purged_at" IS NULL)
        OR ("status" IN ('scanning', 'ready') AND "uploaded_at" IS NOT NULL AND "deleted_at" IS NULL AND "purged_at" IS NULL)
        OR ("status" = 'deleted' AND "uploaded_at" IS NOT NULL AND "deleted_at" IS NOT NULL AND "purge_after" IS NOT NULL AND "purged_at" IS NULL)
        OR ("status" IN ('rejected', 'failed') AND "purge_after" IS NOT NULL AND "purged_at" IS NULL)
        OR ("status" = 'purged' AND "purged_at" IS NOT NULL AND "audit_expires_at" IS NOT NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_object_key_key" ON "stored_files"("object_key");
CREATE INDEX "stored_files_organization_status_created_at_idx" ON "stored_files"("organization_id", "status", "created_at");
CREATE INDEX "stored_files_organization_uploader_idx" ON "stored_files"("organization_id", "uploaded_by_id");
CREATE INDEX "stored_files_status_reservation_expires_at_idx" ON "stored_files"("status", "reservation_expires_at");
CREATE INDEX "stored_files_status_purge_after_idx" ON "stored_files"("status", "purge_after");
CREATE INDEX "stored_files_audit_expires_at_idx" ON "stored_files"("audit_expires_at");

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
