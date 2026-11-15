import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Arena — SaaS für 14 Branchen | Kasse, Termine, Rechnungen",
  description: "Multi-Tenant SaaS Plattform für Deutschland: POS, Termine, GoBD-Rechnungen, TSE/Fiskaly, DATEV, Stripe Connect — für Fahrschule, Friseur, Kiosk, Praxis, Apotheke und mehr.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
