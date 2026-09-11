-- Audit records are append-only. They may be deleted only after their
-- application-assigned retention deadline has elapsed.
CREATE FUNCTION "enforce_audit_log_retention"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'audit records are immutable' USING ERRCODE = '55000';
  END IF;

  IF OLD."expires_at" > CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'audit record retention period has not elapsed' USING ERRCODE = '55000';
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER "audit_logs_append_only"
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW
EXECUTE FUNCTION "enforce_audit_log_retention"();
