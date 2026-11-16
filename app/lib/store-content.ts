export type ContentImage = string | { url: string; alt?: string };
export type Highlight = { icon: string; text: string };
export type ContentSlide = { id: string | number; eyebrow: string; title: string; description: string; image: ContentImage; is_active?: boolean; button_link?: string; button_text?: string; highlights?: Highlight[] };
export type Social = { platform: string; link?: string; url?: string; username?: string; handle?: string };
export type StoreSite = {
  name?: string; logo?: string; tagline?: string; navigation?: { href: string; label: string }[];
  features?: { contactSubmission?: boolean; newsletterSignup?: boolean; checkout?: boolean };
  socials?: Social[];
  footer?: {
    branding?: { name: string; logo?: string; tagline: string };
    navigation?: { href: string; label: string }[];
    social_media?: Social[];
    benefits?: { icon: string; title: string; description: string }[];
    bottom_bar?: { closing_text?: string; copyright?: { symbol?: string; text?: string } };
    newsletter?: { title?: string; description?: string; form?: { button_link?: string; button_text?: string; label?: string; placeholder?: string; status_message?: string }; slogan?: { line_one?: string; line_two?: string } };
  };
};
export type ContactField = { label: string; placeholder?: string; required?: boolean; type?: string; options?: { label: string; value: string }[] };
export type StorePage = {
  hero_section?: { slides: ContentSlide[]; autoplay?: boolean; autoplay_interval?: number; show_indicators?: boolean; show_navigation?: boolean };
  style_worth_talking_about?: { eyebrow: string; title: string; description: string; image: ContentImage; highlights?: Highlight[]; button?: { text: string; link: string } };
  contact_section?: {
    eyebrow: string; title: string; description: string;
    contact_methods?: { type: string; icon: string; title: string; description: string; value: string; link: string }[];
    social_media?: { title: string; links: Social[] };
    form?: { title: string; description: string; fields?: Record<string, ContactField>; status?: { is_available: boolean; unavailable_message: string; success_message: string; error_message: string }; submit_button?: { text: string; icon: string } };
  };
};
export function imageSource(image?: ContentImage) { return typeof image === "string" ? image : image?.url || ""; }
export function imageAlt(image?: ContentImage) { return typeof image === "object" ? image.alt || "" : ""; }
export function storeNavigation(items: { href: string; label: string }[] = []) {
  let hasShop = false;
  return items.flatMap((item) => {
    if (!["/shop", "/collections"].includes(item.href.replace(/\/$/, ""))) return [item];
    if (hasShop) return [];
    hasShop = true;
    return [{ href: "/shop", label: "Collections & New Arrivals" }];
  });
}
export function contentHref(value?: string) {
  if (!value) return "#";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (value.startsWith("#")) return value;
  try { const url = new URL(value); if (["https:", "mailto:", "tel:"].includes(url.protocol)) return value; } catch {}
  return "#";
}
export function parseStorePage(value: unknown): StorePage {
  const row = value as { data?: StorePage };
  if (!row?.data || typeof row.data !== "object" || (row.data.hero_section && !Array.isArray(row.data.hero_section.slides))) throw new Error("Unable to read page content.");
  if (row.data.hero_section?.slides.some((slide) => !slide || typeof slide.title !== "string" || typeof slide.description !== "string" || !imageSource(slide.image))) throw new Error("Unable to read page banners.");
  return row.data;
}
