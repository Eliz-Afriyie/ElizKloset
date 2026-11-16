const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const load = require("./load-module.cjs");

test("wishlist keeps sold-out styles visible and offers removal for missing styles", () => {
  const Wishlist = load("app/components/WishlistContent.tsx", {
    "./StoreCatalog": { useStoreCatalog: () => ({ loading: false, error: "", products: [{
      id: "sold-out", name: "Saved dress", inStock: false, image: "", color: "Blue", hex: "#123456", colors: [], category: "Dresses", price: 149,
    }] }) },
    "../lib/shopping-store": { useShoppingStore: () => ({ state: { cart: [], wishlist: ["sold-out", "removed-product"] }, update() {} }) },
    "../lib/customer-session": { useCustomerSession: () => ({ user: { id: "customer" }, loading: false, requireUser: async () => true }) },
    "./DesignPhoto": { default: () => null },
  }).default;
  const html = renderToStaticMarkup(createElement(Wishlist));
  assert.match(html, /2 saved styles/);
  assert.match(html, /Saved dress/);
  assert.match(html, /Style currently unavailable/);
  assert.match(html, /Remove from wishlist/);
  assert.doesNotMatch(html, /A little inspiration, saved for later/);
});
