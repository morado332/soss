"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Lang } from "@/lib/i18n";
import { LANGS, isRtl } from "@/lib/i18n";

const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>( { lang: "de", setLang: () => {} } );
export const useLang = () => useContext(LangCtx);

export function Providers({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("de");
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("arena_lang") as Lang | null;
    if (saved) setLangState(saved);
    setDark(localStorage.getItem("arena_dark") === "1");
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
    localStorage.setItem("arena_lang", lang);
  }, [lang]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("arena_dark", dark ? "1" : "0");
  }, [dark]);
  return (
    <LangCtx.Provider value={{ lang, setLang: setLangState }}>
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <ThemeToggle dark={dark} toggle={() => setDark(!dark)} />
        {children}
      </div>
    </LangCtx.Provider>
  );
}

function ThemeToggle({ dark, toggle }: { dark: boolean; toggle: () => void }) {
  return (
    <button onClick={toggle} aria-label="Theme" className="fixed bottom-4 end-4 z-50 h-11 w-11 rounded-full bg-slate-900 text-white shadow-lg dark:bg-white dark:text-slate-900">
      {dark ? "☀️" : "🌙"}
    </button>
  );
}

export function LanguageSwitcher() {
  const { lang, setLang } = useLang();
  return (
    <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900" aria-label="Language">
      {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
    </select>
  );
}
