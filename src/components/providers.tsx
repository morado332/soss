"use client";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun, Languages } from "lucide-react";
import { LANGS, LANG_COOKIE, THEME_COOKIE, makeT, locale, errorText, type Lang, type TFn } from "@/lib/i18n";

type Ctx = { lang: Lang; t: TFn; locale: string; err: (code: unknown) => string };
const I18nCtx = createContext<Ctx>({ lang: "de", t: makeT("de"), locale: "de-DE", err: (c) => errorText("de", c) });
export const useI18n = () => useContext(I18nCtx);

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

export function Providers({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo<Ctx>(() => ({ lang, t: makeT(lang), locale: locale(lang), err: (c) => errorText(lang, c) }), [lang]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, t } = useI18n();
  const router = useRouter();
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t("language")}</span>
      <Languages className="pointer-events-none absolute start-2.5 h-4 w-4 text-slate-500" aria-hidden />
      <select
        value={lang}
        onChange={(e) => { setCookie(LANG_COOKIE, e.target.value); router.refresh(); }}
        className="h-9 appearance-none rounded-lg border border-slate-200 bg-white ps-8 pe-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {LANGS.map((l) => <option key={l.code} value={l.code}>{compact ? l.short : l.label}</option>)}
      </select>
    </label>
  );
}

export function ThemeToggle({ initial }: { initial: "dark" | "light" }) {
  const { t } = useI18n();
  const [dark, setDark] = useState(initial === "dark");
  return (
    <button
      type="button"
      aria-label={t("theme")}
      title={t("theme")}
      onClick={() => { const next = !dark; setDark(next); document.documentElement.classList.toggle("dark", next); setCookie(THEME_COOKIE, next ? "dark" : "light"); }}
      className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
