-- Preserve audit records when a replacement session or accepting user is purged.
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_rotation_check";

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_rotation_check"
    CHECK ("replaced_by_id" IS NULL OR "revocation_reason" = 'rotated');

ALTER TABLE "invitations" DROP CONSTRAINT "invitations_status_check";

ALTER TABLE "invitations" ADD CONSTRAINT "invitations_status_check"
    CHECK (
        ("status" = 'pending' AND "accepted_at" IS NULL AND "accepted_by_id" IS NULL AND "revoked_at" IS NULL)
        OR ("status" = 'accepted' AND "accepted_at" IS NOT NULL AND "revoked_at" IS NULL)
        OR ("status" = 'revoked' AND "accepted_at" IS NULL AND "accepted_by_id" IS NULL AND "revoked_at" IS NOT NULL)
        OR ("status" = 'expired' AND "accepted_at" IS NULL AND "accepted_by_id" IS NULL AND "revoked_at" IS NULL)
    );
