import { notFound } from "next/navigation";
import { isKind, kindDef } from "@/modules/business/kinds";
import { requireModulePage } from "@/lib/module-page";
import RecordsClient from "@/components/records-client";

export const dynamic = "force-dynamic";

export default async function KindPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isKind(kind)) notFound();
  const def = kindDef(kind);
  const { can } = await requireModulePage(def.read, def.modules);
  return <RecordsClient kind={kind} canWrite={can(def.write)} />;
}
