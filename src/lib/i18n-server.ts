import "server-only";
import { cookies } from "next/headers";
import { isLang, LANG_COOKIE, THEME_COOKIE, makeT, isRtl, locale, type Lang } from "./i18n";

export async function getI18n() {
  const c = await cookies();
  const v = c.get(LANG_COOKIE)?.value;
  const lang: Lang = isLang(v) ? v : "de";
  return { lang, t: makeT(lang), dir: isRtl(lang) ? "rtl" : "ltr", locale: locale(lang) } as const;
}

export async function getTheme(): Promise<"dark" | "light"> {
  const c = await cookies();
  return c.get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
}
