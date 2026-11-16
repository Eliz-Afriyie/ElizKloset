import type { AdminProduct, Taxonomy } from "../ui/AdminCatalog";
import { adminRequest, AdminApiError, unwrap } from "./api";
import { isImageUrl } from "./gallery";

export type ProductRecord = {
  id: string; name: string; description: string; createdAt: string; version: number;
  price: { amount: number; currency: "GHS"; discountAmount?: number | null }; status: AdminProduct["status"];
  category: { id: string }; collections: string[];
  images: { id: string; url: string }[];
  image_url?: string | null;
  colors: { id: string; name: string; hex: string; imageIds: string[]; image_url?: string | null }[];
  variants: { id: string; colorId: string | null; size: string; stock: number; availableStock: number }[];
  stock: number; availableStock: number;
};
export type ProductPage = {
  data: ProductRecord[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  summary?: { all: number; outOfStock: number; lowStock: number };
};

export class ProductCompletionError extends AdminApiError {
  constructor(public product: AdminProduct, error: unknown) {
    super(`The product was saved as a draft, but its photos or collections could not be finished. Save again to update this draft. ${error instanceof Error ? error.message : "Please retry."}`, error instanceof AdminApiError ? error.status : 0, error instanceof AdminApiError ? error.fields : {});
  }
}

export function parseProductPage(value: unknown): ProductPage {
  const page = value as ProductPage;
  if (!page || !Array.isArray(page.data) || !page.pagination ||
      ![page.pagination.page, page.pagination.pageSize, page.pagination.total, page.pagination.totalPages].every(Number.isInteger) ||
      page.pagination.page < 1 || page.pagination.pageSize < 1 || page.pagination.total < 0 || page.pagination.totalPages < 0) {
    throw new Error("Unsupported product list response from the API.");
  }
  page.data.forEach(toProduct);
  if (page.summary != null && ![page.summary.all, page.summary.outOfStock, page.summary.lowStock].every((count) => Number.isInteger(count) && count >= 0)) {
    throw new Error("Unsupported stock totals in the API product list.");
  }
  return page;
}

export async function productStockSummary(page: ProductPage, filters: URLSearchParams, signal?: AbortSignal): Promise<NonNullable<ProductPage["summary"]>> {
  if (page.summary) return page.summary;
  if (!filters.has("stock") && page.data.length === page.pagination.total) {
    return { all: page.pagination.total, outOfStock: page.data.filter(item => item.availableStock === 0).length, lowStock: page.data.filter(item => item.availableStock > 0 && item.availableStock <= 3).length };
  }
  const counts = await Promise.all(["all", "out", "low"].map(async stock => {
    const params = new URLSearchParams(filters);
    params.set("page", "1"); params.set("pageSize", "1"); params.delete("stock");
    if (stock !== "all") params.set("stock", stock);
    return parseProductPage(await adminRequest<unknown>(`products?${params}`, { signal })).pagination.total;
  }));
  return { all: counts[0], outOfStock: counts[1], lowStock: counts[2] };
}

export function toProduct(record: ProductRecord): AdminProduct {
  if (!record || typeof record.id !== "string" || typeof record.name !== "string" || typeof record.createdAt !== "string" || !Number.isInteger(record.version) || !record.price || record.price.currency !== "GHS" || !Number.isInteger(record.price.amount) || !Number.isInteger(record.availableStock) || !Array.isArray(record.collections) || !Array.isArray(record.colors) || !Array.isArray(record.variants) || !Array.isArray(record.images) || !record.category || typeof record.category.id !== "string") {
    throw new Error("The API product response does not match the documented catalog shape.");
  }
  function validateEntries(entries: unknown[], group: string, fields: Record<string, (value: unknown) => boolean>) {
    entries.forEach((entry, index) => {
      const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
      for (const [field, valid] of Object.entries(fields)) {
        if (!valid(item[field])) {
          const value = item[field];
          const type = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
          throw new Error(`Product "${record.name}" (${record.id}): the API returned an invalid ${group}[${index}].${field} (received ${type}).`);
        }
      }
    });
  }
  const string = (value: unknown) => typeof value === "string";
  validateEntries(record.images, "images", { id: string, url: string });
  validateEntries(record.colors, "colors", { id: string, name: string, imageIds: Array.isArray });
  validateEntries(record.variants, "variants", { id: string, colorId: (value) => value === null || string(value), size: string, stock: Number.isInteger });
  return {
    id: record.id, name: record.name, description: record.description, createdAt: record.createdAt,
    price: record.price.amount, discount: record.price.discountAmount ?? 0, status: record.status, stock: record.availableStock,
    categoryId: record.category.id, collectionIds: record.collections,
    image: record.image_url || record.images[0]?.url || "", sizes: [...new Set(record.variants.map((item) => item.size))],
    colors: record.colors.map((color) => color.name),
    variants: record.colors.map((color) => ({
      id: color.id, color: color.name, hex: color.hex,
      image: color.image_url || record.images.find((image) => color.imageIds.includes(image.id))?.url || "",
      sizes: record.variants.filter((item) => item.colorId === color.id).map((item) => ({ size: item.size, stock: item.stock })),
    })),
    apiSource: record,
  };
}

export async function listTaxonomy(signal?: AbortSignal): Promise<Taxonomy[]> {
  async function all(kind: "categories" | "collections"): Promise<Taxonomy[]> {
    const result: Taxonomy[] = [];
    for (let page = 1; ; page++) {
      const response = await adminRequest<{ data: Taxonomy[]; pagination: { totalPages: number } }>(`${kind}?page=${page}&pageSize=100`, { signal });
      if (!Array.isArray(response.data) || !response.pagination || !Number.isInteger(response.pagination.totalPages)) throw new Error("Unsupported taxonomy list response.");
      result.push(...response.data.map((item) => ({ ...item, kind: kind === "categories" ? "category" as const : "collection" as const })));
      if (page >= response.pagination.totalPages) return result;
    }
  }
  return (await Promise.all([all("categories"), all("collections")])).flat();
}

// Cache uploaded assets only in memory; retrying a failed save reuses successful uploads.
const uploaded = new Map<string, { id: string; url: string }>();
async function imageId(image: string, source?: ProductRecord) {
  if (!image) return null;
  const existing = source?.images.find((item) => item.url === image);
  if (existing) return existing.id;
  if (source?.image_url === image) return null;
  if (isImageUrl(image)) return null;
  if (uploaded.has(image)) return uploaded.get(image)!.id;
  if (!image.startsWith("data:image/")) throw new Error("Choose a new image file to upload.");
  const blob = await (await fetch(image)).blob();
  const body = new FormData(); body.set("file", blob, `product.${blob.type.split("/")[1]}`);
  const asset = unwrap(await adminRequest<{ data: { id: string; url: string } }>("assets", { method: "POST", body }));
  if (!asset.id || !asset.url) throw new Error("The upload did not return an asset ID and URL.");
  uploaded.set(image, asset); return asset.id;
}

export async function saveProduct(product: AdminProduct, original?: AdminProduct | null) {
  const discount = product.discount ?? 0;
  if (!Number.isFinite(discount) || discount < 0 || discount >= product.price) throw new Error("Discount must be zero or less than the product price.");
  const source = original?.apiSource;
  if (source?.variants.some((variant) => variant.colorId === null)) {
    throw new Error("This product has inventory variants without a colour assignment. Ask the backend team to restore their colorId links before editing, so existing stock is not lost. Status can still be changed from the product list.");
  }
  const colors = [];
  const remoteColorImages = new Set<string>();
  for (const color of product.variants) {
    const asset = await imageId(color.image, source);
    const previous = source?.colors.find((item) => item.id === color.id);
    const unchanged = source?.images.find((item) => item.id === previous?.imageIds[0])?.url === color.image;
    if (isImageUrl(color.image) && !asset) remoteColorImages.add(color.image);
    colors.push({ id: color.id, name: color.color, hex: color.hex, imageIds: unchanged ? previous!.imageIds : asset ? [asset] : [] });
  }
  if (source && remoteColorImages.size) throw new Error("This colour photo is not attached to the product yet. The API requires an image ID for colour photos. Choose an existing product photo or upload a file instead.");
  let cover: string | null = null;
  let file: Blob | undefined;
  if (source) cover = await imageId(product.image, source);
  else if (product.image && !isImageUrl(product.image)) {
    // Reuse a cover already uploaded as a colour photo; otherwise send the file
    // directly to the new multipart create endpoint, without an asset pre-upload.
    cover = uploaded.get(product.image)?.id ?? null;
    if (!cover) {
      if (!product.image.startsWith("data:image/")) throw new Error("Choose a new image file to upload.");
      file = await (await fetch(product.image)).blob();
    }
  }
  const imageIds = [...new Set([...(cover ? [cover] : []), ...colors.flatMap((color) => color.imageIds), ...(source?.images.slice(1).map((item) => item.id) ?? [])])];
  const body = {
    name: product.name, description: product.description, price: { amount: product.price, currency: "GHS" },
    discountAmount: discount,
    ...(isImageUrl(product.image) ? { image_url: product.image } : {}),
    categoryId: product.categoryId, collectionIds: product.collectionIds, status: product.status, imageIds, colors,
    variants: product.variants.flatMap((color) => color.sizes.map((size) => {
      const existing = source?.variants.find((item) => item.colorId === color.id && item.size === size.size);
      return { ...(existing ? { id: existing.id } : {}), colorId: color.id, size: size.size, stock: size.stock };
    })),
  };
  if (source) return toProduct(unwrap(await adminRequest<{ data: ProductRecord }>(`products/${encodeURIComponent(source.id)}`, { method: "PATCH", body, version: source.version })));
  const form = new FormData();
  form.set("name", body.name);
  form.set("description", body.description);
  form.set("price_amount", String(body.price.amount));
  form.set("price_currency", body.price.currency);
  form.set("discount_amount", String(body.discountAmount));
  if (body.image_url) form.set("image_url", body.image_url);
  form.set("category_id", body.categoryId);
  const finishRequired = body.collectionIds.length > 0 || body.imageIds.length > 0 || remoteColorImages.size > 0;
  form.set("status", finishRequired ? "draft" : body.status);
  // Existing colour asset IDs and collection memberships are attached by PATCH,
  // because the create endpoint accepts only uploaded product_images files.
  for (const color of body.colors) form.append("colors", JSON.stringify({ ...color, imageIds: [] }));
  for (const variant of body.variants) form.append("variants", JSON.stringify(variant));
  if (file) form.append("product_images", file, `product.${file.type.split("/")[1]}`);
  for (const image of remoteColorImages) form.append("product_images", image);
  const created = toProduct(unwrap(await adminRequest<{ data: ProductRecord }>("products", { method: "POST", body: form })));
  if (file && created.apiSource!.images.length === 1) uploaded.set(product.image, created.apiSource!.images[0]);
  if (!finishRequired) return created;
  try {
    const linkedColors = body.colors.map((color) => {
      const selected = product.variants.find((item) => item.id === color.id)?.image;
      if (!selected || !remoteColorImages.has(selected)) return color;
      const asset = created.apiSource!.images.find((image) => image.url === selected);
      if (!asset) throw new Error("The API did not return an image ID for the selected cloud colour photo. The draft was kept; the backend must return its registered product image reference before this photo can be linked.");
      return { ...color, imageIds: [asset.id] };
    });
    return toProduct(unwrap(await adminRequest<{ data: ProductRecord }>(`products/${encodeURIComponent(created.id)}`, {
      method: "PATCH", version: created.apiSource!.version,
      body: { collectionIds: body.collectionIds, imageIds: [...new Set([...body.imageIds, ...created.apiSource!.images.map((image) => image.id)])], colors: linkedColors, status: body.status },
    })));
  } catch (error) { throw new ProductCompletionError(created, error); }
}

export async function changeProductStatus(product: AdminProduct) {
  if (!product.apiSource) throw new Error("Reload this product before changing its status.");
  return toProduct(unwrap(await adminRequest<{ data: ProductRecord }>(`products/${encodeURIComponent(product.id)}`, { method: "PATCH", version: product.apiSource.version, body: { status: product.status === "active" ? "inactive" : "active" } })));
}

export async function deleteProduct(product: AdminProduct) {
  if (!product.apiSource) throw new Error("Reload this product before deleting it.");
  await adminRequest(`products/${encodeURIComponent(product.id)}`, { method: "DELETE", version: product.apiSource.version });
}
