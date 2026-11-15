# Security & Tenant-Isolation Checks

All cases below were executed against a real PostgreSQL instance (demo data) and passed.

| # | Case | Expected |
|---|---|---|
| 1 | `/login` on a fresh install | redirect to `/setup` |
| 2 | `POST /api/setup` with wrong token / weak password | `BAD_SETUP_TOKEN` / `WEAK_PASSWORD` |
| 3 | Second setup after root exists | rejected |
| 4 | Any write request with foreign `Origin` | 403 `BAD_ORIGIN` |
| 5 | Tenant A checkout with Tenant B product (IDOR) | 404 |
| 6 | Tenant A storno of Tenant B invoice | 404 |
| 7 | Storno same invoice twice | `ALREADY_STORNO` |
| 8 | Checkout quantity above stock | `INSUFFICIENT_STOCK` |
| 9 | 10 parallel checkouts on stock = 3 | exactly 3 succeed, stock 0 |
| 10 | Staff (cashier) reads invoices / changes settings | 403 |
| 11 | Owner tries to change own commission | rejected |
| 12 | Owner calls `/api/root/*` | 403 |
| 13 | Accountant exports unlinked tenant | 403 |
| 14 | Accountant export contains only linked tenants | ✓ |
| 15 | 5 wrong passwords → correct password | still rejected (locked 15 min) |
| 16 | Unknown e-mail vs wrong password | identical error |
| 17 | Public booking: same slot / past time / foreign service | 409 / `PAST_TIME` / 404 |
| 18 | Suspended tenant checkout | 403 `TENANT_SUSPENDED` |
| 19 | Export with invalid date | 400 |
