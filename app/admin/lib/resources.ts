import { adminRequest, unwrap } from "./api";

export type Money = { amount: number; currency: "GHS" };
export type Versioned = { id: string; version: number };
export type Page<T> = { data: T[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
export type Address = { address: string; city: string; region: string; country: string };
export type Order = Versioned & {
  reference: string; customerId: string | null; createdAt: string;
  customer: { name: string; email: string; phone: string };
  deliveryAddress: Address;
  items: { id: string; name: string; color: string; size: string; quantity: number; unitPrice: Money; lineTotal: Money }[];
  subtotal: Money; deliveryFee: Money; total: Money;
  paymentStatus: string; fulfilmentStatus: string;
  tracking: { carrier: string; number: string; url: string | null } | null;
};
export type CustomerRecord = Versioned & { name: string; email: string; phone: string | null; city: string | null; deliveryAddress: Address | null; createdAt: string; orderCount: number };
export type ReviewRecord = Versioned & { productId: string; displayName: string; rating: number; title: string; body: string; status: "pending" | "approved" | "rejected"; featured: boolean; verifiedPurchase: boolean; createdAt: string };
export type StaffRecord = Versioned & { name: string; email: string; role: string; status: "active" | "disabled"; mfaEnabled: boolean; permissions: string[] };
export type Settings = { storeName: string; currency: string; timezone: string; contact: { whatsapp: string | null; phone: string | null; email: string | null }; connections: { service: string; status: string }[]; version: number };
export type ContentValue = string | number | boolean | null | ContentValue[] | { [key: string]: ContentValue };
export type ContentObject = { [key: string]: ContentValue };
export type StoreDocument = { key?: string; content: ContentObject; version: number; updatedAt?: string };

export function isObject(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function version(value: unknown): asserts value is Record<string, unknown> & { version: number } {
  if (!isObject(value) || !Number.isInteger(value.version) || Number(value.version) < 1) throw new Error("The API response is missing a valid record version. Reload before making changes.");
}
function identified(value: unknown): asserts value is Record<string, unknown> & Versioned {
  version(value); if (typeof value.id !== "string") throw new Error("The API response is missing a record ID.");
}
function money(value: unknown): value is Money { return isObject(value) && Number.isInteger(value.amount) && value.currency === "GHS"; }
export function parseOrder(value: unknown): Order {
  identified(value);
  if (typeof value.reference !== "string" || !isObject(value.customer) || !isObject(value.deliveryAddress) || !Array.isArray(value.items) || !money(value.total) || !money(value.subtotal) || !money(value.deliveryFee) || typeof value.fulfilmentStatus !== "string" || typeof value.paymentStatus !== "string" || value.items.some((item) => !isObject(item) || !money(item.lineTotal) || !money(item.unitPrice))) throw new Error("Unsupported order response from the API.");
  return value as Order;
}
export function parseCustomer(value: unknown): CustomerRecord {
  identified(value);
  if (typeof value.name !== "string" || typeof value.email !== "string" || !Number.isInteger(value.orderCount) || typeof value.createdAt !== "string") throw new Error("Unsupported customer response from the API.");
  return value as CustomerRecord;
}
export function parseReview(value: unknown): ReviewRecord {
  identified(value);
  if (typeof value.body !== "string" || typeof value.displayName !== "string" || !Number.isInteger(value.rating) || !["pending", "approved", "rejected"].includes(String(value.status))) throw new Error("Unsupported review response from the API.");
  return value as ReviewRecord;
}
export function parseStaffRecord(value: unknown): StaffRecord {
  identified(value);
  if (typeof value.email !== "string" || typeof value.role !== "string" || !["active", "disabled"].includes(String(value.status))) throw new Error("Unsupported staff response from the API.");
  return value as StaffRecord;
}
export function parseSettings(value: unknown): Settings {
  version(value);
  if (typeof value.storeName !== "string" || !isObject(value.contact) || !Array.isArray(value.connections)) throw new Error("Unsupported settings response from the API.");
  return value as Settings;
}
export function parseDocument(value: unknown): StoreDocument {
  version(value);
  if (!isObject(value.content)) throw new Error("Unsupported page content response from the API.");
  return value as StoreDocument;
}
export function parsePage<T>(value: unknown, parse: (item: unknown) => T): Page<T> {
  if (!isObject(value) || !Array.isArray(value.data) || !isObject(value.pagination) || !["total", "totalPages", "page", "pageSize"].every((field) => Number.isInteger((value.pagination as Record<string, unknown>)[field]))) throw new Error("Unsupported paginated response from the API.");
  return { data: value.data.map(parse), pagination: value.pagination as Page<T>["pagination"] };
}

export const parsers = {
  order: (value: unknown) => parseOrder(unwrap(value)),
  customer: (value: unknown) => parseCustomer(unwrap(value)),
  orders: (value: unknown) => parsePage(value, parseOrder),
  customers: (value: unknown) => parsePage(value, parseCustomer),
  reviews: (value: unknown) => parsePage(value, parseReview),
  staff: (value: unknown) => parsePage(value, parseStaffRecord),
  settings: (value: unknown) => parseSettings(unwrap(value)),
  document: (value: unknown) => parseDocument(unwrap(value)),
};
export async function readOrder(id: string) { return parseOrder(unwrap(await adminRequest<unknown>(`orders/${encodeURIComponent(id)}`))); }
export function fulfilmentOptions(order: Pick<Order, "fulfilmentStatus" | "paymentStatus">): string[] {
  if (order.fulfilmentStatus === "awaiting_payment") return order.paymentStatus === "paid" ? ["processing"] : ["cancelled"];
  if (order.fulfilmentStatus === "processing") return order.paymentStatus === "paid" ? ["shipped"] : ["cancelled"];
  if (order.fulfilmentStatus === "shipped") return ["delivered"];
  return [];
}
export async function updateFulfilment(order: Order, body: { fulfilmentStatus: string; tracking?: Order["tracking"] }) {
  return parseOrder(unwrap(await adminRequest<unknown>(`orders/${encodeURIComponent(order.id)}/fulfilment`, { method: "PATCH", version: order.version, body })));
}
export async function readCustomer(id: string) { return parseCustomer(unwrap(await adminRequest<unknown>(`customers/${encodeURIComponent(id)}`))); }
export async function updateCustomer(customer: CustomerRecord, body: { name: string; email: string; phone: string | null; city: string | null }) {
  return parseCustomer(unwrap(await adminRequest<unknown>(`customers/${encodeURIComponent(customer.id)}`, { method: "PATCH", version: customer.version, body })));
}
export async function removeCustomer(customer: CustomerRecord) { await adminRequest(`customers/${encodeURIComponent(customer.id)}`, { method: "DELETE", version: customer.version }); }
export async function moderateReview(review: ReviewRecord, body: { status: "approved" | "rejected"; featured: boolean }) {
  return parseReview(unwrap(await adminRequest<unknown>(`reviews/${encodeURIComponent(review.id)}`, { method: "PATCH", version: review.version, body })));
}
export async function saveDocument(path: string, document: StoreDocument, content: ContentObject) {
  return parseDocument(unwrap(await adminRequest<unknown>(path, { method: "PATCH", version: document.version, body: { content } })));
}
export async function saveSettings(settings: Settings, body: { storeName: string; contact: Settings["contact"] }) {
  return parseSettings(unwrap(await adminRequest<unknown>("settings", { method: "PATCH", version: settings.version, body })));
}
export async function updateStaff(staff: StaffRecord, body: { role: "catalog" | "fulfilment"; status: "active" | "disabled" }) {
  return parseStaffRecord(unwrap(await adminRequest<unknown>(`staff/${encodeURIComponent(staff.id)}`, { method: "PATCH", version: staff.version, body })));
}
export async function inviteStaff(body: { email: string; role: "catalog" | "fulfilment" }) {
  const result = unwrap(await adminRequest<unknown>("staff/invitations", { method: "POST", body }));
  if (!isObject(result) || typeof result.email !== "string" || typeof result.expiresAt !== "string") throw new Error("The API did not return an invitation confirmation. Check the staff list before retrying.");
  return result as { email: string; expiresAt: string };
}
