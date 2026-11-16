# Arena — Multi-Tenant SaaS (POS · Termine · Rechnungen)

Next.js 16 · TypeScript · PostgreSQL · Drizzle ORM · Tailwind 4 · DE / EN / العربية (RTL) · Light/Dark

---

## 🇸🇦 التشغيل السريع (عربي)

**المتطلبات:** Node.js 20+ و PostgreSQL 14+ (أو Docker).

### الطريقة 1 — Docker (الأسهل)
```bash
docker compose up --build
```
ثم افتح `http://localhost:3000` → سيتم تحويلك تلقائياً إلى **`/setup`**.

### الطريقة 2 — بدون Docker
```bash
npm install
cp .env.example .env        # عدّل DATABASE_URL
npm run build
npm start
```
- الجداول تُنشأ **تلقائياً** عند تشغيل الخادم (لا حاجة لـ `drizzle-kit push`).

### إنشاء حساب الـ Root لأول مرة
1. عند أول تشغيل يطبع الخادم في الطرفية **رمز إعداد لمرة واحدة** (Setup Token):
   ```
   ARENA FIRST-RUN SETUP ... enter this one-time setup token:  vqSgzW71Ik0R
   ```
   (أو ضع قيمة ثابتة في `SETUP_TOKEN` داخل `.env`).
2. افتح `/setup`، أدخل الرمز والاسم والبريد وكلمة مرور قوية (10 أحرف+، حروف كبيرة وصغيرة ورقم).
3. اختيارياً فعّل **«بيانات تجريبية»** لإنشاء 14 محلاً تجريبياً للاختبار.
4. بعد إنشاء الـ Root تُغلق صفحة الإعداد نهائياً ولا يمكن إنشاء Root آخر منها.

### حسابات تجريبية (فقط إذا فعّلت البيانات التجريبية) — كلمة المرور: `Demo12345!`
| الدور | البريد |
|---|---|
| مالك صالون | `owner@friseur.de` |
| مالك كشك | `owner@kiosk.de` |
| مالك عيادة (قائمة انتظار) | `owner@praxis.de` |
| موظف كاشير (صلاحيات محدودة) | `staff@friseur.de` |
| محاسب `ACC-1001` | `accountant@kanzlei.de` |
| كل المجالات | `owner@<slug>.de` (مثال `owner@restaurant.de`) |

> ⚠️ لا تفعّل البيانات التجريبية على خادم الإنتاج — كلمة مرورها معروفة.

---

## ☁️ تشغيل مجاني يعمل من أي مكان (Vercel + Neon) — بدون شراء استضافة

كل الخطوات تتم من متصفح التابلت. الخطة المجانية كافية للتجربة.

1. **قاعدة البيانات (Neon):** ادخل إلى neon.tech ← سجّل بحساب GitHub ← أنشئ مشروعاً (المنطقة: Frankfurt) ← انسخ «Connection string».
2. **الموقع (Vercel):** ادخل إلى vercel.com ← سجّل بحساب GitHub ← **Add New → Project** ← اختر مستودع المشروع ← **Import**.
3. في **Environment Variables** أضف:
   | الاسم | القيمة |
   |---|---|
   | `DATABASE_URL` | رابط Neon (ينتهي بـ `?sslmode=require`) |
   | `SETUP_TOKEN` | كلمة سرية طويلة من اختيارك (تُستخدم مرة واحدة في `/setup`) |
4. اضغط **Deploy**. بعد دقيقتين ستحصل على رابط مثل `https://arena-xxxx.vercel.app`.
5. افتح الرابط ← `/setup` ← أدخل `SETUP_TOKEN` وأنشئ حساب الـ Root.

### تثبيته كتطبيق على التابلت (MatePad / Android / iPad)
- **Chrome أو Edge:** افتح الرابط ← القائمة ⋮ ← **تثبيت التطبيق / إضافة إلى الشاشة الرئيسية**.
- **متصفح Huawei:** القائمة ← **إضافة إلى الشاشة الرئيسية**.
- **iPad (Safari):** زر المشاركة ← **إضافة إلى الشاشة الرئيسية**.

يفتح بعدها بأيقونة Arena في وضع ملء الشاشة مثل أي تطبيق، ويعرض صفحة «لا يوجد اتصال» عند انقطاع الإنترنت.
الجداول تُنشأ تلقائياً عند أول تشغيل. أي تعديل يُرفع إلى GitHub يُنشر تلقائياً.

> ملاحظة: في الخطة المجانية الحد من محاولات الدخول يُحفظ في ذاكرة كل نسخة من الخادم. للإنتاج الحقيقي يُنقل إلى Redis.

---

## 🇩🇪 Schnellstart

```bash
docker compose up --build          # oder: npm install && npm run build && npm start
```
1. Server startet → Migrationen laufen automatisch → **Setup-Token** erscheint im Log.
2. `/setup` öffnen → Root-Konto anlegen (optional mit Demo-Daten).
3. Unter `/root/tenants` Geschäfte anlegen, unter `/root/accountants` Steuerberater.

## Module je Branche
Jedes Geschäft sieht nur die Bereiche seiner Branche (`src/modules/registry.ts`). Beispiel Fahrschule: Fahrstunden, Fahrschüler,
Fahrlehrer, Fahrzeuge, Theorie, Termine, Erinnerungen, Rechnungen, Steuerberater, KI-Berater — keine Kasse, keine Produkte.
Der Root kann einzelne Bereiche pro Geschäft abschalten (Root → Geschäfte → Konditionen). Gesperrte Bereiche sind auch
serverseitig blockiert (Seiten leiten um, API antwortet `MODULE_DISABLED`).

Neue Branche hinzufügen: Eintrag in `PROFESSION_MODULES`, Tabellen in `src/modules/<key>/schema.ts`, Seiten unter
`src/app/dashboard/m/<key>/`, API unter `src/app/api/m/<key>/`.

## Erinnerungen (Cron)
`/api/cron/reminders` alle 15 Minuten mit `Authorization: Bearer $CRON_SECRET` aufrufen (crontab auf dem Server).
E-Mail-Versand über Resend (`RESEND_API_KEY`, `EMAIL_FROM`); ohne Schlüssel nur In-App-Benachrichtigungen.

## Rollen
| Rolle | Bereich | Rechte |
|---|---|---|
| Root | `/root` | Geschäfte, Konditionen (Provision), Sperren, Steuerberater, Audit-Log |
| Inhaber | `/dashboard` | Alles im eigenen Geschäft, Team, Steuerberater verknüpfen |
| Mitarbeiter | `/dashboard` | Nur Rechte der Rolle: Kasse / Empfang / Filialleitung |
| Steuerberater | `/dashboard` | Nur verknüpfte Mandanten, Exporte (Lesezugriff) |
| Endkunde | `/book/<slug>` | Öffentliche Buchung ohne Login |

## Sicherheit (umgesetzt)
- **Kein Standard-Root-Passwort mehr** – Root wird einmalig über `/setup` mit Setup-Token angelegt (Advisory-Lock gegen Race Conditions).
- bcrypt (12 Runden), starke Passwort-Richtlinie, Konstantzeit-Login (keine Konto-Enumeration).
- **Brute-Force-Schutz:** Rate-Limit pro IP & E-Mail, Kontosperre nach 5 Fehlversuchen (15 Min.).
- Sessions: zufälliges 256-bit-Token, nur SHA-256-Hash in der DB, HttpOnly + SameSite, 12 h Laufzeit, Invalidierung bei Passwortänderung/Sperre.
- **CSRF:** Origin-/Sec-Fetch-Prüfung für alle schreibenden API-Requests (`src/proxy.ts`).
- **Security-Header:** Nonce-basierte CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS (bei https).
- **Mandantentrennung** in jeder Abfrage + RBAC-Prüfung serverseitig in API **und** Seiten.
- Tenants können ihre **Provision nicht mehr selbst ändern** (nur Root).
- Gesperrte Geschäfte: keine Verkäufe/Rechnungen/Änderungen.
- Kasse: Transaktion + atomarer Lagerabzug (kein Überverkauf), race-sichere, lückenlose Rechnungsnummern pro Jahr.
- Storno: transaktional, doppelte Stornos unmöglich, Zahlungs-Split wird gegengebucht.
- Strikte Eingabevalidierung (zod `.strict()`), Betragsgrenzen, Body-Size-Limit 256 KB.
- **CSV-/XML-Injection** in Exporten verhindert, Datumsparameter validiert.
- Öffentliche Buchung: Rate-Limit, Honeypot, keine Buchung in der Vergangenheit, Service muss zum Geschäft gehören, minimale Antwortdaten.
- Keine Passwort-Hashes / IBAN in API-Antworten oder Audit-Logs.

## Hinweise / offene Integrationen
- TSE (Fiskaly), Stripe Connect/Terminal, E-Mail/SMS und Claude-API sind **Integrationspunkte** (im Code markiert) und benötigen echte Zugangsdaten.
- Rate-Limiter ist In-Memory → bei mehreren Server-Instanzen auf Redis umstellen.
- `docs/sql/rls.sql` ist optional und nur zusammen mit einer per-Request gesetzten `app.tenant_id` nutzbar (siehe Datei).
- Schema-Änderungen: `src/db/schema.ts` bearbeiten → `npm run db:generate` → Migration wird beim nächsten Start angewendet.
