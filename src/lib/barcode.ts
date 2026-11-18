// EAN-13: check digit + bar pattern ("1" = bar, "0" = space). Pure functions, client & server.
const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = L.map((p) => p.replace(/./g, (c) => (c === "0" ? "1" : "0")));
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

export function eanCheck(d12: string): number {
  let s = 0;
  for (let i = 0; i < 12; i++) s += Number(d12[i]) * (i % 2 ? 3 : 1);
  return (10 - (s % 10)) % 10;
}
export const isEan13 = (c: string | null | undefined): c is string => !!c && /^\d{13}$/.test(c) && eanCheck(c.slice(0, 12)) === Number(c[12]);

export function ean13Pattern(code: string): string {
  const d = code.split("").map(Number);
  const par = PARITY[d[0]];
  let out = "101";
  for (let i = 1; i <= 6; i++) out += (par[i - 1] === "L" ? L : G)[d[i]];
  out += "01010";
  for (let i = 7; i <= 12; i++) out += R[d[i]];
  return out + "101";
}

/** In-store EAN-13 (prefix 20–29 is reserved for internal use). */
export function internalEan(random: () => number = Math.random): string {
  let s = "2" + String(Math.floor(random() * 10));
  for (let i = 0; i < 10; i++) s += String(Math.floor(random() * 10));
  return s + eanCheck(s);
}
