"use client";
import { Printer } from "lucide-react";
import { btnPrimary } from "@/components/ui";
export function PrintButton({ label }: { label: string }) {
  return <button onClick={() => window.print()} className={btnPrimary}><Printer className="h-4 w-4" />{label}</button>;
}
