export class StoreApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function storeRequest<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const response = await fetch(`/api/store/${path}`, { method: options.method ?? "GET", headers: options.body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" }, body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: options.signal, credentials: "same-origin", cache: "no-store" });
  const text = await response.text(); let data;
  try { data = text ? JSON.parse(text) : null; } catch { throw new StoreApiError(`The store returned an unreadable response (${response.status}).`, response.status); }
  if (!response.ok) {
    const detail = data?.detail;
    const message = data?.error?.message ?? (typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((item: { msg: string }) => item.msg).join("; ") : undefined);
    throw new StoreApiError(message || `Request failed (${response.status}). Please retry.`, response.status);
  }
  return data as T;
}
export function unwrapStore<T>(value: T | { data: T }): T { return value && typeof value === "object" && "data" in value ? value.data : value as T; }
