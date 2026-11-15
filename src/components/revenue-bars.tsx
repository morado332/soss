// Single-series daily revenue bars (one hue, rounded data-ends, 2px gaps, hover tooltip, sr-only table).
export function RevenueBars({ data, locale, label }: { data: { day: string; cents: number }[]; locale: string; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.cents));
  const fmt = (c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency: "EUR" });
  const dayFmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
  return (
    <figure aria-label={label}>
      <div className="flex h-40 items-end gap-[2px] border-b border-slate-200 dark:border-slate-800">
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end">
            <div className="w-full rounded-t-[4px] bg-indigo-500 transition-opacity group-hover:opacity-80 dark:bg-indigo-400" style={{ height: `${Math.max(d.cents > 0 ? 3 : 0, (d.cents / max) * 100)}%` }} />
            <div className="pointer-events-none absolute bottom-full start-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block rtl:translate-x-1/2 dark:bg-slate-700">
              <span className="text-slate-300">{dayFmt(d.day)}</span> · <span className="tabular font-semibold">{fmt(d.cents)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span>{data[0] && dayFmt(data[0].day)}</span><span>{data.at(-1) && dayFmt(data.at(-1)!.day)}</span>
      </div>
      <table className="sr-only"><caption>{label}</caption><tbody>{data.map((d) => <tr key={d.day}><td>{d.day}</td><td>{fmt(d.cents)}</td></tr>)}</tbody></table>
    </figure>
  );
}
