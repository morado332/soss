import Link from "next/link";
import { getI18n } from "@/lib/i18n-server";
import { btnPrimary } from "@/components/ui";
export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div><p className="text-6xl font-semibold text-indigo-600">404</p><p className="mt-4 text-slate-500">{t("err_NOT_FOUND")}</p><Link href="/" className={`${btnPrimary} mt-6`}>Arena</Link></div>
    </main>
  );
}
