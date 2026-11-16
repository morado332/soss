import "server-only";

/** Sends a plain-text email via Resend when RESEND_API_KEY + EMAIL_FROM are configured. Returns false otherwise. */
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: subject.slice(0, 200), text }),
      signal: AbortSignal.timeout(10_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export const emailEnabled = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
