import type { ProductRecord } from "../lib/products";

export type Taxonomy = { id: string; name: string; slug: string; kind: "category" | "collection"; description: string; status: "active" | "draft" };
export type ColorVariant = { id: string; color: string; hex: string; image: string; sizes: { size: string; stock: number }[] };
export type AdminProduct = { apiSource?: ProductRecord; createdAt: string; id: string; name: string; price: number; description: string; image: string; categoryId: string; collectionIds: string[]; sizes: string[]; colors: string[]; variants: ColorVariant[]; stock: number; status: "active" | "draft" | "inactive" };
