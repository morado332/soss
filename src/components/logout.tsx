"use client";
export function LogoutButton() {
  return (
    <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }} className="rounded-xl bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
      Abmelden
    </button>
  );
}
