DROP TRIGGER "audit_logs_append_only" ON "audit_logs";

CREATE OR REPLACE FUNCTION "enforce_audit_log_retention"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW."expires_at" := NEW."occurred_at" + INTERVAL '365 days';
    RETURN NEW;
  END IF;

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
BEFORE INSERT OR UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW
EXECUTE FUNCTION "enforce_audit_log_retention"();
