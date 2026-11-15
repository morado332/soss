import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser, isPlatformAdmin } from "@/lib/auth";
import { rootExists, demoSeeded } from "@/lib/setup";
import { getI18n, getTheme } from "@/lib/i18n-server";
import { AuthLayout } from "@/components/auth-layout";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Login" };

export default async function LoginPage() {
  if (!(await rootExists())) redirect("/setup");
  const user = await currentUser();
  if (user) redirect(isPlatformAdmin(user) ? "/root" : "/dashboard");
  const { t } = await getI18n();
  return <AuthLayout t={t} theme={await getTheme()}><LoginForm demo={await demoSeeded()} /></AuthLayout>;
}
