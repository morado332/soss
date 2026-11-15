import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isHealthy } from "@/lib/diagnostics";
import { rootExists } from "@/lib/setup";
import { getI18n, getTheme } from "@/lib/i18n-server";
import { AuthLayout } from "@/components/auth-layout";
import SetupForm from "./setup-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Setup", robots: { index: false } };

export default async function SetupPage() {
  if (!(await isHealthy())) redirect("/status");
  if (await rootExists()) redirect("/login");
  const { t } = await getI18n();
  return <AuthLayout t={t} theme={await getTheme()}><SetupForm tokenFromEnv={!!process.env.SETUP_TOKEN} /></AuthLayout>;
}
