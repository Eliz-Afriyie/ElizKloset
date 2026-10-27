import { adminRequest, unwrap } from "./api";

export type TaxonomyImage = { id: string; url: string };
export async function uploadTaxonomyImage(file: File): Promise<TaxonomyImage> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPEG, PNG or WebP image.");
  if (!file.size) throw new Error("Choose a non-empty image file.");
  const body = new FormData(); body.set("file", file);
  const asset = unwrap(await adminRequest<{ data: TaxonomyImage }>("assets", { method: "POST", body }));
  if (!asset || typeof asset.id !== "string" || !asset.id || typeof asset.url !== "string" || !asset.url) throw new Error("The upload did not return an image ID and URL. Please try again.");
  return asset;
}

export async function saveTaxonomy(kind: string, fields: Record<string, string>, imageId: string | undefined, existing?: { id: string; version: number } | null) {
  if (kind === "categories" && !imageId) throw new Error("Choose an image for this category before saving.");
  return adminRequest(existing ? `${kind}/${encodeURIComponent(existing.id)}` : kind, {
    method: existing ? "PATCH" : "POST", version: existing?.version,
    body: { ...fields, ...(imageId ? { imageId } : {}) },
  });
}
