import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/providers";
import { getI18n, getTheme } from "@/lib/i18n-server";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { getBranding } from "@/core/platform";

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBranding();
  return { ...baseMetadata, title: { default: `${b.siteName} — ${b.tagline || "Kasse, Termine & Rechnungen"}`.slice(0, 90), template: `%s · ${b.siteName}` }, applicationName: b.siteName };
}

const baseMetadata: Metadata = {
  description: "Multi-Tenant SaaS für lokale Unternehmen in Deutschland: POS mit TSE, Online-Termine, GoBD-Rechnungen, DATEV-Export.",
  robots: { index: true, follow: true },
  applicationName: "Arena",
  appleWebApp: { capable: true, title: "Arena", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { themeColor: "#4f46e5", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { lang, dir } = await getI18n();
  const theme = await getTheme();
  const b = await getBranding();
  return (
    <html lang={lang} dir={dir} className={theme === "dark" ? "dark" : undefined} suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <Providers lang={lang} branding={{ siteName: b.siteName, logo: b.logo }}>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
