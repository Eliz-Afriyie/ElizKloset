export type GalleryImage = { id: string; url: string; alt: string; name: string };
export function isImageUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}
export function parseGallery(value: unknown): { data: GalleryImage[]; pagination: { total: number; totalPages: number } } {
  const row = value as { data?: unknown[]; pagination?: { total: number; totalPages: number } };
  const entries = Array.isArray(value) ? value : row?.data;
  if (!Array.isArray(entries)) throw new Error("Unable to read the gallery images.");
  const data = entries.flatMap((value) => {
    const item = value as Partial<GalleryImage> & { image_url?: string; gallery_url?: string | string[]; urls?: string[] };
    if (!item) throw new Error("The gallery returned an invalid image.");
    const urls = typeof item === "string" ? [item] : item.gallery_url ? (Array.isArray(item.gallery_url) ? item.gallery_url : [item.gallery_url]) : item.urls || [item.url || item.image_url || ""];
    return urls.map((url) => {
      if (typeof url !== "string" || !isImageUrl(url)) throw new Error("The gallery returned an invalid image URL.");
      return { id: typeof item.id === "string" ? item.id : url, url, alt: typeof item.alt === "string" ? item.alt : "", name: typeof item.name === "string" ? item.name : "" };
    });
  });
  return { data, pagination: row?.pagination || { total: data.length, totalPages: Math.ceil(data.length / 12) } };
}