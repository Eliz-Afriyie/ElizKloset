const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const load = require("./load-module.cjs");
const schema = require("../backend-openapi.json");
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
    assert.equal(url, "https://elizkloset-docker.onrender.com/api/v1/admin/assets?alt=blue");
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

test("validation errors retain field details and do not promise nonexistent highlights", async () => {
  globalThis.fetch = async () => Response.json({ error: { code: "VALIDATION_ERROR", message: "Please check the highlighted fields.", fields: { status: ["Field required"] }, requestId: "validation-1" } }, { status: 422 });
  await assert.rejects(() => client.adminRequest("products"), (error) => {
    assert.equal(error.fields.status[0], "Field required");
    assert.match(error.message, /Reference: validation-1/);
    return true;
  });
  globalThis.fetch = async () => Response.json({ error: { message: "Please check the highlighted fields." } }, { status: 422 });
  await assert.rejects(() => client.adminRequest("products"), (error) => {
    assert.doesNotMatch(error.message, /highlighted/);
    assert.match(error.message, /did not identify a field/);
    return true;
  });
  globalThis.fetch = async () => Response.json({ detail: [{ loc: ["body", "price_amount"], msg: "Must be positive" }] }, { status: 422 });
  await assert.rejects(() => client.adminRequest("products"), (error) => error.fields.price_amount[0] === "Must be positive");
});

test("a rejected operation requests session verification instead of immediate logout", async () => {
  const events = [];
  const checkedClient = load("app/admin/lib/api.ts", {}, { window: { dispatchEvent: (event) => events.push(event.type) } });
  globalThis.fetch = async () => Response.json({ error: { message: "Upload rejected." } }, { status: 401 });
  await assert.rejects(() => checkedClient.adminRequest("categories", { method: "POST", body: new FormData() }), /Upload rejected/);
  assert.deepEqual(events, ["admin-session-check"]);
  events.length = 0;
  await assert.rejects(() => checkedClient.adminRequest("auth/me"), /Upload rejected/);
  assert.equal(events.length, 0);
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
  price: { amount: 160, currency: "GHS" }, status: "active", category: { id: "category-1" }, collections: [],
  images: [{ id: "asset-1", url: "https://cdn.example/blue.webp" }],
  colors: [{ id: "blue", name: "Blue", hex: "#123456", imageIds: ["asset-1"] }],
  variants: [{ id: "variant-1", colorId: "blue", size: "10", stock: 5, availableStock: 3 }], stock: 5, availableStock: 3,
};

test("API product prices remain in GHS and image_url takes precedence", async () => {
  const input = { ...record, image_url: "https://storage.googleapis.com/example/kaftan.jpg", price: { amount: 700, currency: "GHS", discountAmount: 600 } };
  const product = products.toProduct(input);
  assert.equal(product.price, 700);
  assert.equal(product.discount, 600);
  assert.equal(product.image, input.image_url);
  assert.equal(products.toProduct({ ...input, images: [] }).image, input.image_url);
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/admin/products/product-1");
    const body = JSON.parse(options.body);
    assert.equal(body.price.amount, 700);
    assert.equal(body.discountAmount, 600);
    return Response.json({ data: { ...input, price: { ...body.price, discountAmount: body.discountAmount } } });
  };
  assert.equal((await products.saveProduct(product, product)).price, 700);
});

test("admin products accept a paginated response without optional stock summary", () => {
  const page = { data: [record], pagination: { page: 1, pageSize: 8, total: 4, totalPages: 1 } };
  const parsed = products.parseProductPage(page);
  assert.equal(parsed.data[0].id, record.id);
  assert.equal(parsed.pagination.total, 4);
  assert.equal(parsed.summary, undefined);
  const empty = products.parseProductPage({ data: [], pagination: { page: 1, pageSize: 8, total: 0, totalPages: 0 } });
  assert.equal(empty.data.length, 0);
  const summary = { all: 4, outOfStock: 1, lowStock: 2 };
  assert.equal(products.parseProductPage({ ...page, summary }).summary, summary);
});

test("admin product lists still reject malformed pagination, records and stock totals", () => {
  const pagination = { page: 1, pageSize: 8, total: 4, totalPages: 1 };
  for (const value of [null, {}, { data: [], pagination: { ...pagination, total: "4" } }, { data: [], pagination: { ...pagination, pageSize: 0 } }]) {
    assert.throws(() => products.parseProductPage(value), /Unsupported product list/);
  }
  assert.throws(() => products.parseProductPage({ data: [{ ...record, version: undefined }], pagination }), /documented catalog shape/);
  assert.throws(() => products.parseProductPage({ data: [], pagination, summary: { all: 4 } }), /Unsupported stock totals/);
});

test("product adapter distinguishes available inventory from physical stock", () => {
  const value = products.toProduct(record);
  assert.equal(value.price, 160);
  assert.equal(value.stock, 3);
  assert.equal(value.variants[0].sizes[0].stock, 5);
  assert.equal(value.apiSource.version, 3);
  assert.throws(() => products.toProduct({ id: "bad" }), /response/);
});

test("product update keeps variant and asset IDs, preserves GHS amounts, and sends If-Match", async () => {
  const product = products.toProduct(record);
  product.price = 220;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/admin/products/product-1");
    assert.equal(options.method, "PATCH");
    assert.equal(options.headers.get("if-match"), '"3"');
    const body = JSON.parse(options.body);
    assert.equal(body.price.amount, 220);
    assert.equal(body.variants[0].id, "variant-1");
    assert.equal(body.variants[0].stock, 5);
    assert.deepEqual(body.imageIds, ["asset-1"]);
    return Response.json({ data: { ...record, price: body.price, version: 4 } });
  };
  const updated = await products.saveProduct(product, product);
  assert.equal(updated.apiSource.version, 4);
});

test("product create uses current multipart fields, then assigns collections by versioned PATCH", async () => {
  const product = products.toProduct(record);
  const image = "data:image/png;base64,Y292ZXI=";
  product.image = image; product.variants[0].image = ""; product.collectionIds = ["collection-1", "collection-2"];
  let creates=0, finishes=0;
  globalThis.fetch = async (url, options) => {
    if (url === image) return new Response(new Blob(["cover"], {type:"image/png"}));
    if (options.method === "PATCH") {
      finishes++; assert.equal(url,"/api/admin/products/product-1");assert.equal(options.headers.get("if-match"),'"1"');
      const body=JSON.parse(options.body);assert.deepEqual(body.collectionIds,product.collectionIds);assert.deepEqual(body.imageIds,["asset-1"]);assert.equal(body.status,"active");
      return Response.json({data:{...record,collections:body.collectionIds,version:2}});
    }
    creates++;assert.equal(url,"/api/admin/products");assert.equal(options.headers.has("content-type"),false);
    const form=options.body;assert.ok(form instanceof FormData);
    const allowed=new Set(Object.keys(schema.components.schemas.Body_create_admin_product_api_v1_admin_products_post.properties));
    for(const key of form.keys())assert.ok(allowed.has(key),'Unexpected create field: '+key);
    assert.equal(form.get("price_amount"),"160");assert.equal(form.get("price_currency"),"GHS");assert.equal(form.get("category_id"),"category-1");assert.equal(form.get("status"),"draft");
    assert.equal(JSON.parse(form.get("colors")).name,"Blue");assert.deepEqual(JSON.parse(form.get("variants")),{colorId:"blue",size:"10",stock:5});
    assert.equal(await form.get("product_images").text(),"cover");assert.equal(form.get("product_images").type,"image/png");
    return Response.json({data:{...record,version:1,status:"draft",collections:[]}}, {status:201});
  };
  const saved=await products.saveProduct(product);assert.equal(creates,1);assert.equal(finishes,1);assert.equal(saved.status,"active");
});

test("product creation links an uploaded colour photo through PATCH without duplicate uploads", async () => {
  const product=products.toProduct(record);const image="data:image/png;base64,Y29sb3Vy";product.image=image;product.variants[0].image=image;
  let uploads=0,creates=0,finishes=0;
  globalThis.fetch=async(url,options)=>{
    if(url===image)return new Response(new Blob(["colour"],{type:"image/png"}));
    if(url==="/api/admin/assets"){uploads++;return Response.json({data:{id:"new-colour-asset",url:"https://cdn.example/new.png"}});}
    if(options.method==="PATCH"){
      finishes++;const body=JSON.parse(options.body);assert.deepEqual(body.imageIds,["new-colour-asset"]);assert.deepEqual(body.colors[0].imageIds,["new-colour-asset"]);
      return Response.json({data:{...record,images:[{id:"new-colour-asset",url:"https://cdn.example/new.png"}],colors:body.colors,version:2}});
    }
    creates++;assert.equal(url,"/api/admin/products");assert.ok(options.body instanceof FormData);assert.equal(options.body.has("file"),false);assert.equal(options.body.has("image_ids"),false);assert.equal(options.body.has("product_images"),false);assert.deepEqual(JSON.parse(options.body.get("colors")).imageIds,[]);
    return Response.json({data:{...record,status:"draft",version:1,images:[],colors:record.colors.map(c=>({...c,imageIds:[]}))}},{status:201});
  };
  await products.saveProduct(product);assert.equal(uploads,1);assert.equal(creates,1);assert.equal(finishes,1);
});

test("failed product completion keeps the created draft for retry without duplicate creation", async () => {
  const product=products.toProduct(record);product.image="";product.variants[0].image="";product.collectionIds=["collection-retry"];
  let creates=0,patches=0,partial;
  const draft={...record,status:"draft",version:1,images:[],collections:[],colors:record.colors.map(c=>({...c,imageIds:[]}))};
  globalThis.fetch=async(url,options)=>{
    if(options.method==="POST"){creates++;return Response.json({data:draft},{status:201});}
    patches++;assert.equal(url,"/api/admin/products/product-1");assert.equal(options.headers.get("if-match"),'"1"');
    if(patches===1)return Response.json({error:{message:"Temporary update failure."}},{status:503});
    return Response.json({data:{...draft,status:"active",version:2,collections:product.collectionIds}});
  };
  await assert.rejects(()=>products.saveProduct(product),error=>{assert.ok(error instanceof products.ProductCompletionError);partial=error.product;assert.equal(partial.status,"draft");return true;});
  await products.saveProduct(product,partial);assert.equal(creates,1);assert.equal(patches,2);
});

test("unrecognized staff profiles cannot unlock the live workspace", () => {
  assert.throws(() => client.parseStaff({ data: { email: "staff@example.com" } }), /unsupported staff profile/);
});

 test("product validation identifies the exact nested field without exposing its value", () => {
  for (const [group, field, value] of [["images", "url", null], ["colors", "imageIds", undefined], ["variants", "size", 10], ["variants", "stock", "private-value"]]) {
    const changed = { ...record, [group]: [{ ...record[group][0], [field]: value }] };
    assert.throws(() => products.toProduct(changed), error => error.message.includes(group + "[0]." + field) && error.message.includes(record.id) && !error.message.includes("private-value"));
  }
  assert.throws(() => products.toProduct({ ...record, images: [null] }), /images\[0\].id/);
});

test("products with unassigned inventory colours load without inventing colour links", async () => {
  const input = { ...record, variants: record.variants.map(variant => ({ ...variant, colorId: null })) };
  const parsed = products.parseProductPage({ data: [input], pagination: { page: 1, pageSize: 8, total: 1, totalPages: 1 } });
  const product = products.toProduct(parsed.data[0]);
  assert.equal(product.stock, 3);
  assert.deepEqual(Array.from(product.sizes), ["10"]);
  assert.equal(product.apiSource.variants[0].colorId, null);
  assert.equal(product.variants[0].sizes.length, 0);
  globalThis.fetch = () => { throw Error("Must not write broken colour links"); };
  await assert.rejects(products.saveProduct(product, product), /without a colour assignment/);
});

test("stock cards derive complete-catalog totals and use filtered counts for partial pages", async () => {
  const page = { data: [record, { ...record, id: "out", availableStock: 0 }, { ...record, id: "normal", availableStock: 4 }], pagination: { page: 1, pageSize: 8, total: 3, totalPages: 1 } };
  let summary = await products.productStockSummary(page, new URLSearchParams());
  assert.deepEqual(JSON.parse(JSON.stringify(summary)), { all: 3, outOfStock: 1, lowStock: 1 });
  const requests = [];
  globalThis.fetch = async url => {
    const params = new URL(url, "https://example.com").searchParams;
    requests.push(params.get("stock") || "all");
    assert.equal(params.get("categoryId"), "dresses"); assert.equal(params.get("page"), "1");
    const total = params.get("stock") === "out" ? 3 : params.get("stock") === "low" ? 5 : 20;
    return Response.json({ data: [], pagination: { page: 1, pageSize: 1, total, totalPages: total } });
  };
  summary = await products.productStockSummary({ ...page, data: [record], pagination: { ...page.pagination, total: 20 } }, new URLSearchParams("page=2&stock=low&categoryId=dresses"));
  assert.deepEqual(JSON.parse(JSON.stringify(summary)), { all: 20, outOfStock: 3, lowStock: 5 });
  assert.equal(requests.length, 3);
});

test("discounts save in GHS and can be removed on update", async () => {
  const product = { ...products.toProduct(record), discount: 20 };
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.discountAmount, 20);
    return Response.json({ data: { ...record, price: { ...record.price, discountAmount: body.discountAmount } } });
  };
  assert.equal((await products.saveProduct(product, products.toProduct(record))).discount, 20);
  await assert.rejects(products.saveProduct({ ...product, discount: product.price }, product), /Discount/);
});
