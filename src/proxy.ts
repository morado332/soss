import { NextResponse, type NextRequest } from "next/server";

// Global security layer:
//  - strict nonce-based Content-Security-Policy + hardening headers on every response
//  - CSRF protection: state-changing API requests must come from our own origin
//  - request body size limit for API routes
const MAX_BODY_BYTES = 256 * 1024;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin) {
    try { return new URL(origin).host === host; } catch { return false; }
  }
  // No Origin header: browsers always send Sec-Fetch-Site on modern fetches
  const site = req.headers.get("sec-fetch-site");
  return !site || site === "same-origin" || site === "none";
}

export function proxy(req: NextRequest) {
  const isApi = req.nextUrl.pathname.startsWith("/api/");

  if (isApi && !SAFE_METHODS.has(req.method)) {
    if (!sameOrigin(req)) return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 403 });
    const len = Number(req.headers.get("content-length") ?? "0");
    if (len > MAX_BODY_BYTES) return NextResponse.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const https = process.env.VERCEL === "1" || (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    https ? "upgrade-insecure-requests" : "",
  ].filter(Boolean).join("; ");

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });

  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=(), payment=(self)");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (https) res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  if (isApi) res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = {
  matcher: [
    { source: "/((?!_next/static|_next/image|favicon.ico).*)", missing: [{ type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] },
  ],
};
