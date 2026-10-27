# ElizKloset storefront mockup

Run `npm.cmd run dev` on Windows, then open http://localhost:3000.

The homepage follows the supplied design with responsive navigation, catalog search and filters, product details, size selection, a wishlist, and a shopping bag. Bag quantities and wishlist entries are saved under `elizkloset-shopping-v1` in localStorage. When browser storage is unavailable, changes last only for the session. Changes sync across tabs.

## Mock data

`app/lib/catalog.ts` defines sample products, prices in Ghana cedis, sizes, and pictured colors. Product cards and collection tiles use the supplied boutique photographs directly from `public/images`. The homepage shows five featured dresses and a clearly labeled sample reviews section. View All opens `/shop`, which contains the complete mock catalog, search, and category filters, including Two Pieces. Campaign portraits in `public/images/hero-*.png` are used only for the hero and arrivals banner; see `public/images/GENERATION.md` for their origin. Replace these with individual, approved product photographs before launch. Preview sizes and collection assignments do not represent confirmed inventory.

`app/lib/shopping-store.ts` owns browser persistence. Cart lines use this shape:

```ts
type CartLine = {
  productId: string;
  size: number;
  color: string;
  quantity: number;
};
```

Checkout is deliberately unavailable. The mockup does not create orders, collect payments, reserve inventory, or authenticate users. The contact section does not invent business contact details.

## API integration later

Replace the catalog with a product API that supplies product IDs, descriptions, image URLs, categories, and purchasable variants. Each variant should have a stable ID, size, color, price, and available stock. Replace cart persistence with an API-backed cart when customer accounts are added; browser wishlists can then migrate to an account.

Checkout must calculate authoritative prices and delivery charges on the server, validate stock, and create orders there. Payment success must be verified by the server or provider webhook. Never accept a browser subtotal as the order amount.

The existing service worker caches only approved public assets and an offline fallback. Customer pages, cart responses, and checkout data should remain outside its cache.

## Validation

Run `npm.cmd run lint` and `npm.cmd run build`. For PWA checks use `npm.cmd start` after a successful build; worker registration is production-only. A deployed PWA needs HTTPS.




## Shop browsing

The Shop page defaults to all 20 uploaded dresses. Three two-piece outfits are available through the category sidebar. Clear All shows all 23 sample outfits. Every supplied boutique outfit photo is represented in the catalog; homepage curation remains limited to five dresses.

ShopBrowser supports category, size, colour, maximum price, and availability filters, search, price/name/newest sorting, and grid/list views. The added order, available sizes, and stock flags are explicit preview data in `app/lib/catalog.ts`; all current items have preview stock and sizes 8–16. Replace these fields with authoritative inventory and timestamps when the API is connected. Bags, shoes, and men's collections stay in the coming-soon state until their products are supplied.

## Confirmed pricing, variants, and pagination

Dresses are GHS 160 and Two Pieces are GHS 220. The Champagne Skirt Two Piece has Champagne, Black, Green, Red, and White options. Variant photos are optional: unphotographed colors retain the Champagne image with a visible note. Cart lines include the selected color and validate it against the product color list when restored from browser storage.

Shop renders eight products initially and appends four more when its sentinel enters the viewport. Previously rendered cards and their selections are retained. Filter, search, or sorting changes remount the paginated list and reset to eight results. A Load more button supports keyboard users and browsers without IntersectionObserver. Route/first-page and append skeletons are included. Short timers simulate requests against the local mock catalog; replace them with API requests when the backend is ready. Pending timers and observers are cleaned up on navigation or filter changes.
