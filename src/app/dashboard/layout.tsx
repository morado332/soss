import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/db";
import { tenants, notifications } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { professionByKey } from "@/lib/professions";
import { LanguageSwitcher } from "@/components/providers";
import { ensureSeed } from "@/lib/seed";
import { LogoutButton } from "@/components/logout";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/dashboard", label: "📊 Dashboard", key: "dashboard" },
  { href: "/dashboard/pos", label: "🛒 Kasse (POS)", key: "pos" },
  { href: "/dashboard/appointments", label: "📅 Termine", key: "appointments" },
  { href: "/dashboard/products", label: "📦 Produkte & Lager", key: "products" },
  { href: "/dashboard/invoices", label: "🧾 Rechnungen", key: "invoices" },
  { href: "/dashboard/accountant", label: "🧮 Steuerberater", key: "accountant" },
  { href: "/dashboard/ai", label: "🤖 KI-Berater", key: "ai" },
  { href: "/dashboard/reports", label: "📈 Berichte", key: "reports" },
  { href: "/dashboard/settings", label: "⚙️ Einstellungen", key: "settings" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await ensureSeed();
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role === "root" || user.role === "super_admin") redirect("/root");

  let tenant = null;
  let notifs: { id: string; title: string; body: string | null; created_at: Date }[] = [];
  if (user.role === "accountant") {
    // Accountant sees linked tenants summary
    const { accountant_links } = await import("@/db/schema");
    const links = await db.select().from(accountant_links).where(eq(accountant_links.accountant_user_id, user.id));
    const first = links[0];
    if (first) {
      const [t] = await db.select().from(tenants).where(eq(tenants.id, first.tenant_id)).limit(1);
      tenant = t ?? null;
    }
  } else if (user.tenant_id) {
    const [t] = await db.select().from(tenants).where(eq(tenants.id, user.tenant_id)).limit(1);
    tenant = t ?? null;
    notifs = await db.select().from(notifications).where(and(eq(notifications.tenant_id, user.tenant_id), eq(notifications.is_read, false))).orderBy(notifications.created_at).limit(5);
  }

  const prof = tenant ? professionByKey(tenant.profession) : null;

  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col lg:flex-row">
      <aside className="w-full shrink-0 border-b border-slate-200 bg-white p-4 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:border-b-0 lg:border-e dark:border-slate-800 dark:bg-slate-900">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-lg"><span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white">A</span> Arena</Link>
        {tenant && prof && (
          <div className="mt-4 rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
            <p className="text-2xl">{prof.icon}</p>
            <p className="mt-1 font-bold leading-tight">{tenant.name}</p>
            <p className="text-xs text-slate-500">{prof.nameDe} · {tenant.plan} · {tenant.status}</p>
            <p className="mt-1 text-xs text-slate-400">Buchungslink: /book/{tenant.slug}</p>
          </div>
        )}
        {user.role === "accountant" && (
          <div className="mt-4 rounded-2xl bg-teal-50 p-3 text-sm dark:bg-teal-950">
            <p className="font-bold">🧾 Steuerberater</p>
            <p className="text-xs text-slate-500">Accountant ID: {user.accountant_id} — nur eigene Mandanten sichtbar</p>
          </div>
        )}
        <nav className="mt-4 flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {NAV.map((n) => (
            <Link key={n.key} href={n.href} className="whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800">{n.label}</Link>
          ))}
        </nav>
        <div className="mt-4 hidden lg:block">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Benachrichtigungen</p>
          {notifs.length === 0 ? <p className="text-xs text-slate-400">Keine neuen.</p> : notifs.map((n) => (
            <div key={n.id} className="mb-2 rounded-xl bg-blue-50 p-2 text-xs dark:bg-blue-950"><p className="font-semibold">{n.title}</p><p className="text-slate-500">{n.body}</p></div>
          ))}
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
          <div className="min-w-0">
            <p className="truncate font-bold">{user.name}</p>
            <p className="text-xs text-slate-500">{user.role}{user.accountant_id ? ` · ${user.accountant_id}` : ""} · {user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link href="/" className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700">Website</Link>
            <LogoutButton />
          </div>
        </header>
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
