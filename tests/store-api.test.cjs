const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { NextRequest } = require("next/server");
const load = require("./load-module.cjs");
const proxy = load("app/api/store/[...path]/route.ts");
const catalog = load("app/lib/store-catalog.ts");
const shopping = load("app/lib/catalog.ts");
const { parseCustomerUser } = load("app/lib/customer-session.ts");
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const context = (path) => ({ params: Promise.resolve({ path: path.split("/") }) });
test("store proxy rejects foreign writes, traversal and privileged customer/admin routes", async () => {
  globalThis.fetch = () => { throw Error("Must not fetch"); };
  for (const path of ["users/", "admin/products", "products/../staff", "auth/refresh"]) {
    const r = await proxy.GET(new NextRequest("https://shop.example/api/store/" + path), context(path));
    assert.equal(r.status, 404);
  }
  const r = await proxy.POST(new NextRequest("https://shop.example/api/store/contact/messages", { method: "POST", headers: { Origin: "https://foreign.example" }, body: "{}" }), context("contact/messages"));
  assert.equal(r.status, 403);
});
test("public filters pass through without leaking admin cookies or tokens", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://elizkloset.onrender.com/api/v1/products?category=dresses&maxPrice=22000&cursor=next");
    assert.equal(options.headers.get("authorization"), null);
    assert.equal(options.headers.get("cookie"), null);
    assert.equal(options.cache, "no-store");
    return Response.json({ data: [] });
  };
  const r = await proxy.GET(new NextRequest("https://shop.example/api/store/products?category=dresses&maxPrice=22000&cursor=next", { headers: { Cookie: "ek_admin_access=private-admin; ek_customer_access=customer" } }), context("products"));
  assert.equal(r.status, 200); assert.equal(r.headers.get("cache-control"), "no-store");
});
test("customer login uses documented form fields and isolates tokens in HttpOnly cookies", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://elizkloset.onrender.com/auth/token");
    assert.equal(options.headers.get("content-type"), "application/x-www-form-urlencoded");
    assert.equal(new URLSearchParams(options.body).get("username"), "customer@example.com");
    assert.equal(new URLSearchParams(options.body).get("password"), "fake-password");
    return Response.json({ access_token: "customer-private-token", refresh_token: "private-refresh" }, { headers: { "Set-Cookie": "session=customer-session; Domain=api.example; Path=/; Secure; HttpOnly" } });
  };
  const r = await proxy.POST(new NextRequest("https://shop.example/api/store/auth/sign-in", { method: "POST", headers: { Origin: "https://shop.example", "Content-Type": "application/json" }, body: JSON.stringify({ email: "customer@example.com", password: "fake-password" }) }), context("auth/sign-in"));
  assert.doesNotMatch(await r.text(), /customer-private-token|private-refresh/);
  const cookies = r.headers.getSetCookie();
  assert.ok(cookies.some((cookie) => cookie.includes("ek_customer_access=customer-private-token") && cookie.includes("HttpOnly") && cookie.includes("Path=/api/store")));
  assert.ok(cookies.some((cookie) => cookie.includes("ek_customer_backend_session=") && !cookie.includes("Domain=")));
});
test("session restoration sends only the customer token in the documented body", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://elizkloset.onrender.com/auth/me");
    assert.equal(options.method, "POST"); assert.equal(JSON.parse(options.body).access_token, "customer");
    assert.equal(options.headers.get("cookie"), "session=user");
    return Response.json({ id: "user-1", email: "customer@example.com" });
  };
  const r = await proxy.GET(new NextRequest("https://shop.example/api/store/auth/me", { headers: { Cookie: "ek_customer_access=customer; ek_customer_backend_session=user; ek_admin_access=admin; staff_session=staff" } }), context("auth/me"));
  assert.equal(r.status, 200);
});
test("registration, OTP, password reset and contact requests map to customer endpoints", async () => {
  const cases = [["auth/register", "/api/v1/users/", "POST"], ["auth/verify-otp", "/api/v1/users/verify-otp", "POST"], ["auth/verify-phone-otp", "/api/v1/users/verify-phone-otp", "POST"], ["auth/reset-password", "/api/v1/users/reset_password", "PUT"], ["contact/messages", "/api/v1/contact/messages", "POST"], ["newsletter/subscriptions", "/api/v1/newsletter/subscriptions", "POST"]];
  for (const [path, upstream, method] of cases) {
    globalThis.fetch = async (url, options) => { assert.equal(url, "https://elizkloset.onrender.com" + upstream); assert.equal(options.method, method); assert.equal(JSON.parse(options.body).target, "customer@example.com"); return Response.json({}); };
    const r = await proxy.POST(new NextRequest("https://shop.example/api/store/" + path, { method: "POST", headers: { Origin: "https://shop.example" }, body: '{"target":"customer@example.com"}' }), context(path));
    assert.equal(r.status, 200);
  }
});
test("backend failures remain failures and exception details are not exposed", async () => {
  globalThis.fetch = async () => Response.json({ error: { message: "Storage unavailable", requestId: "request-1" } }, { status: 503 });
  let r = await proxy.GET(new NextRequest("https://shop.example/api/store/products"), context("products"));
  assert.equal(r.status, 503); assert.equal((await r.json()).error.requestId, "request-1");
  globalThis.fetch = async () => { throw Error("private connection information"); };
  r = await proxy.GET(new NextRequest("https://shop.example/api/store/products"), context("products"));
  assert.equal(r.status, 502); assert.doesNotMatch(await r.text(), /private connection/);
});

test("profile edits use the verified customer ID and discard client-supplied roles or IDs", async () => {
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    if (calls === 1) { assert.equal(url, "https://elizkloset.onrender.com/auth/me"); return Response.json({ data: { id: "own-user", email: "customer@example.com" } }); }
    assert.equal(url, "https://elizkloset.onrender.com/api/v1/users/own-user"); assert.equal(options.method, "PUT");
    const fields = JSON.parse(options.body); assert.equal(fields.id, undefined); assert.equal(fields.role, undefined); assert.equal(fields.email, "customer@example.com");
    return Response.json({});
  };
  const r = await proxy.POST(new NextRequest("https://shop.example/api/store/auth/profile", { method: "POST", headers: { Origin: "https://shop.example", Cookie: "ek_customer_access=customer" }, body: JSON.stringify({ id: "another-user", role: "admin", email: "customer@example.com", first_name: "Customer", last_name: "Test", phone: "" }) }), context("auth/profile"));
  assert.equal(r.status, 200); assert.equal(calls, 2);
});
const product = { id: "product-1", slug: "office-dress", name: "Office dress", description: "A dress", price: { amount: 16000, currency: "GHS" }, category: { name: "Dresses" }, images: [{ id: "asset-1", url: "/images/hero-burgundy.png" }], colors: [{ id: "wine", name: "Burgundy", hex: "#750d27", imageIds: ["asset-1"] }], variants: [{ id: "variant-1", colorId: "wine", size: "M", inStock: true }, { id: "variant-2", colorId: "wine", size: "L", inStock: false }], badges: [] };
test("product mapping converts pesewas, preserves string sizes and real variant availability", () => {
  const parsed = catalog.parseProduct(product);
  assert.equal(parsed.price, 160); assert.equal(parsed.apiId, "product-1"); assert.equal(parsed.id, "office-dress");
  assert.deepEqual(Array.from(parsed.availableSizes), ["M"]); assert.equal(parsed.bestSeller, false); assert.equal(parsed.isNew, false);
  assert.equal(parsed.colors[0].image, "/images/hero-burgundy.png");
  assert.throws(() => catalog.parseProduct({ ...product, price: { amount: 160, currency: "USD" } }), /unsupported/);
});
test("empty API data stays empty and broken pagination is rejected", () => {
  const page = catalog.parseProductPage({ data: [], pagination: { total: 0, nextCursor: null, hasMore: false }, facets: {} });
  assert.equal(page.data.length, 0);
  assert.throws(() => catalog.parseProductPage({ data: [], pagination: { total: 1, nextCursor: null, hasMore: true } }), /pagination/);
});
test("device selections accept API slugs and string sizes without storing catalog prices", () => {
  const state = shopping.readShoppingState(JSON.stringify({ cart: [{ productId: "new-api-product", size: "M", color: "Burgundy", quantity: 2 }, { productId: "bad", size: "M", color: "Burgundy", quantity: -1 }], wishlist: ["new-api-product", "new-api-product", null] }));
  assert.equal(state.cart.length, 1); assert.equal(state.cart[0].productId, "new-api-product"); assert.equal(state.wishlist.length, 1);
});

test("customer greetings accept backend name conventions and never render an empty identity", () => {
  assert.equal(parseCustomerUser({ data: { id: "user-1", email: "customer@example.com", firstName: "Customer", lastName: "Example" } }).display_name, "Customer Example");
  assert.equal(parseCustomerUser({ user: { id: "user-1", email: "customer@example.com", first_name: "Customer" } }).first_name, "Customer");
  assert.equal(parseCustomerUser({ id: "user-1", email: "customer@example.com" }).display_name, "customer");
  assert.throws(() => parseCustomerUser({ id: "user-1", first_name: "Missing contact" }), /unsupported profile/);
});

test("full profile reads use the verified account ID and omit password/OTP/internal fields", async () => {
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    if (calls === 1) { assert.equal(url, "https://elizkloset.onrender.com/auth/me"); assert.equal(JSON.parse(options.body).access_token, "customer"); return Response.json({ id: "own-user", email: "customer@example.com" }); }
    assert.equal(url, "https://elizkloset.onrender.com/api/v1/users/own-user"); assert.equal(options.method, "GET"); assert.equal(options.body, undefined);
    return Response.json({ id: "own-user", email: "customer@example.com", first_name: "Customer", last_name: "Example", phone: "+233200000000", password: "private-password-hash", otp_verifications: ["private-code"], failed_login_attempts: 2 });
  };
  const r = await proxy.GET(new NextRequest("https://shop.example/api/store/auth/profile?id=another-user", { headers: { Cookie: "ek_customer_access=customer" } }), context("auth/profile"));
  assert.equal(r.status, 200); const data = await r.json(); assert.equal(data.data.first_name, "Customer"); assert.equal(data.data.phone, "+233200000000");
  assert.doesNotMatch(JSON.stringify(data), /password|otp_verifications|private-code|failed_login/);
});

test("profile reads reject unsigned callers and mismatched backend identities", async () => {
  globalThis.fetch = () => { throw Error("Must not fetch"); };
  const unsigned = await proxy.GET(new NextRequest("https://shop.example/api/store/auth/profile"), context("auth/profile")); assert.equal(unsigned.status, 401);
  let calls = 0;
  globalThis.fetch = async () => Response.json(++calls === 1 ? { id: "own-user", email: "customer@example.com" } : { id: "other-user", email: "other@example.com", first_name: "Other customer" });
  const r = await proxy.GET(new NextRequest("https://shop.example/api/store/auth/profile", { headers: { Cookie: "ek_customer_access=customer" } }), context("auth/profile"));
  assert.equal(r.status, 502); assert.doesNotMatch(await r.text(), /other@example|Other customer/);
});

test("sign-out clears proxy cookies when the backend session has already expired", async () => {
  globalThis.fetch = async () => Response.json({ error: { message: "Expired" } }, { status: 401 });
  const r = await proxy.POST(new NextRequest("https://shop.example/api/store/auth/sign-out", { method: "POST", headers: { Origin: "https://shop.example", Cookie: "ek_customer_access=expired; ek_customer_backend_session=expired" }, body: "{}" }), context("auth/sign-out"));
  assert.equal(r.status, 401); assert.ok(r.headers.getSetCookie().some((cookie) => cookie.includes("ek_customer_access=") && cookie.includes("Max-Age=0")));
});
