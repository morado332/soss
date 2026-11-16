"use client";
// Small fetch helper for client components: JSON in/out, never throws.
export async function api<T = Record<string, unknown>>(url: string, method = "GET", body?: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "NETWORK" } as T & { error?: string } };
  }
}

import { useEffect, type DependencyList } from "react";
/** Run an async loader after mount / when deps change (cancel-safe). */
export function useLoader(fn: () => unknown, deps: DependencyList) {
  useEffect(() => {
    let cancelled = false;
    let cleanup: unknown;
    queueMicrotask(() => { if (!cancelled) cleanup = fn(); });
    return () => { cancelled = true; if (typeof cleanup === "function") (cleanup as () => void)(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
/** Current time — kept out of render bodies so renders stay pure for the React compiler lint. */
export const nowMs = () => Date.now();
