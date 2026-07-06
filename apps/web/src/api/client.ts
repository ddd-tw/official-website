/**
 * Single typed HTTP layer for the whole app (SRP / DIP).
 * Every component talks to the API through `api` (public) or `adminApi`
 * (admin token injected). URLs always come from `routes` in @dddtw/contracts.
 */
import { ADMIN_TOKEN_HEADER, type ApiError } from "@dddtw/contracts";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

/** Normalize anything thrown during a request into an ApiRequestError. */
export function toApiRequestError(err: unknown): ApiRequestError {
  if (err instanceof ApiRequestError) return err;
  const message = err instanceof Error ? err.message : "無法連線至伺服器";
  return new ApiRequestError(0, "NETWORK_ERROR", message);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiRequestError(0, "NETWORK_ERROR", "無法連線至伺服器,請稍後再試");
  }
  if (!res.ok) {
    let code = "UNKNOWN";
    let message = `伺服器回應錯誤(HTTP ${res.status})`;
    try {
      const body = (await res.json()) as Partial<ApiError>;
      if (body.error) {
        code = body.error.code;
        message = body.error.message;
      }
    } catch {
      /* non-JSON error body — keep defaults */
    }
    throw new ApiRequestError(res.status, code, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const JSON_HEADERS = { "content-type": "application/json" } as const;

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path);
  },
  post<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
  },
};

// ---------------------------------------------------------------------------
// Admin token management (localStorage) + admin API variant
// ---------------------------------------------------------------------------

const ADMIN_TOKEN_STORAGE_KEY = "dddtw_admin_token";

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
}

export function setAdminToken(token: string): void {
  localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
}

function adminHeaders(): Record<string, string> {
  const token = getAdminToken();
  if (!token) {
    throw new ApiRequestError(401, "NO_ADMIN_TOKEN", "尚未登入管理後台");
  }
  return { [ADMIN_TOKEN_HEADER]: token };
}

export const adminApi = {
  get<T>(path: string): Promise<T> {
    return request<T>(path, { headers: adminHeaders() });
  },
  post<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, {
      method: "POST",
      headers: { ...JSON_HEADERS, ...adminHeaders() },
      body: JSON.stringify(body),
    });
  },
  /** For binary/text downloads (e.g. CSV export) that need the token header. */
  async blob(path: string): Promise<Blob> {
    let res: Response;
    try {
      res = await fetch(path, { headers: adminHeaders() });
    } catch {
      throw new ApiRequestError(0, "NETWORK_ERROR", "無法連線至伺服器,請稍後再試");
    }
    if (!res.ok) {
      throw new ApiRequestError(res.status, "DOWNLOAD_FAILED", `下載失敗(HTTP ${res.status})`);
    }
    return res.blob();
  },
};

/** Trigger a browser download for a blob. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
