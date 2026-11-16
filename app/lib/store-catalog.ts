import type { Product } from "./catalog";
export type StoreTaxonomy = { id: string; name: string; slug: string; description?: string; image?: { url: string } | null };
export type ProductPage = { data: Product[]; pagination: { total: number; nextCursor: string | null; hasMore: boolean }; facets: { sizes: string[]; colors: { name: string; hex: string }[]; price: { min: number | null; max: number | null } } };
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object") throw new Error("The store returned an unsupported response."); return value as Record<string, unknown>; }
export function parseProduct(value: unknown): Product {
  const row = object(value); const price = object(row.price);
  if (typeof row.id !== "string" || typeof row.slug !== "string" || typeof row.name !== "string" || !Number.isInteger(price.amount) || price.currency !== "GHS") throw new Error("The store returned an unsupported product or price.");
  const discountValue = price.discountAmount ?? price.discount_amount;
  const discount = typeof discountValue === "number" && Number.isInteger(discountValue) && discountValue > 0 && discountValue < Number(price.amount) ? discountValue : 0;
  const images = Array.isArray(row.images) ? row.images.map(object) : [];
  const colors = Array.isArray(row.colors) ? row.colors.map((value) => {
    const color = object(value); const photo = images.find((image) => Array.isArray(color.imageIds) && color.imageIds.includes(image.id));
    return { id: String(color.id ?? ""), name: String(color.name ?? ""), hex: typeof color.hex === "string" ? color.hex : "#750d27", image: typeof color.image_url === "string" && color.image_url ? color.image_url : typeof photo?.url === "string" ? photo.url : undefined };
  }) : [];
  const rawVariants = Array.isArray(row.variants) ? row.variants.map(object) : [];
  const variants = rawVariants.map((variant) => {
    const stock = variant.availableStock ?? variant.available_stock;
    return { id: String(variant.id ?? ""), size: String(variant.size ?? ""), color: colors.find((color) => color.id === (variant.colorId ?? variant.color_id))?.name ?? String(variant.color ?? variant.colorId ?? variant.color_id ?? ""), availableStock: typeof stock === "number" ? stock : (variant.inStock ?? variant.in_stock) === true ? 1 : 0 };
  });
  for (const [index, variant] of variants.entries()) {
    if (variant.color && !colors.some(color => color.name === variant.color)) {
      const source = rawVariants[index];
      colors.push({ id: String(source.colorId ?? source.color_id ?? ""), name: variant.color, hex: typeof source.hex === "string" ? source.hex : "#750d27", image: typeof source.image_url === "string" ? source.image_url : undefined });
    }
  }
  const category = row.category && typeof row.category === "object" ? String(object(row.category).name ?? "") : typeof row.category === "string" ? row.category : "";
  const cover = typeof row.image === "object" && row.image ? object(row.image).url : row.image;
  return { id: row.slug, apiId: row.id, slug: row.slug, name: row.name, description: typeof row.description === "string" ? row.description : "", price: Number(price.amount) - discount, originalPrice: discount ? Number(price.amount) : undefined, discount, category,
    bestSeller: row.bestSeller === true || (Array.isArray(row.badges) && row.badges.includes("bestseller")), isNew: row.isNew === true || (Array.isArray(row.badges) && row.badges.includes("new")), image: typeof row.image_url === "string" && row.image_url ? row.image_url : typeof images[0]?.url === "string" ? images[0].url : typeof cover === "string" ? cover : "", color: colors[0]?.name ?? "", hex: colors[0]?.hex ?? "#750d27", colors, variants,
    availableSizes: [...new Set(variants.filter((variant) => variant.availableStock > 0).map((variant) => variant.size))], inStock: variants.some((variant) => variant.availableStock > 0), addedOrder: 0 };
}
export function parseProductPage(value: unknown): ProductPage {
  const row = object(value); const page = object(row.pagination);
  if (!Array.isArray(row.data) || typeof page.total !== "number" || typeof page.hasMore !== "boolean" || (page.nextCursor !== null && typeof page.nextCursor !== "string") || (page.hasMore && !page.nextCursor)) throw new Error("The store returned unsupported product pagination.");
  const facets = row.facets ? object(row.facets) : {};
  return { data: row.data.map(parseProduct), pagination: { total: page.total, nextCursor: page.nextCursor as string | null, hasMore: page.hasMore }, facets: { sizes: Array.isArray(facets.sizes) ? facets.sizes.map((value) => typeof value === "string" ? value : String(object(value).value ?? "")).filter(Boolean) : [], colors: Array.isArray(facets.colors) ? facets.colors as { name: string; hex: string }[] : [], price: facets.price ? object(facets.price) as { min: number | null; max: number | null } : { min: null, max: null } } };
}
export function parseTaxonomy(value: unknown): StoreTaxonomy[] {
  const row = object(value); if (!Array.isArray(row.data)) throw new Error("The store returned unsupported categories or collections.");
  return row.data.map((value) => { const item = object(value); if (typeof item.id !== "string" || typeof item.name !== "string" || typeof item.slug !== "string") throw new Error("The store returned an unsupported category."); return { ...item, ...(typeof item.image_url === "string" && item.image_url ? { image: { url: item.image_url } } : {}) } as StoreTaxonomy; });
}

