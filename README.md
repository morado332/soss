# Arena — Multi-Tenant SaaS für 14 Branchen (Deutschland)

Eine Plattform für Fahrschule, Friseur, Kiosk/Supermarkt, Designagentur, Steuerbüro, Bekleidung, Praxis, Apotheke, Künstler, Restaurant, Beauty, Buchhandlung, Schule & Bäckerei.

**Stack:** Next.js (App Router) + TypeScript · PostgreSQL + Drizzle ORM · Stripe Connect · Fiskaly TSE · DATEV/XRechnung · Claude KI · DE/EN/AR (RTL)

## Schnellstart (lokal / Sandbox)

```bash
npm install
cp .env.example .env   # DATABASE_URL anpassen
npx drizzle-kit push   # Schema anlegen
npm run build && npm run start
```

Demo-Zugänge (werden beim ersten Login automatisch angelegt):

| Rolle | E-Mail | Passwort |
|---|---|---|
| Root | `root@platform.de` | `Root123!` |
| Fahrschule Inhaber | `owner@fahrschule.de` | `Owner123!` |
| Friseur Inhaber | `owner@friseur.de` | `Owner123!` |
| Kiosk Inhaber | `owner@kiosk.de` | `Owner123!` |
| Steuerberater (ACC-1001) | `accountant@kanzlei.de` | `Account123!` |

Öffentlicher Buchungslink (Beispiel): `/book/friseur`

## Was funktioniert

- **Root-Panel** (`/root`): Tenants erstellen/sperren, Provisionen, Statistiken, Audit-Log
- **Tenant-Dashboard** (`/dashboard`): Umsatz, Provision, Netto, Termine, Lagerwarnungen, Branchen-Module
- **POS** (`/dashboard/pos`): Barcode-Scan, Touch-Kasse, Bar (TSE) / Terminal / Online, Split-Anzeige
- **Termine** (`/dashboard/appointments`): Konflikt-Schutz, Warteschlange (Praxis), öffentlicher Link
- **Rechnungen** (`/dashboard/invoices`): GoBD, Storno, TSE, DATEV- & XRechnung-Export
- **Steuerberater** (`/dashboard/accountant`): Mandanten (nur eigene), Monatsversand, DATEV
- **KI-Berater** (`/dashboard/ai`): Bericht, Prognose, Saison-Tipps (Claude-ready)
- **Berichte** (`/dashboard/reports`): Split pro Transaktion, Plattform-Monatsrechnung
- **i18n:** Deutsch (Default) / English / العربية RTL + Dark/Light Mode

## Deployment (netcup Root Server, Ubuntu 24.04 + CloudPanel)

1. Node.js 20+ & PostgreSQL & Redis installieren (CloudPanel).
2. `.env` aus `.env.example` befüllen (Stripe, Fiskaly, Claude, SMTP).
3. `npx drizzle-kit push` + `psql $DATABASE_URL -f docs/sql/rls.sql`
4. `npm run build && npm run start` (oder PM2/systemd), Reverse Proxy in CloudPanel auf Port 3000.
5. Cron-Jobs aus `.env.example` eintragen (Erinnerungen, Monatsrechnungen, Backup).

## Doku

- Architektur, DB-Struktur, Ordnerstruktur, Phasenplan: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- RLS: [`docs/sql/rls.sql`](docs/sql/rls.sql)
- Isolation-Tests: [`tests/tenant-isolation.test.md`](tests/tenant-isolation.test.md)
