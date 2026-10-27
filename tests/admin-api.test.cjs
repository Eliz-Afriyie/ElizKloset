const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const load = require("./load-module.cjs");
const { NextRequest } = require("next/server");

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const proxy = load("app/api/admin/[...path]/route.ts");
const client = load("app/admin/lib/api.ts");
const products = load("app/admin/lib/products.ts");
const context = (segments) => ({ params: Promise.resolve({ path: segments }) });

test("proxy rejects foreign-origin writes before contacting the backend", async () => {
  globalThis.fetch = () => { throw new Error("Must not contact backend"); };
  const response = await proxy.POST(new NextRequest("https://store.example/api/admin/products", { method: "POST", headers: { Origin: "https://other.example" } }), context(["products"]));
  assert.equal(response.status, 403);
});

test("proxy rejects path traversal and unknown endpoint groups", async () => {
  for (const segments of [["products", ".."], ["products", "x/y"], ["other"]]) {
    const response = await proxy.GET(new NextRequest("https://store.example/api/admin/products"), context(segments));
    assert.equal(response.status, 404);
  }
});

test("proxy preserves API prefix, filters, version header and multipart body", async () => {
  const file = new FormData(); file.set("file", new Blob(["image"]), "photo.webp");
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://elizkloset.onrender.com/api/v1/admin/assets?alt=blue");
    assert.equal(options.headers.get("if-match"), '"4"');
    assert.match(options.headers.get("content-type"), /^multipart\/form-data; boundary=/);
    assert.ok(options.body.byteLength > 0);
    assert.equal(options.cache, "no-store");
    return Response.json({ data: { id: "asset-1" } }, { status: 201 });
  };
  const request = new NextRequest("https://store.example/api/admin/assets?alt=blue", { method: "POST", body: file, headers: { Origin: "https://store.example", "If-Match": '"4"' } });
  const response = await proxy.POST(request, context(["assets"]));
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("login stores bearer credentials in HttpOnly cookies and strips them from JSON", async () => {
  globalThis.fetch = async () => Response.json({ data: { access_token: "private-token", refresh_token: "private-refresh", status: "authenticated" } }, { headers: { "Set-Cookie": "staff_session=test; Domain=backend.example; Path=/api/v1/admin; Secure; HttpOnly" } });
  const response = await proxy.POST(new NextRequest("https://store.example/api/admin/auth/sign-in", { method: "POST", headers: { Origin: "https://store.example" }, body: "{}" }), context(["auth", "sign-in"]));
  const payload = await response.json();
  assert.equal(payload.data.access_token, undefined);
  assert.equal(payload.data.refresh_token, undefined);
  assert.ok(response.headers.getSetCookie().some((cookie) => cookie.includes("ek_admin_access=private-token") && cookie.includes("HttpOnly")));
  const backendCookie = response.headers.getSetCookie().find((cookie) => cookie.startsWith("staff_session="));
  assert.match(backendCookie, /Path=\/api\/admin/);
  assert.doesNotMatch(backendCookie, /Domain=/);
});

test("stored bearer credentials are sent upstream without forwarding the private proxy cookie", async () => {
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.get("authorization"), "Bearer token");
    assert.equal(options.headers.get("cookie"), "staff_session=abc");
    return Response.json({ data: {} });
  };
  await proxy.GET(new NextRequest("https://store.example/api/admin/auth/me", { headers: { Cookie: "ek_admin_access=token; staff_session=abc" } }), context(["auth", "me"]));
});

test("upstream failures become a retryable error without leaking exception details", async () => {
  globalThis.fetch = async () => { throw new Error("secret connection info"); };
  const response = await proxy.GET(new NextRequest("https://store.example/api/admin/auth/me"), context(["auth", "me"]));
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /secret connection info/);
});

test("same-origin category creation echoes the backend CSRF cookie", async () => {
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.get("x-csrf-token"), "backend-csrf");
    assert.equal(options.headers.get("cookie"), "admin_session=session; admin_csrf=backend-csrf");
    return Response.json({ data: { id: "category-1" } }, { status: 201 });
  };
  const response = await proxy.POST(new NextRequest("https://store.example/api/admin/categories", { method: "POST", headers: { Origin: "https://store.example", Cookie: "admin_session=session; admin_csrf=backend-csrf" }, body: '{"name":"Two Piece"}' }), context(["categories"]));
  assert.equal(response.status, 201);
});

test("login CSRF responses are retained privately and forwarded on writes", async () => {
  globalThis.fetch = async () => Response.json({ data: { csrfToken: "rotated-csrf", status: "authenticated" } });
  const login = await proxy.POST(new NextRequest("https://store.example/api/admin/auth/mfa", { method: "POST", headers: { Origin: "https://store.example" }, body: "{}" }), context(["auth", "mfa"]));
  assert.ok(login.headers.getSetCookie().some((cookie) => cookie.includes("ek_proxy_csrf=rotated-csrf") && cookie.includes("HttpOnly")));
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.get("x-csrf-token"), "rotated-csrf");
    assert.equal(options.headers.get("cookie"), "admin_session=session");
    return Response.json({});
  };
  await proxy.POST(new NextRequest("https://store.example/api/admin/categories", { method: "POST", headers: { Origin: "https://store.example", Cookie: "admin_session=session; ek_proxy_csrf=rotated-csrf" }, body: "{}" }), context(["categories"]));
});

test("explicit CSRF tokens survive forwarding and foreign origins cannot use cookie tokens", async () => {
  let calls = 0;
  globalThis.fetch = async (_url, options) => { calls++; assert.equal(options.headers.get("x-csrf-token"), "explicit"); return Response.json({}); };
  for (const origin of ["https://store.example", "https://foreign.example"]) {
    const response = await proxy.POST(new NextRequest("https://store.example/api/admin/categories", { method: "POST", headers: { Origin: origin, Cookie: "admin_csrf=cookie-token", "X-CSRF-Token": "explicit" }, body: "{}" }), context(["categories"]));
    assert.equal(response.status, origin === "https://store.example" ? 200 : 403);
  }
  assert.equal(calls, 1);
});

test("client handles 204, field validation, and stale version failures", async () => {
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await client.adminRequest("products/1", { method: "DELETE", version: 2 }), undefined);
  globalThis.fetch = async () => Response.json({ detail: [{ loc: ["body", "variants", 0, "stock"], msg: "Must be positive" }] }, { status: 422 });
  await assert.rejects(() => client.adminRequest("products"), /variants.0.stock: Must be positive/);
  globalThis.fetch = async () => Response.json({}, { status: 412 });
  await assert.rejects(() => client.adminRequest("products/1"), /record changed/);
  globalThis.fetch = async () => Response.json({ error: { message: "Image storage unavailable.", requestId: "storage-request-1" } }, { status: 503 });
  await assert.rejects(() => client.adminRequest("assets", { method: "POST", body: new FormData() }), /Image storage unavailable\. Reference: storage-request-1\./);
});

test("proxy distinguishes a backend timeout from a connection failure", async () => {
  globalThis.fetch = async () => { const error = new Error("private timeout details"); error.name = "TimeoutError"; throw error; };
  const response = await proxy.GET(new NextRequest("https://store.example/api/admin/auth/me"), context(["auth", "me"]));
  assert.equal(response.status, 504);
  const payload = await response.json();
  assert.equal(payload.error.code, "UPSTREAM_TIMEOUT");
  assert.doesNotMatch(JSON.stringify(payload), /private timeout/);
});

test("malformed successful login responses do not become connection errors", async () => {
  for (const body of ["<html>Unavailable</html>", "null", '"invalid"']) {
    globalThis.fetch = async () => new Response(body, { status: 200 });
    const response = await proxy.POST(new NextRequest("https://store.example/api/admin/auth/sign-in", { method: "POST", headers: { Origin: "https://store.example" }, body: "{}" }), context(["auth", "sign-in"]));
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error.code, "UPSTREAM_INVALID_RESPONSE");
  }
});

const record = {
  id: "product-1", name: "Dress", description: "Blue dress", createdAt: "2026-10-26T00:00:00Z", version: 3,
  price: { amount: 16000, currency: "GHS" }, status: "active", category: { id: "category-1" }, collections: [],
  images: [{ id: "asset-1", url: "https://cdn.example/blue.webp" }],
  colors: [{ id: "blue", name: "Blue", hex: "#123456", imageIds: ["asset-1"] }],
  variants: [{ id: "variant-1", colorId: "blue", size: "10", stock: 5, availableStock: 3 }], stock: 5, availableStock: 3,
};

test("product adapter distinguishes available inventory from physical stock", () => {
  const value = products.toProduct(record);
  assert.equal(value.price, 160);
  assert.equal(value.stock, 3);
  assert.equal(value.variants[0].sizes[0].stock, 5);
  assert.equal(value.apiSource.version, 3);
  assert.throws(() => products.toProduct({ id: "bad" }), /response/);
});

test("product update keeps variant and asset IDs, converts pesewas, and sends If-Match", async () => {
  const product = products.toProduct(record);
  product.price = 220;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/admin/products/product-1");
    assert.equal(options.method, "PATCH");
    assert.equal(options.headers.get("if-match"), '"3"');
    const body = JSON.parse(options.body);
    assert.equal(body.price.amount, 22000);
    assert.equal(body.variants[0].id, "variant-1");
    assert.equal(body.variants[0].stock, 5);
    assert.deepEqual(body.imageIds, ["asset-1"]);
    return Response.json({ data: { ...record, price: body.price, version: 4 } });
  };
  const updated = await products.saveProduct(product, product);
  assert.equal(updated.apiSource.version, 4);
});

test("unrecognized staff profiles cannot unlock the live workspace", () => {
  assert.throws(() => client.parseStaff({ data: { email: "staff@example.com" } }), /unsupported staff profile/);
});
