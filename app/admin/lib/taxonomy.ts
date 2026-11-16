import { adminRequest, unwrap } from "./api";
import { isImageUrl } from "./gallery";

export type TaxonomyImage = { id: string; url: string; file?: File; fromGallery?: boolean };
export function validateTaxonomyImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPEG, PNG or WebP image.");
  if (!file.size) throw new Error("Choose a non-empty image file.");
}
export async function uploadTaxonomyImage(file: File): Promise<TaxonomyImage> {
  validateTaxonomyImage(file);
  const body = new FormData(); body.set("file", file);
  const asset = unwrap(await adminRequest<{ data: TaxonomyImage }>("assets", { method: "POST", body }));
  if (!asset || typeof asset.id !== "string" || !asset.id || typeof asset.url !== "string" || !asset.url) throw new Error("The upload did not return an image ID and URL. Please try again.");
  return asset;
}

export async function saveTaxonomy(kind: string, fields: Record<string, string>, imageId: string | undefined, existing?: { id: string; version: number } | null, file?: File, imageUrl?: string) {
  if (imageUrl && !isImageUrl(imageUrl)) throw new Error("Choose a valid HTTPS image URL.");
  if (!existing && imageId && !file && !imageUrl) throw new Error("Choose an image file for this new category or collection.");
  if (kind === "categories" && !existing && !file && !imageUrl) throw new Error("Choose an image for this category before saving.");
  if (!existing) {
    const body = new FormData();
    body.set("name", fields.name);
    body.set("description", fields.description);
    body.set("status", fields.status);
    if (imageUrl) body.set("image_url", imageUrl);
    if (file) { validateTaxonomyImage(file); body.set("file", file); body.set("alt", fields.name); }
    // Slugs are server-owned in the current multipart create/update contract.
    return adminRequest(kind, { method: "POST", body });
  }
  const body = new FormData();
  if (imageUrl) body.set("image_url", imageUrl);
  for (const field of ["name", "description", "status"]) if (Object.hasOwn(fields, field)) body.set(field, fields[field]);
  if (file) { validateTaxonomyImage(file); body.set("file", file); body.set("alt", fields.name ?? ""); }
  return adminRequest(`${kind}/${encodeURIComponent(existing.id)}`, { method: "PATCH", version: existing.version, body });
}
