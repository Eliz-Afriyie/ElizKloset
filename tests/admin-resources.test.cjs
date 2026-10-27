const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const schema = require("../backend-openapi.json");
const load = require("./load-module.cjs");
const api = load("app/admin/lib/resources.ts");
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const money = { amount: 10000, currency: "GHS" };
const order = { id: "order-test", version: 4, reference: "TEST-1", customer: { name: "Test customer", email: "test@example.com", phone: "" }, deliveryAddress: { address: "Test street", city: "Accra", region: "Greater Accra", country: "GH" }, items: [], total: money, subtotal: money, deliveryFee: { ...money, amount: 0 }, paymentStatus: "paid", fulfilmentStatus: "processing" };
const customer = { id: "customer-test", version: 7, name: "Test customer", email: "test@example.com", orderCount: 0, createdAt: "2026-10-26T00:00:00Z" };
const review = { id: "review-test", version: 3, displayName: "Test customer", rating: 4, title: "Review", body: "Test feedback", status: "pending", featured: false };
const settings = { storeName: "Test store", version: 2, contact: { email: null, phone: null, whatsapp: null }, currency: "GHS", timezone: "Africa/Accra", connections: [] };
const staff = { id: "staff-test", version: 6, name: "Test staff", email: "staff@example.com", role: "catalog", status: "active" };

function expectRequest(path, method, version, expectedBody, response) {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/admin/" + path);
    assert.equal(options.method, method);
    assert.equal(options.headers.get("if-match"), version ? `"${version}"` : null);
    if (expectedBody) assert.deepEqual(JSON.parse(options.body), expectedBody);
    return response === undefined ? new Response(null, { status: 204 }) : Response.json({ data: response });
  };
}

test("order fulfilment uses the documented endpoint and snapshot version", async () => {
  const body = { fulfilmentStatus: "shipped", tracking: { carrier: "Test carrier", number: "T1", url: null } };
  expectRequest("orders/order-test/fulfilment", "PATCH", 4, body, { ...order, ...body, version: 5 });
  assert.equal((await api.updateFulfilment(order, body)).version, 5);
  assert.ok(schema.paths["/api/v1/admin/orders/{order_id}/fulfilment"].patch);
});

test("fulfilment options prevent unpaid shipments and backwards transitions", () => {
  assert.equal(api.fulfilmentOptions({ fulfilmentStatus: "awaiting_payment", paymentStatus: "pending" }).join(), "cancelled");
  assert.equal(api.fulfilmentOptions({ fulfilmentStatus: "awaiting_payment", paymentStatus: "paid" }).join(), "processing");
  assert.equal(api.fulfilmentOptions({ fulfilmentStatus: "processing", paymentStatus: "paid" }).join(), "shipped");
  assert.equal(api.fulfilmentOptions({ fulfilmentStatus: "delivered", paymentStatus: "paid" }).length, 0);
});

test("customer updates and deletions are server writes with version preconditions", async () => {
  const body = { name: "Updated customer", email: "test@example.com", phone: null, city: null };
  expectRequest("customers/customer-test", "PATCH", 7, body, { ...customer, ...body, version: 8 });
  assert.equal((await api.updateCustomer(customer, body)).name, body.name);
  expectRequest("customers/customer-test", "DELETE", 7);
  await api.removeCustomer(customer);
});

test("moderation sends status/feature only, never a verification flag", async () => {
  const body = { status: "approved", featured: true };
  expectRequest("reviews/review-test", "PATCH", 3, body, { ...review, ...body, version: 4 });
  assert.equal((await api.moderateReview(review, body)).featured, true);
  assert.deepEqual(Object.keys(body).sort(), Object.keys(schema.components.schemas.AdminReviewUpdateSchema.properties).sort());
});

test("content save preserves nested values and wraps the body as the backend requires", async () => {
  const content = { hero: { title: "Changed title", image: { assetId: "asset-test", alt: "Test image" } }, cards: [], optional: null, enabled: false };
  expectRequest("pages/home", "PATCH", 2, { content }, { content, version: 3 });
  const result = await api.saveDocument("pages/home", { content: {}, version: 2 }, content);
  assert.equal(result.content.hero.image.assetId, "asset-test");
  assert.equal(result.content.enabled, false);
});

test("settings write omits read-only currency and provider state", async () => {
  const body = { storeName: "Updated store", contact: settings.contact };
  expectRequest("settings", "PATCH", 2, body, { ...settings, ...body, version: 3 });
  assert.equal((await api.saveSettings(settings, body)).storeName, "Updated store");
});

test("staff roles and disabling use versioned updates; invitations use their own endpoint", async () => {
  const body = { role: "fulfilment", status: "disabled" };
  expectRequest("staff/staff-test", "PATCH", 6, body, { ...staff, ...body, version: 7 });
  assert.equal((await api.updateStaff(staff, body)).status, "disabled");
  const invite = { email: "invite@example.com", role: "catalog" };
  expectRequest("staff/invitations", "POST", undefined, invite, { ...invite, expiresAt: "2026-10-30T00:00:00Z" });
  assert.equal((await api.inviteStaff(invite)).email, invite.email);
});

test("paginated empty responses stay empty and malformed versions cannot be mutated", () => {
  const empty = api.parsers.customers({ data: [], pagination: { page: 1, pageSize: 8, total: 0, totalPages: 0 } });
  assert.equal(empty.data.length, 0);
  assert.equal(empty.pagination.total, 0);
  assert.throws(() => api.parseCustomer({ ...customer, version: undefined }), /valid record version/);
  assert.throws(() => api.parsers.customers({ data: [], pagination: {} }), /paginated response/);
});

test("backend conflicts reject the save instead of reporting success", async () => {
  globalThis.fetch = async () => Response.json({ error: { message: "Record has changed" } }, { status: 412 });
  await assert.rejects(() => api.updateStaff(staff, { role: "catalog", status: "disabled" }), /Record has changed/);
  await assert.rejects(() => api.saveSettings(settings, { storeName: "Name", contact: settings.contact }), /Record has changed/);
});
