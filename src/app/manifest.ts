import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Arena — Kasse, Termine & Rechnungen",
    short_name: "Arena",
    description: "POS, Termine, GoBD-Rechnungen und DATEV-Export für lokale Unternehmen.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f8fafc",
    theme_color: "#4f46e5",
    lang: "de",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Kasse", url: "/dashboard/pos", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Termine", url: "/dashboard/appointments", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
