export class AdminApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function adminRequest<T>(path: string, options: { method?: string; body?: unknown; version?: number; signal?: AbortSignal } = {}): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  const multipart = options.body instanceof FormData;
  if (options.body !== undefined && !multipart) headers.set("Content-Type", "application/json");
  if (options.version !== undefined) headers.set("If-Match", `"${options.version}"`);
  let response: Response;
  try {
    response = await fetch(`/api/admin/${path}`, {
      method: options.method ?? "GET", credentials: "same-origin", cache: "no-store", headers,
      body: options.body === undefined ? undefined : multipart ? options.body as FormData : JSON.stringify(options.body), signal: options.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new AdminApiError("Unable to reach the store. Check your connection and retry.", 0);
  }
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : undefined; } catch { throw new AdminApiError("The API returned an unreadable response.", response.status); }
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("auth/")) window.dispatchEvent(new Event("admin-session-expired"));
    const detail = data?.detail;
    const validation = Array.isArray(detail) ? detail.map((item: { loc?: (string | number)[]; msg?: string }) => `${item.loc?.slice(1).join(".") ?? "Field"}: ${item.msg ?? "Invalid value"}`).join("; ") : undefined;
    const message = data?.error?.message ?? validation ?? (typeof detail === "string" ? detail : undefined);
    const requestId = data?.error?.requestId;
    const reference = typeof requestId === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(requestId) ? ` Reference: ${requestId}.` : "";
    throw new AdminApiError((message || (response.status === 412 ? "This record changed. Reload it before saving again." : response.status === 403 ? "Your staff account does not have permission for this action." : `Request failed (${response.status}). Please retry.`)) + reference, response.status);
  }
  return data as T;
}

export function unwrap<T>(value: T | { data: T }): T {
  return value && typeof value === "object" && "data" in value ? value.data : value as T;
}

export type Staff = { id: string; name: string; email: string; role: string; permissions: string[] };
export function parseStaff(value: unknown): Staff {
  const staff = unwrap(value) as Staff;
  if (!staff || typeof staff.id !== "string" || typeof staff.email !== "string" || !Array.isArray(staff.permissions) || !staff.permissions.every((permission) => typeof permission === "string")) {
    throw new Error("The API returned an unsupported staff profile. Expected id, email and permissions.");
  }
  return staff;
}
