# Tenant Isolation Tests (Section 4 — IDOR / Cross-Tenant)

These tests MUST pass before go-live. They are written against the real API routes.

## Automated test cases

1. **Cross-tenant read blocked:** Login as Tenant A owner → `GET /api/products-list` returns only Tenant A products.
2. **Cross-tenant write blocked (IDOR):** Login as Tenant A → `POST /api/pos/checkout` with a `product_id` belonging to Tenant B → expect **403** ("Produkt gehört nicht zu Ihrem Geschäft").
3. **Cross-tenant invoice blocked:** Login as Tenant A → `PATCH /api/invoices` with `invoice_id` of Tenant B → expect **404**.
4. **Accountant scoping:** Login as accountant (ACC-1001) → `GET /api/exports?format=datev` contains only linked tenants' invoices; unlinked tenant invoices absent.
5. **Root bypass audited:** Root impersonation / tenant actions create `audit_logs` rows with actor, old → new values.
6. **RLS layer:** With `SET app.tenant_id = '<A>'`, direct SQL `SELECT * FROM products` returns only Tenant A rows (after applying `docs/sql/rls.sql`).
7. **Public booking scoping:** `POST /api/public/book` with slug of Tenant A creates appointment only under Tenant A; overlapping slot returns 409.
8. **Suspended tenant blocked:** Suspended tenant → POS checkout returns 403.

## How to run (manual smoke test today)

1. Login `owner@friseur.de` → create product → POS sale → invoice appears only in Friseur dashboard.
2. Login `owner@kiosk.de` → same invoice/product NOT visible.
3. Login `root@platform.de` → suspend Friseur → Friseur POS checkout blocked.
4. Login `accountant@kanzlei.de` → DATEV export downloads; check it contains both linked tenants but no others.

## CI recommendation

Add Vitest + Playwright in Phase 8: seed two tenants, run cases 1–8 as automated API tests on every deploy.
