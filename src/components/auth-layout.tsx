import Link from "next/link";
import { Logo } from "@/components/logo";
import type { ReactNode } from "react";
import { ShieldCheck, Receipt, Calculator } from "lucide-react";
import {} from "./ui";
import { LanguageSwitcher, ThemeToggle } from "./providers";
import type { TFn } from "@/lib/i18n";

/** Split-screen layout for login & setup pages. */
export function AuthLayout({ t, theme, children }: { t: TFn; theme: "dark" | "light"; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-6 sm:px-12">
        <div className="flex items-center justify-between">
          <Link href="/"><Logo /></Link>
          <div className="flex items-center gap-2"><LanguageSwitcher /><ThemeToggle initial={theme} /></div>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">{children}</div>
        <p className="text-center text-xs text-slate-400">© {new Date().getFullYear()} Arena</p>
      </div>
      <div className="relative hidden overflow-hidden bg-slate-950 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.35),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.3),transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="relative flex h-full flex-col justify-end p-14 text-white">
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">{t("loginAsideTitle")}</h2>
          <ul className="mt-8 space-y-4 text-slate-300">
            {[[ShieldCheck, t("loginAside1")], [Receipt, t("loginAside2")], [Calculator, t("loginAside3")]].map(([Icon, text], i) => {
              const I = Icon as typeof ShieldCheck;
              return <li key={i} className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15"><I className="h-4 w-4" /></span>{text as string}</li>;
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
