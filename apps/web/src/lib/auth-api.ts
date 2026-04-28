import { apiRequest } from "./api-client";

export type AuthenticatedUser = {
  id: string;
  name: string;
  handle: string;
  avatarLabel: string;
  avatarUrl: string | null;
};

export type AuthenticatedSession = {
  appJwt: string;
  user: AuthenticatedUser;
};

export function postZmpLogin(payload: { accessToken: string }): Promise<AuthenticatedSession> {
  return apiRequest<AuthenticatedSession>("/auth/zalo/zmp", {
    method: "POST",
    body: payload,
    skipAuth: true,
  });
}

export function postLogout(): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

export function fetchMe(): Promise<AuthenticatedUser> {
  return apiRequest<AuthenticatedUser>("/me", { method: "GET" });
}
