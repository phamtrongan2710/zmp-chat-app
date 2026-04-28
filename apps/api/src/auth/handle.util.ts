import { randomBytes } from "node:crypto";

export function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

export function deriveHandleBase(name: string): string {
  const stripped = stripDiacritics(name).toLowerCase();
  const cleaned = stripped.replace(/[^a-z0-9]/g, "");
  return cleaned || "user";
}

export function deriveHandle(name: string): string {
  const base = deriveHandleBase(name);
  const suffix = randomBytes(3).toString("hex");
  return `${base}_${suffix}`;
}

export function deriveAvatarLabel(name: string): string {
  const stripped = stripDiacritics(name).trim();
  if (!stripped) return "?";

  const tokens = stripped.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "?";

  if (tokens.length === 1) {
    return tokens[0].slice(0, 1).toUpperCase();
  }

  const last = tokens.slice(-2);
  return last.map((token) => token.slice(0, 1)).join("").toUpperCase();
}
