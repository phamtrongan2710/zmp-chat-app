import { readAppJwt, writeAppJwt } from "./auth-session";

export const API_URL = import.meta.env.VITE_API_URL ?? "https://localhost:3000";

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

type RequestOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await sendRequest(path, options);

  if (response.status === 401 && !options.skipAuth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const retry = await sendRequest(path, options);
      if (retry.ok) return parseJson<T>(retry);
      if (retry.status === 401) {
        writeAppJwt(null);
        onUnauthorized?.();
      }
      throw await asApiError(retry);
    }

    writeAppJwt(null);
    onUnauthorized?.();
    throw await asApiError(response);
  }

  if (!response.ok) {
    throw await asApiError(response);
  }

  return parseJson<T>(response);
}

async function sendRequest(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (!options.skipAuth) {
    const jwt = readAppJwt();
    if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
  }

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    if (typeof options.body === "string" || options.body instanceof FormData || options.body instanceof URLSearchParams) {
      body = options.body as BodyInit;
    } else {
      body = JSON.stringify(options.body);
      headers["Content-Type"] ??= "application/json";
    }
  }

  return fetch(`${API_URL}${path}`, { ...options, headers, body });
}

async function tryRefresh(): Promise<boolean> {
  const jwt = readAppJwt();
  if (!jwt) return false;

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appJwt: jwt }),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { appJwt?: string };
    if (!data.appJwt) return false;
    writeAppJwt(data.appJwt);
    return true;
  } catch {
    return false;
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function asApiError(response: Response): Promise<ApiError> {
  let message = response.statusText;
  try {
    const text = await response.text();
    if (text) message = text;
  } catch {
    // ignore
  }
  return new ApiError(response.status, message);
}
