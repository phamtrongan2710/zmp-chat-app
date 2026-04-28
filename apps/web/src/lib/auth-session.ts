const JWT_KEY = "zmp-chat-app-jwt";
const PKCE_KEY = "zmp-chat-pkce";

export function readAppJwt(): string | null {
  return localStorage.getItem(JWT_KEY);
}

export function writeAppJwt(token: string | null): void {
  if (!token) {
    localStorage.removeItem(JWT_KEY);
    return;
  }
  localStorage.setItem(JWT_KEY, token);
}

export type PkceStash = {
  codeVerifier: string;
  state: string;
};

export function writePkceStash(stash: PkceStash): void {
  sessionStorage.setItem(PKCE_KEY, JSON.stringify(stash));
}

export function readPkceStash(): PkceStash | null {
  const raw = sessionStorage.getItem(PKCE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PkceStash;
  } catch {
    return null;
  }
}

export function clearPkceStash(): void {
  sessionStorage.removeItem(PKCE_KEY);
}
