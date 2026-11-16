const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const load = require("./load-module.cjs");
const content = load("app/lib/store-content.ts");
const catalog = load("app/lib/store-catalog.ts");
test("shop and collections aliases render as one navigation destination in either order", () => {
  for (const links of [[{ href: "/collections", label: "Collections & New Arrivals" }, { href: "/shop", label: "Shop" }], [{ href: "/shop/", label: "Shop" }, { href: "/collections/", label: "Collections" }]]) {
    const result = content.storeNavigation([{ href: "/", label: "Home" }, ...links, { href: "/about", label: "About Us" }]);
    assert.equal(result.length, 3);
    assert.equal(result[1].href, "/shop");
    assert.equal(result[1].label, "Collections & New Arrivals");
    assert.equal(result[2].href, "/about");
  }
});
const state = { loading: false, page: null, site: null };
const overrides = {
  [path.resolve("app/components/StoreCatalog.tsx")]: { useStoreCatalog: () => state },
  "next/link": { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) },
  "next/image": { __esModule: true, default: ({ src, alt }) => React.createElement("img", { src, alt }) },
};
const render = (entry, name = "default", props = {}) => renderToStaticMarkup(React.createElement(load(entry, overrides)[name], props));

test("homepage carousel renders only active backend slides and honors navigation settings", () => {
  state.page = content.parseStorePage({ data: { hero_section: { autoplay: false, show_navigation: false, show_indicators: false, slides: [
    { id: 1, title: "API hero title", description: "API description", eyebrow: "API eyebrow", image: "https://images.example/hero.jpg", button_link: "/collections", button_text: "API shop", highlights: [{ icon: "gem", text: "API quality" }] },
    { id: 2, title: "Hidden campaign", description: "Hidden copy", image: "https://images.example/hidden.jpg", is_active: false },
  ] } } });
  const html = render("app/components/HeroCarousel.tsx");
  for (const value of ["API hero title", "API description", "API eyebrow", "API shop", "API quality", "https://images.example/hero.jpg"]) assert.ok(html.includes(value));
  assert.doesNotMatch(html, /Hidden campaign|Previous slide|carousel-dots/);
  state.page = { hero_section: { slides: [] } };
  assert.equal(render("app/components/HeroCarousel.tsx"), "");
});

test("footer and newsletter display backend branding, links, benefits and disabled state", () => {
  state.site = { features: { newsletterSignup: false }, footer: {
    branding: { name: "API Brand", tagline: "API tagline", logo: "https://images.example/logo.jpg" },
    navigation: [{ href: "/collections", label: "API Collections" }],
    benefits: [{ icon: "headphones", title: "API support", description: "API help" }],
    social_media: [{ platform: "instagram", username: "@api-brand", link: "https://instagram.com/api-brand" }],
    bottom_bar: { closing_text: "API closing", copyright: { symbol: "©", text: "API rights" } },
    newsletter: { title: "API newsletter", description: "API news", form: { label: "API email", button_text: "API subscribe", placeholder: "API address", status_message: "API unavailable" }, slogan: { line_one: "API today", line_two: "API tomorrow" } },
  } };
  const footer = render("app/components/StoreFooter.tsx");
  for (const value of ["API Brand", "API tagline", "Collections &amp; New Arrivals", "API closing", "API rights", "@api-brand"]) assert.ok(footer.includes(value));
  assert.match(render("app/components/StoreFooter.tsx", "StoreBenefits"), /API support/);
  const newsletter = render("app/components/BrandSections.tsx", "Newsletter");
  for (const value of ["API newsletter", "API subscribe", "API unavailable", "disabled"]) assert.ok(newsletter.includes(value));
});

test("contact fields, contact links and availability come from the page API", () => {
  state.site = { features: { contactSubmission: true } };
  state.page = { contact_section: { title: "API contact", eyebrow: "API hello", description: "API contact copy", contact_methods: [{ type: "phone", icon: "phone", title: "API phone", value: "123", description: "API call", link: "tel:123" }], form: { title: "API form", description: "API form copy", fields: { subject: { label: "API subject", type: "select", options: [{ label: "API enquiry", value: "api_enquiry" }] } }, status: { is_available: false, unavailable_message: "API contact disabled", success_message: "API sent", error_message: "API failed" } } } };
  const html = render("app/components/ContactContent.tsx");
  for (const value of ["API contact", "tel:123", "API subject", "api_enquiry", "API contact disabled", "disabled"]) assert.ok(html.includes(value));
});

test("category image_url overrides stale image records and content links reject executable URLs", () => {
  const parsed = catalog.parseTaxonomy({ data: [{ id: "c1", name: "Category", slug: "category", image: { url: "http://127.0.0.1/old.jpg" }, image_url: "https://images.example/category.jpg" }] });
  assert.equal(parsed[0].image.url, "https://images.example/category.jpg");
  assert.equal(content.contentHref("javascript:alert(1)"), "#");
  assert.equal(content.contentHref("//unknown.example"), "#");
  assert.equal(content.contentHref("/collections"), "/collections");
});
