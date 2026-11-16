import "server-only";

/**
 * Validates a small image sent as data URL. Only PNG / JPEG / WEBP (checked by magic bytes, not just the
 * declared type) — SVG is refused because it can carry scripts. Returns the normalised data URL or null.
 */
export function validateImageDataUrl(input: string, maxBytes = 300 * 1024): string | null {
  const m = /^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(input);
  if (!m) return null;
  const buf = Buffer.from(m[3], "base64");
  if (!buf.length || buf.length > maxBytes) return null;
  const isPng = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isWebp = buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
  const type = isPng ? "image/png" : isJpeg ? "image/jpeg" : isWebp ? "image/webp" : null;
  if (!type) return null;
  return `data:${type};base64,${buf.toString("base64")}`;
}
