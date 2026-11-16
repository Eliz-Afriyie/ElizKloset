const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const load = require("./load-module.cjs");
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const taxonomy = load("app/admin/lib/taxonomy.ts");
const fields = { name: "Two Piece", slug: "two-piece", description: "Trousers and a top", status: "active" };

test("taxonomy creation rejects unsupported asset-ID-only images", async () => {
  globalThis.fetch = () => { throw new Error("Must not fetch"); };
  await assert.rejects(() => taxonomy.saveTaxonomy("categories", fields, "asset-1"), /image file/);
});

test("new categories send the selected file with their fields in one multipart request", async () => {
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, "/api/admin/categories");
    assert.equal(options.method, "POST");
    assert.ok(options.body instanceof FormData);
    assert.equal(options.headers.has("content-type"), false);
    assert.equal(options.body.get("file").name, "category.png");
    assert.equal(options.body.get("description"), fields.description);
    assert.equal(options.body.get("status"), "active");
    assert.equal(options.body.has("taxonomy_status"), false);
    assert.equal(options.body.has("image_id"), false);
    assert.equal(options.body.get("alt"), fields.name);
    assert.equal(options.body.has("slug"), false);
    return Response.json({ data: { id: "category-1" } }, { status: 201 });
  };
  await taxonomy.saveTaxonomy("categories", fields, undefined, null, new File(["image"], "category.png", { type: "image/png" }));
  assert.equal(calls, 1);
});

test("new collections also use multipart, with an optional image", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/admin/collections");
    assert.ok(options.body instanceof FormData);
    assert.equal(options.body.get("name"), fields.name);
    assert.equal(options.body.get("status"), fields.status);
    assert.equal(options.body.has("file"), false);
    return Response.json({});
  };
  await taxonomy.saveTaxonomy("collections", fields);
});

test("category requires an image and failed uploads never report success", async () => {
  globalThis.fetch = () => { throw new Error("Must not fetch"); };
  await assert.rejects(() => taxonomy.saveTaxonomy("categories", fields), /Choose an image/);
  await assert.rejects(() => taxonomy.uploadTaxonomyImage(new File(["text"], "file.txt", { type: "text/plain" })), /JPEG/);
  globalThis.fetch = async () => Response.json({ data: { url: "https://cdn.example/no-id.png" } });
  await assert.rejects(() => taxonomy.uploadTaxonomyImage(new File(["image"], "file.png", { type: "image/png" })), /image ID/);
});

test("editing sends multipart fields and version without replacing an existing image", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/admin/categories/category-1");
    assert.equal(options.method, "PATCH");
    assert.equal(options.headers.get("if-match"), '"4"');
    assert.ok(options.body instanceof FormData);
    assert.equal(options.headers.has("content-type"), false);
    assert.equal(options.body.get("name"), fields.name);
    assert.equal(options.body.get("status"), fields.status);
    assert.equal(options.body.has("file"), false);
    assert.equal(options.body.has("imageId"), false);
    assert.equal(options.body.has("slug"), false);
    return Response.json({});
  };
  await taxonomy.saveTaxonomy("categories", fields, "existing-asset", { id: "category-1", version: 4 });
});

test("editing can replace an image in the same multipart request", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/admin/categories/category-1");
    assert.equal(options.method, "PATCH");
    assert.equal(options.body.get("file").name, "replacement.png");
    assert.equal(options.body.get("description"), "");
    return Response.json({});
  };
  await taxonomy.saveTaxonomy("categories", { ...fields, description: "" }, undefined, { id: "category-1", version: 2 }, new File(["image"], "replacement.png", { type: "image/png" }));
});

test("metadata-only category edits do not require a new image ID", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/admin/categories/category-1");
    assert.equal(options.body.get("name"), fields.name);
    assert.equal(options.body.has("file"), false);
    return Response.json({});
  };
  await taxonomy.saveTaxonomy("categories", { name: fields.name }, undefined, { id: "category-1", version: 2 });
});
