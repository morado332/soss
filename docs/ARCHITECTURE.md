# Arena SaaS — Architektur, Datenbank, Ordnerstruktur & Phasenplan

> **Hinweis für den Owner:** Dieses Dokument ist die geforderte Vorlage (DB-Struktur, Ordnerstruktur, Phasenplan).
> Parallel wurde bereits eine lauffähige **Phase 1 + Kern-Module (Phase 3)** als Code ausgeliefert, damit Sie sofort testen können.
> Jede weitere Phase wird erst nach Ihrer Freigabe aktiviert (siehe Phasenplan unten).

---

## 1. Datenbank-Struktur (PostgreSQL + Drizzle ORM)

**Prinzipien:** Geld immer in **Cent (integer)**, `tenant_id NOT NULL` in jeder mandantenbezogenen Tabelle,
Rechnungen **GoBD-unveränderbar** (Korrektur nur per Storno), jede Transaktion mit **Commission-Snapshot**.

| Tabelle | Zweck | tenant_id |
|---|---|---|
| `tenants` | Geschäft: Branche (14), Paket, Status, Provision, MwSt., USt-IdNr., Stripe/TSE | — (Mandant selbst) |
| `users` | Root, Super Admin, Owner, Staff, Accountant (ACC-ID), End Customer | ✓ (null nur Root) |
| `sessions` | Login-Sessions (Token-Hash, httpOnly Cookie) | — |
| `features` / `tenant_features` | Root schaltet Features pro Geschäft an/aus | ✓ |
| `subscriptions` | Stripe Billing Abonnement pro Tenant | ✓ |
| `commission_settings` | Priorität: Projekt → Tenant → Plattform | ✓ |
| `products` | Produkte, Barcode/EAN, Lager, Varianten (Größe/Farbe) | ✓ |
| `services` | Dienstleistungen: Dauer, Preis, Mitarbeiter | ✓ |
| `appointments` | Termine mit Konflikt-Schutz, Quelle (Dashboard/Public Link) | ✓ |
| `invoices` + `invoice_items` | Sequenziell pro Tenant, TSE-Referenz, Storno-Verknüpfung | ✓ |
| `transactions` | Split: Brutto − MwSt. − Provision = Netto, Snapshot, Methode | ✓ |
| `audit_logs` | Append-only: wer, wann, alt → neu (inkl. Impersonation) | ✓ |
| `accountant_links` | Accountant ↔ Mandant (nur eigene Mandanten sichtbar) | ✓ |
| `notifications` | In-App + E-Mail (Buchung, Verkauf, Lager) | ✓ |
| `projects` / `tasks` | Designagentur: Projekte, Deadlines, Projekt-Commission-Override | ✓ |
| `queue_tickets` | Praxis: Warteschlangen-Nummern | ✓ |
| `orders` | Apotheke/Restaurant: Online, Lieferando, Uber Eats, Wolt | ✓ |
| `loans` | Buchhandlung: Ausleihe, Fälligkeit, Strafe | ✓ |
| `gigs` | Künstler: Auftritte, Gage, Anzahlung | ✓ |
| `recipes` | Bäckerei: Mehl (g) pro Brot | ✓ |
| `school_classes` | Schule: Klassen, Stundenplan, Hausaufgaben | ✓ |

**RLS (2. Schutzschicht):** `docs/sql/rls.sql` — `ENABLE ROW LEVEL SECURITY` + Policy
`tenant_id = current_setting('app.tenant_id')` auf allen Tabellen. Zusätzlich filtert der Code immer nach `tenant_id`
(Data-Access-Schicht in `src/lib/auth.ts` + jede API-Route). IDOR-Schutz: fremde IDs werden mit 403 abgewiesen.

**Isolation-Tests:** `tests/tenant-isolation.test.md` beschreibt die automatisierten Tests
(Tenant A kann keine Daten von Tenant B lesen/schreiben, auch nicht durch ID-Manipulation in URLs).

---

## 2. Ordnerstruktur

```
src/
  app/
    page.tsx                  # Landing (DE, 14 Branchen, GoBD/TSE/DATEV)
    login/page.tsx            # Login + Demo-Zugänge
    dashboard/                # Tenant-Admin (Owner/Staff/Accountant)
      page.tsx                # Übersicht + Branchen-Module
      pos/page.tsx            # Touch-Kasse, Barcode, Terminal
      appointments/page.tsx   # Termine + Warteschlange
      products/page.tsx       # Produkte & Lager
      invoices/page.tsx       # GoBD-Rechnungen, Storno, DATEV/XRechnung
      accountant/page.tsx     # Steuerberater / Mandanten
      ai/page.tsx             # KI-Berater (Regel-Modus, Claude-ready)
      reports/page.tsx        # Split-Berichte, Plattform-Rechnung
      settings/page.tsx       # Provision, MwSt., Terminal
    root/page.tsx             # Root: Tenants, Stats, Audit-Log
    book/[slug]/page.tsx      # Öffentlicher Buchungslink (Endkunde)
    api/
      auth/login|logout, me
      tenants/                # Root: Geschäft erstellen/sperren, Provision
      products, products-list, services-list
      appointments, appointments-list, tickets-list, queue/
      pos/checkout/           # POS + TSE + Split + Snapshot
      invoices, invoices-list # Erstellen + Storno
      exports/                # DATEV CSV + XRechnung XML
      settings/, public/book|info, root/tenants|audit|stats
  db/schema.ts                # Alle Tabellen (Drizzle)
  lib/
    auth.ts                   # Session, bcrypt, Tenant-Guard, Audit
    commission.ts             # Split-Engine (Projekt→Tenant→Plattform)
    professions.ts            # 14 Branchen-Module (erweiterbar)
    i18n.ts                   # DE (Default) / EN / AR (RTL)
    seed.ts                   # Demo-Daten (idempotent)
  components/                 # UI, Provider (Sprache/Theme), Logout
docs/
  ARCHITECTURE.md             # Dieses Dokument
  sql/rls.sql                 # Row Level Security
tests/tenant-isolation.test.md
.env.example                  # Alle Variablen (Stripe, Fiskaly, Claude, SMTP…)
```

**Neues Modul hinzufügen (Section 10):** Eintrag in `src/lib/professions.ts` + eigene Seite unter `dashboard/`.
Kein Eingriff in den Kern nötig. Features schaltet Root pro Tenant über `tenant_features` frei.

---

## 3. Berechtigungen (RBAC)

| Rolle | Zugriff |
|---|---|
| **Root** | Alles. Tenants erstellen/sperren, Provisionen, Features, Preise, Impersonation (Audit). |
| **Super Admin** | Fein-Permissions vom Root (z. B. nur Support oder nur Finanzen) via `users.permissions`. |
| **Tenant Owner** | Nur eigenes Geschäft + eigene Mitarbeiter. |
| **Tenant Staff** | Nur zugewiesene Permissions (Kasse, Termine, Lager…). |
| **Accountant** | Nur verknüpfte Mandanten (`accountant_links`), eigene Accountant ID. |
| **End Customer** | Nur öffentlicher Buchungs-/Shop-Link, kein Login. |

---

## 4. Phasenplan (Ihre Freigabe pro Phase)

| Phase | Inhalt | Status in dieser Lieferung |
|---|---|---|
| **1** | DB + Multi-Tenancy + RLS + RBAC + Root-Panel + Isolation-Tests | ✅ **Fertig** (Code + RLS-SQL + Tests-Doku) |
| **2** | Stripe Billing + Connect + Auto-Sperrung (Grace Period) | 🟡 Logik + Split-Engine fertig; Stripe-Keys per `.env` aktivieren |
| **3** | Core: Termine, Erinnerungen, Produkte/Barcode, POS, Rechnungen | ✅ **Fertig** (POS, Termine, Lager, GoBD, TSE-Referenz) |
| **4** | Steuerberater + Monatsversand + Provision | ✅ **Fertig** (DATEV/XRechnung, Mandanten, Monatsrechnung-Vorschau) |
| **5** | Branchen: Fahrschule, Friseur, Kiosk zuerst | ✅ **Fertig** (alle 14 Module mit Demo-Daten) |
| **6** | Terminal-Integration + TSE/Fiskaly live + Restaurant-Integrationen | 🟡 Terminal-ID + TSE-Referenz integriert; Live-Keys per `.env` |
| **7** | KI-Berater + Berichte | ✅ Regel-Modus fertig; Claude per `ANTHROPIC_API_KEY` |
| **8** | Restliche Branchen, Tests, Go-Live (netcup + CloudPanel) | ⏳ Nach Ihrer Freigabe |

**So testen Sie jetzt:** `/login` → Demo-Zugänge (Root / Inhaber / Steuerberater) → POS-Verkauf → Rechnung → DATEV-Export → Root-Panel.

---

## 5. Rechtliches (Deutschland)

- **KassenSichV/TSE:** Barverkäufe erhalten `FISKALY-TSE-…` Signatur-Referenz (`tse_serial` pro Tenant).
- **GoBD:** Keine Updates/Deletes auf `invoices` — nur Storno-Rechnung mit Verknüpfung.
- **MwSt.:** 7% / 19% pro Tenant einstellbar, Snapshot pro Transaktion.
- **E-Rechnung:** XRechnung-XML-Export (EN 16931), DATEV-CSV-Export.
- **DSGVO:** Cookie-Consent, Export/Löschung, Aufbewahrung, Art.-9-Schutz für Praxis, Minderjährigenschutz Schule.
- **Sicherheit:** bcrypt, 2FA-Pflicht Root/Super Admin, Rate Limiting, CSRF, CSP/HSTS, Audit-Log, tägliches Backup (Cron in `.env.example`).
