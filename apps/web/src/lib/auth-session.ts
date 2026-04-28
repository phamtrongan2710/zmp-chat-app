import { nativeStorage } from "zmp-sdk";

const JWT_KEY = "zmp-chat-app-jwt";

export function readAppJwt(): string | null {
  try {
    const value = nativeStorage.getItem(JWT_KEY);
    return value ? value : null;
  } catch {
    return null;
  }
}

export function writeAppJwt(token: string | null): void {
  if (!token) {
    try {
      nativeStorage.removeItem(JWT_KEY);
    } catch {
      // ignore — key may not exist
    }
    return;
  }
  nativeStorage.setItem(JWT_KEY, token);
}
