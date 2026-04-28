import { apiRequest } from "./api-client";

export type AuthorizeUrlResponse = {
  url: string;
  state: string;
  codeVerifier: string;
};

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

export function fetchAuthorizeUrl(): Promise<AuthorizeUrlResponse> {
  return apiRequest<AuthorizeUrlResponse>("/auth/zalo/url", { method: "GET", skipAuth: true });
}

export function postZaloCallback(payload: {
  code: string;
  state: string;
  codeVerifier: string;
}): Promise<AuthenticatedSession> {
  return apiRequest<AuthenticatedSession>("/auth/zalo/callback", {
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
