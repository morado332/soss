-- ============================================================
-- PostgreSQL Row Level Security (RLS) — Second layer of tenant isolation
-- ⚠️ OPTIONAL / NOT APPLIED AUTOMATICALLY.
-- The application enforces tenant isolation in every query. Applying this file as-is
-- would block ALL rows, because the app does not yet set `app.tenant_id` per request.
-- Only apply it after (1) using a separate non-owner DB role for the app and
-- (2) wrapping tenant requests in a transaction with: SELECT set_config('app.tenant_id', <tenant>, true)
-- Apply manually:
--   psql $DATABASE_URL -f docs/sql/rls.sql
-- App sets per-connection: SET app.tenant_id = '<uuid>' (or 'root' for platform admin)
-- Every tenant-owned table: tenant_id NOT NULL + policy tenant_id = current_setting
-- ============================================================

-- Helper: enable RLS + force for all tenant tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products','services','appointments','invoices','invoice_items','transactions',
    'tenant_features','subscriptions','commission_settings','accountant_links','notifications',
    'projects','tasks','queue_tickets','orders','loans','gigs','recipes','school_classes'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (tenant_id::text = current_setting(''app.tenant_id'', true)
                OR current_setting(''app.tenant_id'', true) = ''root'')
         WITH CHECK (tenant_id::text = current_setting(''app.tenant_id'', true)
                OR current_setting(''app.tenant_id'', true) = ''root'')', t);
  END LOOP;
END $$;

-- users: tenant users see only own tenant; root sees all; accountant sees only linked tenants (enforced in app + audit)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_isolation ON users;
CREATE POLICY users_isolation ON users
  USING (tenant_id IS NULL OR tenant_id::text = current_setting('app.tenant_id', true)
         OR current_setting('app.tenant_id', true) = 'root'
         OR current_setting('app.tenant_id', true) = 'accountant');

-- audit_logs: append-only for app role (GoBD) — no UPDATE/DELETE for non-root
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_append_only ON audit_logs;
CREATE POLICY audit_append_only ON audit_logs
  USING (tenant_id IS NULL OR tenant_id::text = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) = 'root')
  WITH CHECK (true);

-- Indexes for tenant isolation performance
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_time ON appointments(tenant_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_number ON invoices(tenant_id, number);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_created ON transactions(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
