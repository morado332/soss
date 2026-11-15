// Commission engine — Section 8: Payout Split
// Priority: Project override → Tenant setting → Platform default
// Fee can be percent + fixed (e.g. 5% + 0.30€). Snapshot frozen per transaction.
export interface CommissionInput {
  grossCents: number;
  percentBp: number; // 500 = 5%
  fixedCents: number;
  taxRateBp: number; // 1900 = 19%, 700 = 7%
}

export function calcSplit(input: CommissionInput) {
  const { grossCents, percentBp, fixedCents, taxRateBp } = input;
  // VAT included in gross: tax = gross * rate / (10000 + rate)
  const taxCents = Math.round((grossCents * taxRateBp) / (10000 + taxRateBp));
  const percentPart = Math.round((grossCents * percentBp) / 10000);
  const commissionCents = percentPart + fixedCents;
  const netCents = grossCents - taxCents - commissionCents;
  return { grossCents, taxCents, commissionCents, netCents, percentPart, fixedCents, taxRateBp, percentBp };
}

export function resolveCommission(opts: {
  project?: { percentBp: number | null; fixedCents: number | null } | null;
  tenant?: { percentBp: number; fixedCents: number; taxRateBp: number } | null;
  platform?: { percentBp: number; fixedCents: number; taxRateBp: number } | null;
}) {
  if (opts.project && opts.project.percentBp != null) {
    return {
      percentBp: opts.project.percentBp,
      fixedCents: opts.project.fixedCents ?? opts.tenant?.fixedCents ?? 0,
      taxRateBp: opts.tenant?.taxRateBp ?? opts.platform?.taxRateBp ?? 1900,
      source: "project" as const,
    };
  }
  if (opts.tenant) return { percentBp: opts.tenant.percentBp, fixedCents: opts.tenant.fixedCents, taxRateBp: opts.tenant.taxRateBp, source: "tenant" as const };
  const p = opts.platform ?? { percentBp: 500, fixedCents: 30, taxRateBp: 1900 };
  return { ...p, source: "platform" as const };
}

export const eur = (cents: number) => (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
export const bpToPercent = (bp: number) => `${(bp / 100).toFixed(2)}%`;

// Platform monthly fee invoice: commission total + 19% VAT on commission itself
export function platformFeeInvoice(commissionTotalCents: number) {
  const vat = Math.round((commissionTotalCents * 1900) / 10000);
  return { commission: commissionTotalCents, vat, total: commissionTotalCents + vat };
}
