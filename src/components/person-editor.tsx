"use client";
import { useState } from "react";
import { X, Save } from "lucide-react";
import { useI18n } from "@/components/providers";
import { Card, Field, btnPrimary, btnSecondary, btnSm, cx, inputCls } from "@/components/ui";
import type { DictKey } from "@/lib/i18n";

export type PersonValues = { name: string; email: string; password: string; is_active: boolean };

/** Small reusable editor: name / e-mail / new password / active. Only changed fields are sent. */
export function PersonEditor({ title, initial, onSave, onClose, children, extra }: {
  title: string; initial: Omit<PersonValues, "password">; onSave: (changes: Partial<PersonValues>) => Promise<boolean>; onClose: () => void;
  children?: React.ReactNode; extra?: () => Record<string, unknown>;
}) {
  const { t } = useI18n();
  const [v, setV] = useState<PersonValues>({ ...initial, password: "" });
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const ch: Partial<PersonValues> & Record<string, unknown> = { ...(extra ? extra() : {}) };
    if (v.name !== initial.name) ch.name = v.name;
    if (v.email !== initial.email) ch.email = v.email;
    if (v.password) ch.password = v.password;
    if (v.is_active !== initial.is_active) ch.is_active = v.is_active;
    const ok = await onSave(ch); setBusy(false); if (ok) onClose();
  }
  return (
    <Card title={title} action={<button type="button" onClick={onClose} className={cx(btnSecondary, btnSm)}><X className="h-3.5 w-3.5" /></button>}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("name")}><input required minLength={2} maxLength={120} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={inputCls} /></Field>
        <Field label={t("email")}><input required type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} className={inputCls} /></Field>
        <Field label={`${t("p2_newPassword")} (${t("optional")})`} hint={t("passwordRules")}><input type="password" autoComplete="new-password" minLength={10} maxLength={72} value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} className={inputCls} /></Field>
        <Field label={t("status")}>
          <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" checked={v.is_active} onChange={(e) => setV({ ...v, is_active: e.target.checked })} />{t(v.is_active ? "p2_active" : "p2_inactive" as DictKey)}</label>
        </Field>
        {children && <div className="sm:col-span-2 lg:col-span-4">{children}</div>}
        <div className="sm:col-span-2 lg:col-span-4"><button disabled={busy} className={btnPrimary}><Save className="h-4 w-4" />{t("save")}</button></div>
      </form>
    </Card>
  );
}
