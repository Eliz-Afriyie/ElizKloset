const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const load = require("./load-module.cjs");

const permissions = ["dashboard:read", "catalog:read", "catalog:write", "orders:read", "orders:write", "customers:read", "customers:write", "customers:delete", "content:read", "content:write", "reviews:moderate", "settings:write", "staff:manage"];
const owner = { id: "test-owner", name: "Test owner", email: "owner@example.com", role: "owner", permissions };
let session = { staff: owner, loading: false, sessionError: "", leave: async () => {}, signIn: async () => null, pendingOtp: null, verifyOtp: async () => {}, cancelOtp: () => {} };
let empty = false;
const requested = [];
const money = { amount: 12000, currency: "GHS" };
const customer = { id: "customer-test", version: 1, name: "Backend customer", email: "test@example.com", phone: null, city: "Accra", orderCount: 1, createdAt: "2026-10-26T00:00:00Z", deliveryAddress: null };
const order = { id: "order-test", reference: "BACKEND-ORDER", version: 1, customer: { name: customer.name, email: customer.email, phone: "" }, deliveryAddress: { address: "Street", city: "Accra", region: "Greater Accra", country: "GH" }, items: [], total: money, subtotal: money, deliveryFee: { ...money, amount: 0 }, paymentStatus: "paid", fulfilmentStatus: "processing", createdAt: customer.createdAt };
const review = { id: "review-test", version: 1, displayName: "Backend reviewer", title: "Backend review", body: "Feedback from API", rating: 4, status: "pending", featured: false };
const dashboard = { stats: { paidRevenue: money, paidOrders: 1, orders: 1, catalogStyles: 12, stockAttention: 2 }, sales: [{ date: "2026-10-26", revenue: money, paidOrders: 1 }], orderStatuses: [{ status: "delivered", count: 1 }, { status: "cancelled", count: 0 }], topProducts: [], recentOrders: [order] };
function payload(url) {
  const [resource] = url.split("?");
  const page = (items) => ({ data: empty ? [] : items, pagination: { page: 1, pageSize: 8, total: empty ? 0 : items.length, totalPages: empty ? 0 : 1 } });
  if (resource === "customers") return page([customer]);
  if (resource.startsWith("customers/")) return { data: customer };
  if (resource === "orders") return page([order]);
  if (resource.startsWith("orders/")) return { data: order };
  if (resource === "reviews") return page([review]);
  if (resource === "dashboard") return { data: dashboard };
  if (resource === "staff") return page([{ ...owner, version: 1, status: "active", mfaEnabled: true }, { ...owner, id: "catalog-test", role: "catalog", name: "Backend catalog staff", version: 2, status: "active", mfaEnabled: true }]);
  if (resource === "settings") return { data: { storeName: "Backend business", version: 1, currency: "GHS", timezone: "Africa/Accra", contact: { email: "shop@example.com", phone: null, whatsapp: null }, connections: [{ service: "payments", status: "configured" }] } };
  if (resource.startsWith("pages/") || resource === "site") return { data: { version: 1, content: { title: "Backend page title", enabled: true } } };
  throw new Error("Unexpected UI query: " + url);
}
const overrides = {
  [path.resolve("app/admin/ui/AdminSession.tsx")]: { useAdminSession: () => session },
  [path.resolve("app/admin/lib/useAdminQuery.ts")]: { useAdminQuery: (url, parse) => { if (!url) return { data: null, loading: false, error: "", refresh() {} }; requested.push(url); return { data: parse(payload(url)), loading: false, error: "", refresh() {} }; } },
  "next/navigation": { useRouter: () => ({ push() {}, replace() {} }) },
  "next/link": { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) },
};
const Portal = load("app/admin/ui/AdminPortal.tsx", overrides).default;
const Otp = load("app/admin/ui/AdminOtp.tsx", overrides).default;
const Login = load("app/admin/ui/AdminLogin.tsx", overrides).default;
const Orders = load("app/admin/ui/AdminOrders.tsx", overrides);
const Customers = load("app/admin/ui/LiveAdminCustomers.tsx", overrides).default;
const Settings = load("app/admin/ui/AdminSettings.tsx", overrides).default;
const Reviews = load("app/admin/ui/AdminReviews.tsx", overrides).default;
const Controls = load("app/admin/ui/ApiControls.tsx", overrides);
const render = (component, props = {}) => renderToStaticMarkup(React.createElement(component, props));

test("remaining admin pages render their backend data instead of an integration placeholder", () => {
  session = { ...session, staff: owner };
  for (const [section, expected] of [["orders", "BACKEND-ORDER"], ["customers", "Backend customer"], ["content", "Backend page title"], ["settings", "Backend business"]]) {
    const html = render(Portal, { section });
    assert.ok(html.includes(expected), section + " must show its API result");
    assert.doesNotMatch(html, /Integration pending|Open demo|Sample order|EK-DEMO/);
  }
});

test("empty customer, order and review responses show honest empty states", () => {
  empty = true;
  try {
    assert.match(render(Orders.default), /No orders found/);
    assert.match(render(Customers), /No customers found/);
    assert.match(render(Reviews), /No reviews in this status/);
  } finally { empty = false; }
});

test("staff without customer permission cannot mount or request the customer page", () => {
  session = { ...session, staff: { ...owner, role: "catalog", permissions: ["catalog:read"] } };
  requested.length = 0;
  const html = render(Portal, { section: "customers" });
  assert.match(html, /Access restricted/);
  assert.equal(requested.some((url) => url.startsWith("customers")), false);
  assert.doesNotMatch(html, /href="\/admin\/customers"/);
  session = { ...session, staff: owner };
});

test("order modal exposes fulfilment controls only to permitted staff", () => {
  assert.match(render(Orders.OrderDetails, { id: order.id, onClose() {}, onSaved() {} }), /Update fulfilment/);
  session = { ...session, staff: { ...owner, permissions: ["orders:read"] } };
  assert.doesNotMatch(render(Orders.OrderDetails, { id: order.id, onClose() {}, onSaved() {} }), /Update fulfilment/);
  session = { ...session, staff: owner };
});

test("settings exposes invitations and protects owner role editing", () => {
  const html = render(Settings);
  assert.match(html, /Invite staff/);
  assert.match(html, /Owner managed/);
  assert.match(html, /Backend catalog staff/);
  assert.equal((html.match(/>Edit access</g) ?? []).length, 1);
});

test("login requires a staff account and no longer offers a demo entry", () => {
  session = { ...session, staff: null };
  const html = render(Login);
  assert.match(html, /Work email/);
  assert.doesNotMatch(html, /Open demo|explore the design|sample data/i);
  session = { ...session, staff: owner };
});

test("mock admin modules and sample records are removed from runtime sources", () => {
  for (const filename of ["mock-data.ts", "AdminOverview.tsx", "AdminCollections.tsx", "AdminCustomers.tsx"]) assert.equal(fs.existsSync(path.join("app/admin/ui", filename)), false);
  const source = fs.readdirSync("app/admin/ui").filter((file) => /\.tsx?$/.test(file)).map((file) => fs.readFileSync(path.join("app/admin/ui", file), "utf8")).join("\n");
  assert.doesNotMatch(source, /EK-DEMO|Open demo workspace|useAdminCatalog|Preview records and presets/);
});

test("lookup pagination and retry controls cannot accidentally submit a content form", () => {
  const pagination = render(Controls.ApiPagination, { page: 1, total: 16, totalPages: 2, loading: false, onChange() {} });
  const retry = render(Controls.ApiStatus, { loading: false, error: "Retry needed", retry() {} });
  assert.equal((pagination.match(/type="button"/g) ?? []).length, 2);
  assert.match(retry, /type="button"/);
});

test("reference-style dashboard uses backend metrics and an accessible collapsible navigation", () => {
  const html = render(Portal, { section: "dashboard" });
  assert.match(html, /Collapse sidebar/);
  assert.match(html, /aria-controls="admin-navigation"/);
  assert.match(html, /Your sales report/);
  assert.match(html, /BACKEND-ORDER/);
  assert.match(html, /Total products/);
  assert.match(html, /Use left and right arrow keys/);
  assert.doesNotMatch(html, /Shopee|Tokopedia|Congratulations|\+2\.5%|demo|sample records/i);
});


test("OTP screen is a dedicated second step with no password or email input", () => {
  session = { ...session, staff: null, pendingOtp: { challengeId: "test-challenge-1234567890", email: "test@example.com", expiresAt: new Date(Date.now() + 300000).toISOString() } };
  const html = render(Otp);
  assert.match(html, /STEP 2 OF 2/); assert.match(html, /Verify your sign-in/);
  assert.match(html, /autoComplete="one-time-code"/i); assert.match(html, /name="code"/);
  assert.doesNotMatch(html, /name="password"|name="email"/);
  session = { ...session, staff: owner, pendingOtp: null };
});

test("opening verification without a pending challenge cannot submit a code", () => {
  session = { ...session, staff: null, pendingOtp: null };
  const html = render(Otp);
  assert.match(html, /no active verification request/); assert.doesNotMatch(html, /name="code"/);
  session = { ...session, staff: owner, pendingOtp: null };
});
