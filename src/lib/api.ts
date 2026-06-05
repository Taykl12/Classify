const TOKEN_KEY = "classify_access_token";
const USER_KEY = "classify_user";

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function clearStoredSession(): void {
  setAccessToken(null);
  localStorage.removeItem(USER_KEY);
}

export function registerUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers: { ...headers, ...(options.headers as Record<string, string> | undefined) } });
  const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) {
    if (res.status === 401) {
      clearStoredSession();
      unauthorizedHandler?.();
    }
    throw new ApiError(body.error ?? body.message ?? res.statusText, res.status);
  }
  return body as T;
}

const RETRYABLE_STATUS = new Set([502, 503, 504]);

export async function apiFetchWithRetry<T>(
  path: string,
  options: RequestInit = {},
  attempts = 3,
  delayMs = 400
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await apiFetch<T>(path, options);
    } catch (error) {
      lastError = error;
      if (isUnauthorizedError(error)) throw error;
      const retryable =
        error instanceof ApiError
          ? RETRYABLE_STATUS.has(error.status)
          : error instanceof TypeError;
      if (!retryable || attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}
