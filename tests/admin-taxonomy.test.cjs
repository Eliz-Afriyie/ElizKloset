const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const load = require("./load-module.cjs");
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const taxonomy = load("app/admin/lib/taxonomy.ts");
const fields = { name: "Two Piece", slug: "two-piece", description: "Trousers and a top", status: "active" };

test("taxonomy uploads multipart image then creates with the returned imageId", async () => {
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    if (calls === 1) {
      assert.equal(url, "/api/admin/assets");
      assert.ok(options.body instanceof FormData);
      assert.equal(options.body.get("file").name, "category.png");
      return Response.json({ data: { id: "asset-1", url: "https://cdn.example/category.png" } });
    }
    assert.equal(url, "/api/admin/categories");
    assert.deepEqual(JSON.parse(options.body), { ...fields, imageId: "asset-1" });
    return Response.json({ data: { id: "category-1" } }, { status: 201 });
  };
  const image = await taxonomy.uploadTaxonomyImage(new File(["image"], "category.png", { type: "image/png" }));
  await taxonomy.saveTaxonomy("categories", fields, image.id);
  assert.equal(calls, 2);
});

test("category requires an image and failed uploads never report success", async () => {
  globalThis.fetch = () => { throw new Error("Must not fetch"); };
  await assert.rejects(() => taxonomy.saveTaxonomy("categories", fields), /Choose an image/);
  await assert.rejects(() => taxonomy.uploadTaxonomyImage(new File(["text"], "file.txt", { type: "text/plain" })), /JPEG/);
  globalThis.fetch = async () => Response.json({ data: { url: "https://cdn.example/no-id.png" } });
  await assert.rejects(() => taxonomy.uploadTaxonomyImage(new File(["image"], "file.png", { type: "image/png" })), /image ID/);
});

test("editing preserves the existing image ID and version", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/admin/categories/category-1");
    assert.equal(options.method, "PATCH");
    assert.equal(options.headers.get("if-match"), '"4"');
    assert.equal(JSON.parse(options.body).imageId, "existing-asset");
    return Response.json({});
  };
  await taxonomy.saveTaxonomy("categories", fields, "existing-asset", { id: "category-1", version: 4 });
});
