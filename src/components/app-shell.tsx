"use client";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, ShoppingCart, CalendarDays, Package, Receipt, Calculator, Sparkles, ChartColumn, Settings,
  Building2, Users, ScrollText, KeyRound, Menu, X, LogOut, Bell, ExternalLink, ShieldCheck, TriangleAlert,
  BellRing, Ticket, GraduationCap, UserCheck, Car, CalendarClock, BookOpen, Pill, UsersRound, Palette, CreditCard, IdCard,
  Contact, Truck, ShoppingBasket, Wallet, TrendingUp, Hourglass, ListTodo, MessagesSquare, Clock, BadgePercent, BookOpenText, Wheat, ChefHat,
  Armchair, Barcode, CalendarX, Layers, FolderTree, Shirt, Tags, ChartNoAxesCombined, BriefcaseBusiness, IdCardLanyard, HeartPulse, Stethoscope,
  UserX, FileHeart, FlaskConical, Search, CalendarOff, FileText, FolderKanban, ClipboardList, Coins, Home, UserRoundPen, UserRoundSearch, Eye, type LucideIcon,
} from "lucide-react";
import { cx } from "./ui";
import { LanguageSwitcher, ThemeToggle, useI18n } from "./providers";
import type { DictKey } from "@/lib/i18n";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, pos: ShoppingCart, appointments: CalendarDays, products: Package, invoices: Receipt,
  accountant: Calculator, ai: Sparkles, reports: ChartColumn, settings: Settings, tenants: Building2, users: Users,
  audit: ScrollText, account: KeyRound, shield: ShieldCheck,
  reminders: BellRing, queue: Ticket, students: GraduationCap, instructors: UserCheck, vehicles: Car, lessons: CalendarClock, theory: BookOpen,
  pharmacy: Pill, team: UsersRound, branding: Palette, payments: CreditCard, profile: IdCard,
  customers: Contact, suppliers: Truck, purchases: ShoppingBasket, expenses: Wallet, profits: TrendingUp, debts: Hourglass, tasks: ListTodo,
  messages: MessagesSquare, attendance: Clock, promotions: BadgePercent, menu: BookOpenText, ingredients: Wheat, kitchen: ChefHat, tables: Armchair,
  barcode: Barcode, expiry: CalendarX, batches: Layers, drugcats: FolderTree, variants: Shirt, categories: Tags, sales: ChartNoAxesCombined,
  salesreps: BriefcaseBusiness, employees: IdCardLanyard, patients: HeartPulse, services: Stethoscope, noshow: UserX, prescriptions: FileHeart,
  lab: FlaskConical, search: Search, closing: CalendarOff, vouchers: FileText, projects: FolderKanban, progress: ClipboardList, dailyprice: Coins,
  properties: Home, sellers: UserRoundPen, buyers: UserRoundSearch, viewings: Eye,
};

export type NavItem = { href: string; label: DictKey; icon: keyof typeof ICONS; exact?: boolean; group?: DictKey };
export type Notif = { id: string; title: string; body: string | null; created_at: string };
export type AiNotif = Notif & { severity: string; is_read: boolean };

/** Renders an AI insight stored as i18n key + JSON variables. */
export function useAiText() {
  const { t } = useI18n();
  return (n: { title: string; body: string | null }) => {
    let vars: Record<string, string | number> = {};
    try { vars = JSON.parse(n.body ?? "{}"); } catch { /* plain text */ }
    return n.title.startsWith("ai_") ? t(n.title as DictKey, vars) : n.title;
  };
}
const SEVERITY: Record<string, string> = {
  critical: "border-s-red-500 bg-red-50/60 dark:bg-red-950/30", warning: "border-s-amber-500 bg-amber-50/60 dark:bg-amber-950/30",
  tip: "border-s-violet-500 bg-violet-50/60 dark:bg-violet-950/30", info: "border-s-sky-500 bg-sky-50/50 dark:bg-sky-950/30",
};

function AiCenter({ items }: { items: AiNotif[] }) {
  const { t, locale } = useI18n();
  const text = useAiText();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(items);
  const unread = list.filter((n) => !n.is_read).length;
  const toggle = async () => {
    const next = !open; setOpen(next);
    if (next && unread) {
      await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "ai" }) });
      setList((l) => l.map((n) => ({ ...n, is_read: true })));
    }
  };
  return (
    <div className="relative">
      <button onClick={toggle} aria-label={t("ai_center")} title={t("ai_center")} className="relative grid h-9 w-9 place-items-center rounded-lg border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-500/10 dark:text-violet-300">
        <Sparkles className="h-4 w-4" />
        {unread > 0 && <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute end-0 z-40 mt-2 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-violet-500" />{t("ai_center")}</p>
            <Link href="/dashboard/ai" onClick={() => setOpen(false)} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">{t("viewAll")}</Link>
          </div>
          {list.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-500">{t("ai_none")}</p> : (
            <ul className="max-h-[26rem] space-y-2 overflow-y-auto p-3">
              {list.map((n) => (
                <li key={n.id} className={cx("rounded-lg border-s-4 px-3 py-2.5", SEVERITY[n.severity] ?? SEVERITY.info)}>
                  <p className="text-sm leading-snug">{text(n)}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{t(`ai_sev_${n.severity}` as DictKey)} · {new Date(n.created_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function LogoutButton({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}
      className={cx("inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800", className)}
    >
      <LogOut className="h-4 w-4" />{t("logout")}
    </button>
  );
}

export function AppShell({
  nav, children, user, context, theme, notifications = [], banner, aiNotifications,
}: {
  nav: NavItem[]; children: ReactNode; theme: "dark" | "light";
  user: { name: string; email: string; role: DictKey };
  context?: { title: string; subtitle?: string; icon?: string; link?: { href: string; label: string } };
  notifications?: Notif[]; banner?: "suspended" | null; aiNotifications?: AiNotif[];
}) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [bell, setBell] = useState(false);
  const isActive = (n: NavItem) => (n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(n.href + "/"));
  const initials = user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/" aria-label="Arena"><Logo /></Link>
        <button className="lg:hidden" onClick={() => setOpen(false)} aria-label={t("close")}><X className="h-5 w-5" /></button>
      </div>
      {context && (
        <div className="mx-3 mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            {context.icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white text-lg shadow-sm dark:bg-slate-900">{context.icon}</span>}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{context.title}</p>
              {context.subtitle && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{context.subtitle}</p>}
            </div>
          </div>
          {context.link && (
            <a href={context.link.href} target="_blank" rel="noopener noreferrer" className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              <ExternalLink className="h-3.5 w-3.5" />{context.link.label}
            </a>
          )}
        </div>
      )}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {nav.map((n, i) => {
          const Icon = ICONS[n.icon] ?? LayoutDashboard;
          const active = isActive(n);
          const heading = n.group && n.group !== nav[i - 1]?.group ? n.group : null;
          return (
            <div key={n.href}>
            {heading && <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t(heading)}</p>}
            <Link href={n.href} onClick={() => setOpen(false)}
              className={cx("group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white")}>
              <Icon className={cx("h-[18px] w-[18px]", active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300")} />
              {t(n.label)}
            </Link>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-xs font-semibold text-white dark:from-slate-600 dark:to-slate-800">{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{user.name}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{t(user.role)} · {user.email}</p>
          </div>
        </div>
        <LogoutButton className="mt-1 w-full" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="no-print fixed inset-y-0 start-0 z-40 hidden w-64 border-e border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-72 max-w-[85%] bg-white shadow-xl dark:bg-slate-900">{sidebar}</aside>
        </div>
      )}
      <div className="lg:ps-64 print:!ps-0">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur md:px-8 dark:border-slate-800 dark:bg-slate-950/80">
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => setOpen(true)} aria-label="Menu"><Menu className="h-5 w-5" /></button>
          <div className="flex-1" />
          <LanguageSwitcher />
          <ThemeToggle initial={theme} />
          {aiNotifications && <AiCenter items={aiNotifications} />}
          {notifications !== undefined && (
            <div className="relative">
              <button onClick={() => setBell((b) => !b)} aria-label={t("nav_notifications")} className="relative grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
                <Bell className="h-4 w-4" />
                {notifications.length > 0 && <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{notifications.length}</span>}
              </button>
              {bell && (
                <div className="absolute end-0 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold dark:border-slate-800">{t("nav_notifications")}</p>
                  {notifications.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">{t("noNotifications")}</p> : (
                    <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                      {notifications.map((n) => (
                        <li key={n.id} className="px-4 py-3">
                          <p className="text-sm font-medium">{n.title}</p>
                          {n.body && <p className="mt-0.5 text-xs text-slate-500">{n.body}</p>}
                          <p className="mt-1 text-[11px] text-slate-400">{new Date(n.created_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </header>
        {banner === "suspended" && (
          <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 md:px-8 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">
            <TriangleAlert className="h-4 w-4 shrink-0" />{t("suspendedBanner")}
          </div>
        )}
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
