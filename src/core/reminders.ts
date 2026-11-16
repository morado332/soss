import "server-only";
import { and, eq, gt, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, notifications, tenants, fs_lessons, fs_students, fs_instructors } from "@/db/schema";
import { sendEmail } from "./notify";

const fmt = (d: Date) => d.toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "full", timeStyle: "short" });

type Window = { col: "reminded_24h_at" | "reminded_1h_at"; ms: number; label: string };
const WINDOWS: Window[] = [
  { col: "reminded_1h_at", ms: 60 * 60_000, label: "in 1 Stunde" },
  { col: "reminded_24h_at", ms: 24 * 60 * 60_000, label: "morgen" },
];

/**
 * Sends due reminders (24 h and 1 h before) for appointments and driving lessons.
 * Each reminder is "claimed" with an atomic UPDATE … WHERE reminded_x IS NULL, so concurrent runs
 * never send twice. Optionally limited to one tenant.
 */
export async function processReminders(tenantId?: string): Promise<number> {
  const now = new Date();
  let count = 0;
  for (const w of WINDOWS) {
    const until = new Date(now.getTime() + w.ms);
    // When the 1-hour reminder goes out, the 24-hour one is no longer useful → mark both.
    const markBoth = w.col === "reminded_1h_at";

    // ---- appointments
    const aConds = [gt(appointments.starts_at, now), lte(appointments.starts_at, until), isNull(appointments[w.col]), inArray(appointments.status, ["scheduled", "confirmed"])];
    if (tenantId) aConds.push(eq(appointments.tenant_id, tenantId));
    const claimed = await db.update(appointments)
      .set(markBoth ? { reminded_1h_at: now, reminded_24h_at: sql`coalesce(${appointments.reminded_24h_at}, now())` } : { reminded_24h_at: now })
      .where(and(...aConds))
      .returning({ id: appointments.id, tenant_id: appointments.tenant_id, name: appointments.customer_name, email: appointments.customer_email, starts_at: appointments.starts_at });
    for (const a of claimed) {
      const [t] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, a.tenant_id)).limit(1);
      await sendEmail(a.email ?? "", `Erinnerung: Ihr Termin ${w.label} – ${t?.name ?? ""}`,
        `Hallo ${a.name},\n\nwir erinnern Sie an Ihren Termin bei ${t?.name ?? ""}:\n${fmt(a.starts_at)}\n\nBis bald!`);
      await db.insert(notifications).values({ tenant_id: a.tenant_id, title: `Erinnerung gesendet (${w.label})`, body: `${a.name} · ${fmt(a.starts_at)}`, type: "reminder" });
      count++;
    }

    // ---- driving lessons (student + instructor)
    const lConds = [gt(fs_lessons.starts_at, now), lte(fs_lessons.starts_at, until), isNull(fs_lessons[w.col]), eq(fs_lessons.status, "scheduled")];
    if (tenantId) lConds.push(eq(fs_lessons.tenant_id, tenantId));
    const lessons = await db.update(fs_lessons)
      .set(markBoth ? { reminded_1h_at: now, reminded_24h_at: sql`coalesce(${fs_lessons.reminded_24h_at}, now())` } : { reminded_24h_at: now })
      .where(and(...lConds))
      .returning({ id: fs_lessons.id, tenant_id: fs_lessons.tenant_id, student_id: fs_lessons.student_id, instructor_id: fs_lessons.instructor_id, starts_at: fs_lessons.starts_at });
    for (const l of lessons) {
      const [st] = await db.select({ name: fs_students.name, email: fs_students.email }).from(fs_students).where(and(eq(fs_students.id, l.student_id), eq(fs_students.tenant_id, l.tenant_id))).limit(1);
      const [ins] = await db.select({ name: fs_instructors.name, email: fs_instructors.email }).from(fs_instructors).where(and(eq(fs_instructors.id, l.instructor_id), eq(fs_instructors.tenant_id, l.tenant_id))).limit(1);
      const [t] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, l.tenant_id)).limit(1);
      const when = fmt(l.starts_at);
      if (st) await sendEmail(st.email ?? "", `Erinnerung: Fahrstunde ${w.label}`, `Hallo ${st.name},\n\nIhre Fahrstunde bei ${t?.name ?? ""} mit ${ins?.name ?? ""} beginnt ${w.label}:\n${when}\n\nGute Fahrt!`);
      if (ins) await sendEmail(ins.email ?? "", `Fahrstunde ${w.label}: ${st?.name ?? ""}`, `Hallo ${ins.name},\n\nnächste Fahrstunde mit ${st?.name ?? ""}:\n${when}`);
      await db.insert(notifications).values({ tenant_id: l.tenant_id, title: `Erinnerung gesendet (${w.label})`, body: `${st?.name ?? ""} · ${when}`, type: "reminder" });
      count++;
    }
  }
  return count;
}
