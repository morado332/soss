"use client";
import { useI18n } from "@/components/providers";
import { btnPrimary } from "@/components/ui";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n();
  return (
    <main className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div><p className="text-lg font-semibold">{t("errorGeneric")}</p><button onClick={reset} className={`${btnPrimary} mt-6`}>↻</button></div>
    </main>
  );
}
