const SESSION_KEY = "zmp-chat-session-user";

export function readSessionUserId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function writeSessionUserId(userId: string | null): void {
  if (!userId) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }

  localStorage.setItem(SESSION_KEY, userId);
}
