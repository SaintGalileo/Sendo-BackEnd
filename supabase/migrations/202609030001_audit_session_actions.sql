-- Allow login/logout rows in admin_audit_logs.
-- Mirror of: src/database/migrations/audit_session_actions.sql

BEGIN;

DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.admin_audit_logs'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%action%'
    LOOP
        EXECUTE format('ALTER TABLE public.admin_audit_logs DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE public.admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_action_check
    CHECK (action IN ('create', 'update', 'delete', 'login', 'logout'));

COMMIT;
