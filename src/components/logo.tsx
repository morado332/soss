"use client";
import { useBranding } from "./providers";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Site logo + name, as configured by the Root (falls back to the default "A" mark). */
export function Logo({ className }: { className?: string }) {
  const b = useBranding();
  return (
    <span className={cx("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      {b.logo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={b.logo} alt="" className="h-8 w-8 rounded-lg object-contain" />
        : <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-sm">{b.siteName.slice(0, 1).toUpperCase()}</span>}
      <span className="text-lg text-slate-900 dark:text-white">{b.siteName}</span>
    </span>
  );
}
