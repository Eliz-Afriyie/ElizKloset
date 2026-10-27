import type { AdminProduct, Taxonomy } from "../ui/AdminCatalog";
import { adminRequest, unwrap } from "./api";

export type ProductRecord = {
  id: string; name: string; description: string; createdAt: string; version: number;
  price: { amount: number; currency: "GHS" }; status: AdminProduct["status"];
  category: { id: string }; collections: string[];
  images: { id: string; url: string }[];
  colors: { id: string; name: string; hex: string; imageIds: string[] }[];
  variants: { id: string; colorId: string; size: string; stock: number; availableStock: number }[];
  stock: number; availableStock: number;
};
export type ProductPage = {
  data: ProductRecord[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  summary: { all: number; outOfStock: number; lowStock: number };
};

export function toProduct(record: ProductRecord): AdminProduct {
  if (!record || typeof record.id !== "string" || typeof record.name !== "string" || typeof record.createdAt !== "string" || !Number.isInteger(record.version) || !record.price || record.price.currency !== "GHS" || !Number.isInteger(record.price.amount) || !Number.isInteger(record.availableStock) || !Array.isArray(record.collections) || !Array.isArray(record.colors) || !Array.isArray(record.variants) || !Array.isArray(record.images) || !record.category || typeof record.category.id !== "string") {
    throw new Error("The API product response does not match the documented catalog shape.");
  }
  if (record.images.some((image) => typeof image.id !== "string" || typeof image.url !== "string") || record.colors.some((color) => typeof color.id !== "string" || typeof color.name !== "string" || !Array.isArray(color.imageIds)) || record.variants.some((variant) => typeof variant.id !== "string" || typeof variant.colorId !== "string" || typeof variant.size !== "string" || !Number.isInteger(variant.stock))) {
    throw new Error("The API returned unsupported product images or inventory variants.");
  }
  return {
    id: record.id, name: record.name, description: record.description, createdAt: record.createdAt,
    price: record.price.amount / 100, status: record.status, stock: record.availableStock,
    categoryId: record.category.id, collectionIds: record.collections,
    image: record.images[0]?.url ?? "", sizes: [...new Set(record.variants.map((item) => item.size))],
    colors: record.colors.map((color) => color.name),
    variants: record.colors.map((color) => ({
      id: color.id, color: color.name, hex: color.hex,
      image: record.images.find((image) => color.imageIds.includes(image.id))?.url ?? "",
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
  if (uploaded.has(image)) return uploaded.get(image)!.id;
  if (!image.startsWith("data:image/")) throw new Error("Choose a new image file to upload.");
  const blob = await (await fetch(image)).blob();
  const body = new FormData(); body.set("file", blob, `product.${blob.type.split("/")[1]}`);
  const asset = unwrap(await adminRequest<{ data: { id: string; url: string } }>("assets", { method: "POST", body }));
  if (!asset.id || !asset.url) throw new Error("The upload did not return an asset ID and URL.");
  uploaded.set(image, asset); return asset.id;
}

export async function saveProduct(product: AdminProduct, original?: AdminProduct | null) {
  const source = original?.apiSource;
  const cover = await imageId(product.image, source);
  const colors = [];
  for (const color of product.variants) {
    const asset = await imageId(color.image, source);
    const previous = source?.colors.find((item) => item.id === color.id);
    const unchanged = source?.images.find((item) => item.id === previous?.imageIds[0])?.url === color.image;
    colors.push({ id: color.id, name: color.color, hex: color.hex, imageIds: unchanged ? previous!.imageIds : asset ? [asset] : [] });
  }
  const imageIds = [...new Set([...(cover ? [cover] : []), ...colors.flatMap((color) => color.imageIds), ...(source?.images.slice(1).map((item) => item.id) ?? [])])];
  const body = {
    name: product.name, description: product.description, price: { amount: Math.round(product.price * 100), currency: "GHS" },
    categoryId: product.categoryId, collectionIds: product.collectionIds, status: product.status, imageIds, colors,
    variants: product.variants.flatMap((color) => color.sizes.map((size) => {
      const existing = source?.variants.find((item) => item.colorId === color.id && item.size === size.size);
      return { ...(existing ? { id: existing.id } : {}), colorId: color.id, size: size.size, stock: size.stock };
    })),
  };
  return toProduct(unwrap(await adminRequest<{ data: ProductRecord }>(source ? `products/${encodeURIComponent(source.id)}` : "products", { method: source ? "PATCH" : "POST", body, version: source?.version })));
}

export async function changeProductStatus(product: AdminProduct) {
  if (!product.apiSource) throw new Error("Reload this product before changing its status.");
  return toProduct(unwrap(await adminRequest<{ data: ProductRecord }>(`products/${encodeURIComponent(product.id)}`, { method: "PATCH", version: product.apiSource.version, body: { status: product.status === "active" ? "inactive" : "active" } })));
}

export async function deleteProduct(product: AdminProduct) {
  if (!product.apiSource) throw new Error("Reload this product before deleting it.");
  await adminRequest(`products/${encodeURIComponent(product.id)}`, { method: "DELETE", version: product.apiSource.version });
}
