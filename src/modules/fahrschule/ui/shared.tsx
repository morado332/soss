import type { DictKey } from "@/lib/i18n";

export const TYPE_KEYS = ["normal", "ueberland", "autobahn", "nacht", "exam"] as const;
export const typeLabel = (type: string) => `fs_type_${type}` as DictKey;
export const TYPE_TONE: Record<string, string> = {
  normal: "bg-slate-400", ueberland: "bg-emerald-500", autobahn: "bg-sky-500", nacht: "bg-indigo-500", exam: "bg-amber-500",
};

/** Thin progress bar "done / required" with the value as text (never colour alone). */
export function Progress({ label, done, required, tone = "bg-indigo-500" }: { label: string; done: number; required: number; tone?: string }) {
  const pct = required > 0 ? Math.min(100, Math.round((done / required) * 100)) : 0;
  const complete = required > 0 && done >= required;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-600 dark:text-slate-300">{label}</span>
        <span className={`tabular font-medium ${complete ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-200"}`}>{done}/{required}{complete ? " ✓" : ""}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full rounded-full ${complete ? "bg-emerald-500" : tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export type StudentRow = {
  id: string; name: string; email: string | null; phone: string | null; license_class: string; instructor_id: string | null; instructor: string | null;
  req_normal: number; req_ueberland: number; req_autobahn: number; req_nacht: number;
  theory_progress: number; theory_passed: boolean; practical_passed: boolean; theory_external_id: string | null; status: string; notes: string | null;
  done: { normal: number; ueberland: number; autobahn: number; nacht: number; exam: number; planned: number; unbilled: number };
};
