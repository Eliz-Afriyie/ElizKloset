const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const load = require("./load-module.cjs");
const gallery = load("app/admin/lib/gallery.ts");
const products = load("app/admin/lib/products.ts");
const taxonomy = load("app/admin/lib/taxonomy.ts");
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const url = "https://storage.googleapis.com/example/product.jpg";

test("gallery accepts paginated cloud URLs and rejects unsafe URLs and malformed responses", () => {
  const page = gallery.parseGallery({ data: [{ id: "photo-1", image_url: url, name: "Dress" }], pagination: { total: 1, totalPages: 1 } });
  assert.equal(page.data[0].url, url);
  for (const input of ["javascript:alert(1)", "data:image/png;base64,AA", "http://example.com/a.jpg", "https://user:password@example.com/a.jpg"]) assert.equal(gallery.isImageUrl(input), false);
  assert.equal(gallery.parseGallery({ data: [] }).data.length, 0);
  assert.equal(gallery.parseGallery({ data: [{ id: "gallery-1", gallery_url: url }] }).data[0].url, url);
  assert.throws(() => gallery.parseGallery({}), /Unable to read/);
});

test("new products submit selected cloud URLs without downloading or uploading files", async () => {
  let calls = 0;
  const created = { id: "p1", name: "Dress", description: "", createdAt: "2026-11-03", version: 1, price: { amount: 700, currency: "GHS" }, status: "draft", category: { id: "c1" }, collections: [], images: [{ id: "asset-cloud", url }], image_url: url, colors: [{ id: "blue", name: "Blue", hex: "#0000ff", imageIds: [] }], variants: [], availableStock: 0 };
  globalThis.fetch = async (path, options) => {
    calls++;
    if (options.method === "PATCH") {
      assert.equal(path, "/api/admin/products/p1");
      const body = JSON.parse(options.body);
      assert.deepEqual(Object.keys(body.colors[0]).sort(), ["hex", "id", "imageIds", "name"]);
      assert.deepEqual(body.colors[0].imageIds, ["asset-cloud"]);
      return Response.json({ data: { ...created, colors: body.colors, version: 2 } });
    }
    assert.equal(path, "/api/admin/products");
    const form = options.body;
    assert.equal(form.get("image_url"), url);
    assert.equal(form.get("product_images"), url);
    assert.deepEqual(Object.keys(JSON.parse(form.get("colors"))).sort(), ["hex", "id", "imageIds", "name"]);
    return Response.json({ data: created });
  };
  const saved = await products.saveProduct({ id: "draft", name: "Dress", description: "", price: 700, image: url, categoryId: "c1", collectionIds: [], status: "draft", variants: [{ id: "blue", color: "Blue", hex: "#0000ff", image: url, sizes: [{ size: "M", stock: 1 }] }] });
  assert.equal(saved.image, url);
  assert.equal(calls, 2);
  assert.equal(saved.variants[0].image, url);
});

test("missing cloud image references keep the created draft instead of dropping the colour photo", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ data: { id: "draft", name: "Dress", description: "", createdAt: "2026-11-05", version: 1, price: { amount: 700, currency: "GHS" }, status: "draft", category: { id: "c1" }, collections: [], images: [], colors: [], variants: [], availableStock: 0 } }); };
  await assert.rejects(products.saveProduct({ name: "Dress", description: "", price: 700, image: url, categoryId: "c1", collectionIds: [], status: "active", variants: [{ id: "blue", color: "Blue", hex: "#0000ff", image: url, sizes: [{ size: "M", stock: 1 }] }] }), error => error instanceof products.ProductCompletionError && error.product.status === "draft");
  assert.equal(calls, 1);
});

test("category creation and collection edits submit gallery URLs without files", async () => {
  const fields = { name: "Dresses", description: "", status: "draft" };
  let calls = 0;
  globalThis.fetch = async (path, options) => {
    calls++;
    assert.equal(options.body.get("image_url"), url);
    assert.equal(options.body.has("file"), false);
    return Response.json({ data: {} });
  };
  await taxonomy.saveTaxonomy("categories", fields, "photo-1", null, undefined, url);
  await taxonomy.saveTaxonomy("collections", fields, "photo-1", { id: "collection-1", version: 1 }, undefined, url);
  assert.equal(calls, 2);
});
