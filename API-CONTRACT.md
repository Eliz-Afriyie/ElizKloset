# ElizKloset customer and admin API handoff

Contract version: 1.0 · 24 October 2026. Status: proposed for backend agreement.

This document covers the current customer pages and admin workspace, including dialogs. All endpoint paths below are relative to `/api/v1`. TypeScript blocks describe JSON wire shapes, not an implementation requirement. Endpoint tables specify the value inside `data` unless a complete envelope or HTTP 204 is shown. This remains the proposed handoff specification; see [ADMIN-INTEGRATION.md](ADMIN-INTEGRATION.md) for the admin endpoints now wired to the deployed backend and outstanding verification. See [CUSTOMER-INTEGRATION.md](CUSTOMER-INTEGRATION.md) for connected customer flows and the customer commerce endpoints still missing from the deployed API.

This is a backend-independent proposal for the existing frontend, not a description of live endpoints. The app currently uses local catalog data, browser cart/wishlist storage, sample reviews, and preview-only forms. No UI changes are required by this document.

## Conventions

- Base path: `/api/v1`. JSON requests and responses; timestamps are ISO 8601 UTC.
- Prices are integer pesewas: `{ "amount": 16000, "currency": "GHS" }` means GH₵160. Current catalog examples use GH₵160 dresses and GH₵220 two pieces; the backend stores each product's price independently.
- Use stable IDs and slugs, not display labels, in requests. Treat illustrative IDs below as examples.
- Single resource: `{ "data": resource }`. Lists: `{ "data": [], "pagination": {} }` where applicable.
- Guest cart/wishlist ownership comes from a secure session cookie, never a client-supplied owner ID. Authenticated users can later merge guest state at login.
- Public page/catalog responses may be cached. Cart, wishlist, account, contact submissions, orders and payments must not enter shared or service-worker caches.

## Page and feature map

| Frontend | Endpoints | Purpose |
| --- | --- | --- |
| Every page | `GET /site` | Branding, navigation, contact/social links, footer, enabled features |
| Home `/` | `GET /pages/home` | Carousel, collection previews, five featured dresses, experience banner, featured reviews |
| Shop `/shop` | `GET /pages/shop`, `GET /categories`, `GET /products` | Banner, category labels and availability, search/filter/sort, incremental loading |
| Product dialog and `/products/{slug}` | `GET /products/{slug}` | Full description, photos, selectable variants and availability |
| About `/about` | `GET /pages/about` | Brand story, CEO name and portrait, values |
| Contact `/contact` | `GET /pages/contact`, `POST /contact/messages` | Banner, contact methods, email enquiry submission |
| Cart dialog and `/cart` | `GET /cart`, `POST /cart/items`, `PATCH /cart/items/{lineId}`, `DELETE /cart/items/{lineId}` | Server-owned cart and totals |
| Wishlist dialog and `/wishlist` | `GET /wishlist`, `PUT /wishlist/items/{productId}`, `DELETE /wishlist/items/{productId}` | Saved products; repeated PUT/DELETE is safe |
| Account dialog | `/auth/*`, `GET /me`, `PATCH /me`, `GET /me/orders` | Sessions, registration, recovery, profile and history |
| Checkout dialog | `POST /checkout/quote`, `POST /orders`, order payment-attempt endpoints | Delivery quote, order and hosted payment |
| Newsletter | `POST /newsletter/subscriptions` | Email signup |
| Reviews | `GET /reviews?featured=true&limit=3` | Optional independent refresh; home response already includes initial reviews |

Account and checkout forms now exist as previews. Their production contracts, together with the admin APIs, are specified below. Payments, delivery pricing, content editing and staff management still require business/provider decisions and integration work.

## Shared site configuration

`GET /site`

```json
{
  "data": {
    "name": "ElizKloset",
    "tagline": "Dress Corporate with Liz",
    "theme": { "primary": "#750D27", "background": "#FFF9F3" },
    "navigation": [
      { "label": "Home", "href": "/" },
      { "label": "Shop", "href": "/shop" },
      { "label": "About", "href": "/about" },
      { "label": "Contact", "href": "/contact" }
    ],
    "contact": {
      "whatsapp": "+233560425514",
      "phone": "+233594717121",
      "email": null
    },
    "socials": [
      { "platform": "tiktok", "handle": "@Elizkloset", "url": "https://www.tiktok.com/@Elizkloset" },
      { "platform": "instagram", "handle": "@_elizkloset", "url": "https://www.instagram.com/_elizkloset/" }
    ],
    "features": { "contactSubmission": false, "newsletterSignup": false, "checkout": false },
    "footer": { "copyrightName": "ElizKloset", "links": [] }
  }
}
```

Feature flags become true only when the corresponding backend capability is configured. The business email is still pending.

## Product shape shared by home, shop, wishlist and product dialog

`GET /products/classic-wrap` returns this resource inside `data`. Product lists use the same shape so the existing cards can work without an additional request per card. A backend may later introduce a documented smaller summary shape for performance.

```json
{
  "id": "classic-wrap",
  "slug": "classic-wrap",
  "name": "Royal Blue Wrap Dress",
  "description": "Corporate wrap dress in royal blue.",
  "category": { "id": "dresses", "name": "Dresses" },
  "collections": ["new-arrivals"],
  "price": { "amount": 16000, "currency": "GHS" },
  "images": [
    { "id": "img-blue", "url": "/images/ElizKloset Royal Blue Corporate Dress.png", "alt": "Royal blue corporate dress" }
  ],
  "colors": [
    { "id": "royal-blue", "name": "Royal blue", "hex": "#104291", "imageIds": ["img-blue"] }
  ],
  "variants": [
    { "id": "classic-wrap-blue-8", "colorId": "royal-blue", "size": "8", "inStock": true },
    { "id": "classic-wrap-blue-10", "colorId": "royal-blue", "size": "10", "inStock": true }
  ],
  "badges": ["new"],
  "inStock": true,
  "ratingSummary": null
}
```

The equivalent reusable product type is:

```ts
type Product = {
  id: string; slug: string; name: string; description: string;
  category: { id: string; name: string }; collections: string[];
  price: Money;
  images: (ImageAsset & { id: string })[];
  colors: { id: string; name: string; hex: string; imageIds: string[] }[];
  variants: { id: string; colorId: string; size: string; inStock: boolean }[];
  badges: string[]; inStock: boolean;
  ratingSummary: { averageRating: number; total: number } | null;
};
```

The example variant availability is illustrative; current inventory and sizes are preview data. Return every actual purchasable size/color combination, each with its own stable variant ID. Use string sizes to support future shirts, shoes and essentials. Product `inStock` is true when at least one variant can be purchased. The server owns price and availability; the client does not submit either when adding to cart.

The Champagne Skirt Two Piece (`chic-office`) costs `22000` and has Champagne, Black, Green, Red and White color options. Where a color has no photo, return `imageIds: []`; the frontend can retain the original photo with “Shown in Champagne.” Do not label the original photo as another color.

## Home

`GET /pages/home` returns this shape. Types in this and later TypeScript blocks describe JSON objects; `Product` means the resource above.

```ts
type ImageAsset = { url: string; alt: string };
type Link = { label: string; href: string };
type Banner = {
  eyebrow: string;
  title: string;
  description: string;
  image: ImageAsset;
  primaryAction?: Link;
  secondaryAction?: Link;
};
type Category = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "coming_soon";
  image: ImageAsset | null;
};
type Review = {
  id: string;
  displayName: string;
  rating: number; // integer 1–5
  title: string;
  body: string;
  verifiedPurchase: boolean; // determined by backend order records
  createdAt: string;
};
type HomePage = {
  heroSlides: (Banner & { id: string })[];
  collectionCards: {
    id: string;
    title: string;
    subtitle: string;
    image: ImageAsset;
    href: string;
  }[];
  upcomingCategories: Category[];
  featuredProducts: Product[]; // maximum five dresses on home
  featuredProductsAction: Link; // opens shop for the rest
  experience: Banner & { values: { icon: string; text: string }[] };
  reviews: { items: Review[]; averageRating: number | null; total: number };
};
// Response: { data: HomePage }
```

Return only published reviews. The current sample quotes must not become real verified reviews. Until real reviews exist, return `items: []`, `averageRating: null`, `total: 0`. Carousel timing, fade animation, responsive layout and skeletons stay in the frontend. The experience banner uses campaign imagery; CEO portraits belong on About, not shop/contact heroes.

## Shop, combined collections and new arrivals

`GET /pages/shop` → `{ "data": { "hero": Banner } }`.

`GET /categories` → `{ "data": Category[] }`, including dresses, two-pieces, ladies-bags, ladies-shoes, mens-shirts, mens-boxers and mens-singlets. Categories without actual stock/catalog entries remain `coming_soon`. “All,” “New Arrivals” and “Best Sellers” are browsing views/collections, not separate product categories.

Initial product request:

```http
GET /api/v1/products?limit=8&sort=featured
```

Filtered example:

```http
GET /api/v1/products?category=dresses&collection=new-arrivals&size=10&color=black&maxPrice=22000&inStock=true&sort=price-asc&limit=8
```

Supported parameters:

| Parameter | Shape / meaning |
| --- | --- |
| `q` | Search name, color, category and size |
| `category` | Repeat for multiple category slugs |
| `collection` | Repeat `new-arrivals` or `best-sellers` |
| `size` | Repeat string sizes, e.g. `size=10&size=12` |
| `color` | Repeat stable color IDs |
| `minPrice`, `maxPrice` | Integer pesewas; current UI exposes maximum price |
| `inStock` | Boolean; omit for all |
| `sort` | `featured`, `newest`, `price-asc`, `price-desc`, `name-asc` |
| `limit` | 8 initially, 4 for subsequent loads; server maximum 50 |
| `cursor` | Opaque server-issued continuation token |

Category and collection choices form one OR selection group to preserve the existing sidebar behavior. Sizes are OR within their group; colors are OR within their group. Search, price, availability and these groups combine with AND. A size/color/stock match must correspond to the same variant, so an unavailable combination is not returned as purchasable.

```ts
type ProductListResponse = {
  data: Product[];
  pagination: {
    total: number; // total matching products, not current batch length
    nextCursor: string | null;
    hasMore: boolean;
  };
  facets: {
    categories: { id: string; name: string; count: number }[];
    collections: { id: string; name: string; count: number }[];
    sizes: { value: string; count: number }[];
    colors: { id: string; name: string; hex: string; count: number }[];
    price: { min: number | null; max: number | null; currency: "GHS" };
  };
};
```

Facet counts use all active filters, including the facet's own group; categories endpoint still supplies the full category list. Empty results return HTTP 200 with `data: []`, `total: 0`, `hasMore: false`, `nextCursor: null`.

Next request preserves filters and sort, adding `cursor=<nextCursor>&limit=4`. Append the returned records; keep previous cards visible and show four skeleton cards while fetching. Reset to eight and discard the cursor when search/filter/sort changes. Grid/list changes need no refetch.

Use stable sorting with an ID tie-breaker and filter/sort-bound cursors. Changing the limit between batches must not skip or duplicate products. Abort/ignore stale frontend requests when filters change. Skeletons require no separate API endpoint. Map existing frontend sort values `price-low`, `price-high`, `name` to the API values above.

## About

`GET /pages/about`

```ts
type AboutPage = {
  eyebrow: string;
  title: string;
  introduction: string;
  story: string[];
  ceo: {
    name: "Ms. Elizabeth Afriyie";
    role: "CEO";
    portrait: ImageAsset; // current /images/ceo/CEO-2.png
    biography: string | null;
  };
  values: { title: string; description: string; icon: string }[];
  action: Link;
};
// Response: { data: AboutPage }
```

Use the existing approved brand copy. Do not invent a founding date, CEO biography or business statistics. Keep only the large CEO image, as in the current design.

## Contact

`GET /pages/contact`

```ts
type ContactPage = {
  hero: Banner; // campaign/fashion image, never a CEO image
  heading: string;
  introduction: string;
  methods: { type: "whatsapp" | "phone"; label: string; value: string; href: string }[];
  form: {
    enabled: boolean;
    subjects: { value: string; label: string }[];
    maxMessageLength: number; // 3000
  };
};
// Response: { data: ContactPage }
```

`POST /contact/messages`

```json
{
  "name": "Customer name",
  "email": "customer@example.com",
  "subject": "sizing_fit",
  "message": "Can you help me choose a size?"
}
```

Subject enum: `product_enquiry`, `sizing_fit`, `delivery_enquiry`, `general_enquiry`. Name is trimmed and required, maximum 100 characters; email required and validated, maximum 254; message trimmed and required, maximum 3000. Validate on the server, rate-limit submissions and never return the submitted message in public responses.

When configured, HTTP 202:

```json
{ "data": { "reference": "msg_example", "status": "accepted" } }
```

Accepted means queued/received, not email delivered. Until a recipient and email service are configured, leave the frontend in preview mode; attempted API submission returns HTTP 503 with code `CONTACT_UNAVAILABLE`. WhatsApp and calls can work independently.

## Cart

`GET /cart` and every successful cart mutation return `{ data: Cart }`:

```ts
type Money = { amount: number; currency: "GHS" };
type Cart = {
  id: string;
  items: {
    id: string;
    productId: string;
    variantId: string;
    name: string;
    image: ImageAsset;
    size: string;
    color: { id: string; name: string; hex: string };
    quantity: number;
    unitPrice: Money;
    lineTotal: Money;
    available: boolean;
  }[];
  itemCount: number; // sum of quantities
  subtotal: Money;
  deliveryFee: Money | null; // unknown until delivery selection
  total: Money | null; // unknown until all charges are resolved
  checkoutAvailable: boolean;
};
```

- `POST /cart/items`: `{ "variantId": "classic-wrap-blue-10", "quantity": 1 }`. Add quantity, merging the same variant into one line.
- `PATCH /cart/items/{lineId}`: `{ "quantity": 2 }`. Set absolute quantity.
- `DELETE /cart/items/{lineId}`: remove line; return updated cart.
- Quantity must be an integer from 1 to the lower of available stock and 99. Remove through DELETE rather than quantity zero.
- Reject unavailable variants with HTTP 409, code `OUT_OF_STOCK`. Recalculate all totals on the server. A cart does not reserve stock.
- Protect cookie-authenticated mutations against CSRF. Scope every cart lookup/mutation to the current session/user.
- Reconcile existing local-storage lines by product ID, size and color to real variant IDs during migration. Use an explicit, idempotent guest-cart import/merge operation if preserving existing browser carts is required.

## Wishlist

`GET /wishlist` → `{ "data": { "items": Product[], "count": 0 } }` (count reflects returned items).

`PUT /wishlist/items/{productId}` and `DELETE /wishlist/items/{productId}` have no request body and return the updated wishlist. Store products, not size/color variants. Scope to the current guest/user session. Saved products may be out of stock; allow removal and show their availability.

## Reviews and newsletter

`GET /reviews?featured=true&limit=3` → `{ "data": Review[], "summary": { "averageRating": null, "total": 0 } }`, with a real average when reviews exist. Limit to approved, published records. This endpoint's summary describes all published store reviews, not just the featured subset. Home embeds the same summary and initial three featured reviews.

`POST /newsletter/subscriptions`

```json
{ "email": "customer@example.com" }
```

When the mailing service is configured, return HTTP 202: `{ "data": { "status": "accepted" } }`. This acknowledges the request without revealing whether an address was already subscribed. Record signup source and consent timestamp server-side. Use explicit signup wording in the form. Until connected, keep preview mode and return HTTP 503 `NEWSLETTER_UNAVAILABLE` for attempted submissions. Never claim a preview email was subscribed.

## Errors

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields.",
    "fields": { "email": ["Enter a valid email address."] },
    "requestId": "req_example"
  }
}
```

Use 400 for invalid cursor/query format, 401 for authentication-required operations, 403 for forbidden operations, 404 for missing resources, 409 for stock/conflict, 422 for field validation, 429 for rate limits and 503 for unconfigured/unavailable services. Never include stack traces or secrets. Bind cursors to their filters and return a clear invalid-cursor error if mismatched. Frontend should offer retry on fetch failures and retain already-loaded items.

## Customer accounts, checkout and payment

These contracts support the existing account and checkout dialogs once integrated. No payment provider has been chosen. The concrete shapes below complete the responsibilities in this table.

| Endpoint | Request / response responsibility |
| --- | --- |
| `GET /me` | Signed-in customer profile; 401 for guest |
| Auth endpoints | Concrete account contract below; support guest checkout independently |
| `POST /checkout/quote` | Receive cart and Ghana delivery address; return server-calculated items, delivery, charges, total and expiring quote ID |
| `POST /orders` | Receive quote ID, customer name/email/phone and delivery details; revalidate price and stock; return order ID, reference, totals and `pending_payment` status |
| `POST /orders/{id}/payment-attempts` | Receive supported method (`mobile_money` or `card`) and allowed provider-specific fields; return attempt ID and provider redirect/action |
| `GET /orders/{id}` | Owner-scoped order details and server-confirmed payment/fulfilment status |
| Provider webhook | Verify provider signature and amount/currency; update payment/order status idempotently |

Use an `Idempotency-Key` for order creation and payment-attempt creation to prevent duplicate charges/orders on retries. Never accept client totals as authoritative or mark an order paid from a browser redirect. Guest order access requires a scoped secure session/token, not just a guessable order ID. Concrete shapes and proposed stock policy follow.

### Shared account and order types

```ts
type ID = string; // opaque stable identifier
type DateTime = string; // ISO 8601 UTC
type Address = { address: string; city: string; region: string; country: "GH" };
type Customer = {
  id: ID; name: string; email: string; emailVerified: boolean;
  phone: string | null; deliveryAddress: Address | null;
  createdAt: DateTime; updatedAt: DateTime; version: number;
};
type PaymentStatus = "pending" | "paid" | "failed" | "partially_refunded" | "refunded";
type FulfilmentStatus = "awaiting_payment" | "processing" | "shipped" | "delivered" | "cancelled";
type Order = {
  id: ID; reference: string; customerId: ID | null;
  customer: { name: string; email: string; phone: string };
  deliveryAddress: Address;
  items: {
    id: ID; productId: ID; variantId: ID; name: string;
    image: ImageAsset | null; color: string; size: string; quantity: number;
    unitPrice: Money; lineTotal: Money;
  }[];
  subtotal: Money; deliveryFee: Money; total: Money;
  paymentStatus: PaymentStatus; fulfilmentStatus: FulfilmentStatus;
  tracking: { carrier: string; number: string; url: string | null } | null;
  createdAt: DateTime; updatedAt: DateTime; version: number;
};
type Page<T> = {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};
type CursorPage<T> = {
  data: T[];
  pagination: { total: number; nextCursor: string | null; hasMore: boolean };
};
```

Order contact, delivery, product names, variant labels and prices are purchase snapshots. Editing/deleting a profile or product must not rewrite them. No customer response includes password hashes, staff permissions, raw inventory or other customers' information.

### Authentication and profiles

Proposed browser transport: Secure, HttpOnly cookie sessions with CSRF protection. `GET /auth/csrf` returns `{ data: { csrfToken: string } }`; send `X-CSRF-Token` on writes, including login, and refresh after session rotation. This endpoint establishes an anonymous session cookie if absent; `GET /cart` and `GET /wishlist` also initialize empty guest state if necessary. Cross-origin deployments require explicit allowed origins and credentialed requests.

| Method and endpoint | Request body | Success (`data` unless 204) |
| --- | --- | --- |
| `POST /auth/register` | `{ name, email, password }` | 202 `{ status: "verification_pending" }`, generic acknowledgement |
| `POST /auth/email-verifications` | `{ token }` | 200 `{ status: "verified" }` |
| `POST /auth/email-verification-requests` | `{ email }` | 202 `{ status: "accepted" }`, regardless of account existence |
| `POST /auth/sign-in` | `{ email, password }` | 200 `Customer`, rotate session cookie |
| `POST /auth/sign-out` | None | 204, invalidate session |
| `POST /auth/password-reset-requests` | `{ email }` | 202 `{ status: "accepted" }`, regardless of account existence |
| `POST /auth/password-resets` | `{ token, password }` | 200 `{ status: "password_reset" }`, revoke existing sessions |
| `GET /me` | None | 200 `Customer`; 401 for guest |
| `PATCH /me` | Partial `{ name, phone, deliveryAddress }`, `If-Match` | 200 `Customer` |
| `POST /me/email-change-requests` | `{ email, currentPassword }` | 202 `{ status: "verification_pending" }` |
| `POST /me/email-changes` | `{ token }` | 200 `Customer`, after verification |
| `GET /me/orders?limit=10&cursor=...` | None | 200 `CursorPage<Order>` |
| `GET /orders/{id}` | None | 200 `Order`, customer owner or scoped guest session |

Name: trimmed 1–100 characters; valid email max 254; phone max 25, normalized server-side; address max 250; city/region max 100. Optional profile fields use null. Checkout requires all contact/address fields. Proposed password limit: 8–128 characters, never trim; policy changes must be agreed with the frontend. Confirmation-password stays client-side. Never accept role, verification flags or customer IDs from registration/profile writes. Reset/verification tokens expire and are single use. Login failures are generic and rate limited; unverified login returns 403 `EMAIL_VERIFICATION_REQUIRED`.

The preview's editable profile email must use the verified email-change flow above. Customer sign-in merges guest cart/wishlist once: union wishlist IDs, combine matching cart variants, cap quantities at stock/99, and return optional cart `adjustments: { variantId: ID; requestedQuantity: number; quantity: number; reason: "quantity_reduced" | "unavailable" }[]`. Sign-out detaches account state and starts a fresh guest session; frontend sign-out copy must reflect that account cart data is not exposed to the next browser user.

### Checkout and payments: concrete payloads

`POST /checkout/quote` → 200 `{ data: Quote }`:

```json
{
  "cartId": "cart_example",
  "customer": { "name": "Example Customer", "email": "customer@example.com", "phone": "+233240000000" },
  "deliveryAddress": { "address": "Street or GhanaPost GPS", "city": "Accra", "region": "Greater Accra", "country": "GH" },
  "paymentMethod": "mobile_money"
}
```

```ts
type Quote = {
  id: ID; cartId: ID; expiresAt: DateTime;
  customer: Order["customer"]; deliveryAddress: Address; items: Order["items"];
  subtotal: Money; deliveryFee: Money; total: Money;
  paymentMethod: "mobile_money" | "card";
};
type PaymentAttempt = {
  id: ID; orderId: ID; status: "pending" | "succeeded" | "failed";
  expiresAt: DateTime;
  action: { type: "redirect"; url: string } | { type: "none" };
};
```

Quotes check ownership, prices, publication and stock, but do not reserve inventory. Return 503 `DELIVERY_UNAVAILABLE` if delivery fees cannot be calculated. No invented zero delivery fee. Quote totals include all charges; coupons/taxes/surcharges require an agreed extension before being introduced.

`POST /orders`, header `Idempotency-Key`, body `{ "quoteId": "quote_example" }` → 201 `{ data: Order }`. Atomically revalidate quote expiry, prices, cart contents, publication and stock; reserve inventory and snapshot contact/address/items. Initial statuses: `pending` and `awaiting_payment`. Return 409 `QUOTE_EXPIRED`, `QUOTE_STALE` or `OUT_OF_STOCK` on conflict; client gets a fresh quote and confirms changed totals. Remove purchased cart quantities atomically without clearing later additions.

Proposed reservation policy, requiring backend/business agreement: reserve pending-order stock for 15 minutes. Expiry cancels unpaid orders and releases stock exactly once. Failed payment attempts may retry before expiry. A late payment after expiry enters reconciliation/refund handling; it must never silently oversell.

`POST /orders/{id}/payment-attempts`, header `Idempotency-Key`, body `{ "method": "mobile_money", "returnUrl": "https://store.example/payment-return" }` → 201 `{ data: PaymentAttempt }`. `method` also accepts `card`. `GET /orders/{id}/payment-attempts/{attemptId}` → 200 the same shape. Both require order ownership or scoped guest access. Allowlist return URLs; collect financial credentials through the chosen provider's hosted flow. No raw card fields in this API.

`POST /payments/webhooks/{provider}` uses the provider's body/signature and returns 204 after durable acceptance. Verify signature, transaction identity, amount and currency; deduplicate events and update payment/inventory atomically. Browser redirects never mark an order paid. Confirmed payment commits reserved stock and moves an eligible order to processing. No admin endpoint arbitrarily marks payment paid.

Require idempotency on order/payment creation and additive `POST /cart/items`. Retain successful key/body/results for at least 24 hours, scoped to principal/session and endpoint. Same key/body returns the original status/body; changed body returns 409 `IDEMPOTENCY_CONFLICT`. Enforce one order per quote even with different keys. An already pending payment attempt returns 409 `PAYMENT_IN_PROGRESS` with its ID; paid orders reject further attempts.

### Product review submission

| Endpoint | Request | Success |
| --- | --- | --- |
| `GET /products/{slug}/reviews?limit=10&cursor=...` | Public | 200 `CursorPage<Review>` plus `summary: { averageRating: number or null, total: number }` |
| `POST /products/{productId}/reviews` | `{ displayName, rating, title, body }`, customer login | 201 `{ data: { id, status: "pending" } }` |

Display name 1–100, rating integer 1–5, title 1–120, body 1–2000 characters. One review per customer/product; duplicate returns 409 `REVIEW_EXISTS`. Backend derives verifiedPurchase from paid order lines; ignore client verification flags. Only approved reviews enter public ratings. The anonymous preview form needs sign-in before real submission.

## Admin API

All admin endpoints require server-verified staff permissions and `Cache-Control: no-store`. Demo sessions/hidden controls are not authorization. Proposed permission matrix:

| Role | Permissions |
| --- | --- |
| `owner` | All permissions below, plus `settings:write`, `staff:manage`, `customers:delete` |
| `catalog` | `dashboard:read`, `catalog:read`, `catalog:write`, `content:read`, `content:write`, `reviews:moderate` |
| `fulfilment` | `dashboard:read`, `orders:read`, `orders:write`, `customers:read`, `customers:write` |

Backend returns effective permissions; frontend hides unauthorized actions. Dashboard must return `recentOrders: []` without `orders:read` so catalog staff do not receive customer contact data.

### Staff sessions

```ts
type Staff = {
  id: ID; name: string; email: string;
  role: "owner" | "catalog" | "fulfilment";
  permissions: string[]; mfaEnabled: boolean;
};
```

| Endpoint | Request | Success (`data`) |
| --- | --- | --- |
| `POST /admin/auth/sign-in` | `{ email, password }` | 200 `{ status: "mfa_required", challengeId, expiresAt }`; no staff session yet |
| `POST /admin/auth/mfa` | `{ challengeId, code }` | 200 `Staff`, set/rotate staff session |
| `GET /admin/auth/me` | None | 200 `Staff`, or 401 |
| `POST /admin/auth/sign-out` | None | 204, revoke staff session |

MFA codes are strings; challenges expire in 5 minutes, are single use and rate limited. MFA enrolment/recovery and invitation acceptance depend on the chosen auth provider and must be specified before staff activation. Use a separate staff session from customer/guest sessions. Public registration/reset endpoints cannot create or reset staff credentials.

### Page map

| Admin screen / action | Endpoints |
| --- | --- |
| Overview `/admin` | `GET /admin/dashboard` |
| Product list and inventory cards | `GET /admin/products` |
| Product details modal / direct URL | `GET /admin/products/{id}` |
| Create/edit wizard | `POST /admin/assets`, `POST /admin/products`, `PATCH /admin/products/{id}` |
| Activate/deactivate/delete | `PATCH /admin/products/{id}`, `DELETE /admin/products/{id}` |
| Categories/collections | Taxonomy CRUD below |
| Orders table/details | `GET /admin/orders`, `GET /admin/orders/{id}` |
| Customers list/view/edit/delete | Customer CRUD below |
| Store content | Content endpoints below; editing UI is future work |
| Settings/staff | Settings/staff endpoints below; current UI is informational |

### Admin pagination, dates and concurrency

Admin lists use `page=1&pageSize=8`, max pageSize 100, and `Page<T>`. Default sort is `createdAt:desc` with ID tie-breaker; products/customers also allow `name:asc`, and products/customers/orders allow `createdAt:asc`. Taxonomy/staff default to name ascending. Filters apply before pagination. Empty results: total/totalPages 0, data empty; requesting a positive page beyond the end returns an empty list. Frontend clamps/refetches after deletion.

Products/customers/orders/dashboard accept optional `createdFrom` and `createdTo` as `YYYY-MM-DD`. Inclusive calendar dates use store timezone `Africa/Accra`; convert to `[start of from, start of day after to)`. Reject invalid/reversed ranges with 422. No sample-relative dates.

Mutable admin resources and customer profiles include integer `version` and an ETag such as `"7"`. PATCH/DELETE require `If-Match: "7"`. Missing header: 428 `PRECONDITION_REQUIRED`; stale version: 412 `VERSION_CONFLICT`. Successful edits increment version; creates start at 1. Arrays replace completely, omitted fields remain unchanged, null is valid only where documented. Log actor, action, resource and timestamp without credentials. All writes are transactional.

### Products and inventory

Read permission `catalog:read`; writes/uploads/taxonomy writes `catalog:write`.

```ts
type AdminProductResource = Omit<Product, "variants"> & {
  status: "draft" | "active" | "inactive";
  variants: {
    id: ID; colorId: ID; size: string; stock: number;
    reservedStock: number; availableStock: number; inStock: boolean;
  }[];
  stock: number; reservedStock: number; availableStock: number;
  createdAt: DateTime; updatedAt: DateTime; version: number;
};
type ProductWrite = {
  name: string; slug?: string; description: string;
  price: Money; categoryId: ID; collectionIds: ID[]; imageIds: ID[];
  colors: { id: ID; name: string; hex: string; imageIds: ID[] }[];
  variants: { id?: ID; colorId: ID; size: string; stock: number }[];
  status: "draft" | "active" | "inactive";
};
```

`Product` is the public product JSON resource defined earlier. `images` is ordered, cover first; color imageIds reference that same asset set. Public `collections` contains stable collection IDs. Public variants expose availability, never inventory quantities. Optional product read/write additions: `fitAndCare: string | null`, `deliveryAndReturns: string | null`; return null until copy is approved.

| Endpoint | Request | Success |
| --- | --- | --- |
| `GET /admin/products` | `q, categoryId, stock, status, createdFrom, createdTo, sort, page, pageSize` | 200 `Page<AdminProductResource>` plus summary below |
| `GET /admin/products/{id}` | None | 200 `{ data: AdminProductResource }` |
| `POST /admin/products` | `ProductWrite` | 201 `{ data: AdminProductResource }`, Location header |
| `PATCH /admin/products/{id}` | Partial `ProductWrite`, If-Match | 200 updated product |
| `DELETE /admin/products/{id}` | If-Match | 204; soft delete, preserve order history |

Search `q` matches name/ID. Stock filter: `out` means availableStock = 0; `low` means 1–3; `available` means >3; omitted means all. Category/status are exact IDs/enums. `summary: { all: number; outOfStock: number; lowStock: number }` applies search/category/status/date but excludes the stock filter. Pagination total includes every filter. Total stock sums variants.

Create request example:

```json
{
  "name": "Champagne Skirt Two Piece",
  "slug": "champagne-skirt-two-piece",
  "description": "Corporate two-piece outfit.",
  "price": { "amount": 22000, "currency": "GHS" },
  "categoryId": "two-pieces",
  "collectionIds": ["new-arrivals"],
  "imageIds": ["asset_champagne"],
  "colors": [{ "id": "champagne", "name": "Champagne", "hex": "#c9a37b", "imageIds": ["asset_champagne"] }],
  "variants": [{ "colorId": "champagne", "size": "10", "stock": 3 }],
  "status": "draft"
}
```

Color IDs are stable product-scoped keys. Variant IDs are globally unique server-generated IDs used by cart/orders. Include existing variant IDs on updates; omitted ID creates a variant. Never regenerate IDs on label or stock changes. Replaced arrays retire omitted variants without deleting historical references; reserved variants cannot be removed or redefined (409 `VARIANT_RESERVED`).

`stock` is physical on-hand units including reservations; `availableStock = stock - reservedStock`. Confirmed payment decrements stock and reservedStock exactly once. Admin stock writes are absolute and may not reduce stock below reservedStock. Checkout and admin inventory writes must serialize and advance product version to prevent lost updates. The current wizard needs no separate inventory endpoint.

Validate name 1–150, description max 3000, positive integer price <=100000000 pesewas, integer quantities 0–1000000, valid six-digit hex, unique color names case-insensitively, unique color/size pairs and nonempty size strings max 32. Each color requires a size. Slugs are unique lowercase hyphenated strings, generated if omitted on create. All referenced assets/taxonomy must exist in this store. Active products require an active category, active assigned collections, a cover image and at least one variant; zero stock remains visible as sold out.

Draft/inactive/deleted products disappear from all public catalog sources and return 404 on direct public reads. Retain unavailable cart lines for removal. Exclude hidden products from public wishlist payloads, including photos/descriptions. Newly created active products must appear through the backend, independent of browser preview visibility.

### Image uploads

`POST /admin/assets`, multipart fields `file` and optional `alt`, returns 201:

```json
{ "data": { "id": "asset_example", "url": "https://cdn.example/product.webp", "alt": "Product photo", "mimeType": "image/webp", "bytes": 120000, "width": 1200, "height": 1600 } }
```

Accept JPEG/PNG/WebP, max 5 MiB (5242880 bytes). Validate decoded content, re-encode safely and use server-owned URLs. Return 413 `FILE_TOO_LARGE` or 415 `UNSUPPORTED_MEDIA_TYPE`. Writes use asset IDs, never local paths/data URLs/arbitrary remote URLs. Garbage-collect unused uploads after 24 hours; retain referenced assets.

### Categories and collections

```ts
type TaxonomyResource = {
  id: ID; kind: "category" | "collection"; name: string; slug: string;
  description: string; status: "active" | "draft"; image: ImageAsset | null;
  assignedProductCount: number; createdAt: DateTime; updatedAt: DateTime; version: number;
};
type TaxonomyWrite = {
  name: string; slug: string; description: string;
  status: "active" | "draft"; imageId?: ID | null;
};
```

For `{kind}` = `categories` or `collections`:

| Endpoint | Request | Success |
| --- | --- | --- |
| `GET /admin/{kind}` | `q, status, page, pageSize` | 200 `Page<TaxonomyResource>` |
| `GET /admin/{kind}/{id}` | None | 200 taxonomy resource |
| `GET /admin/{kind}/{id}/products` | `page, pageSize` | 200 `Page<AdminProductResource>` for modal assignments |
| `POST /admin/{kind}` | `TaxonomyWrite` | 201 taxonomy resource |
| `PATCH /admin/{kind}/{id}` | Partial `TaxonomyWrite`, If-Match | 200 taxonomy resource |
| `DELETE /admin/{kind}/{id}` | If-Match | 204 |

Name/slug 1–100, unique case-insensitively within kind; description max 3000; slugs lowercase hyphenated. Category deletion is blocked while any non-deleted product is assigned, including drafts (409 `CATEGORY_IN_USE`). Collection deletion detaches memberships atomically. Setting taxonomy to draft is blocked while active products reference it (409 `TAXONOMY_IN_USE`). Reassign/deactivate first.

Public `GET /categories` exposes active records only; derive `coming_soon` when no active products exist, never expose admin drafts. Add public `GET /collections` → `{ data: { id, name, slug, description, image }[] }` for active collections. Assignment counts include non-deleted products regardless of product status.

### Orders

Reads require `orders:read`. Fulfilment writes require `orders:write`; their UI controls are future work.

| Endpoint | Request | Success |
| --- | --- | --- |
| `GET /admin/orders` | `q, paymentStatus, fulfilmentStatus, customerId, createdFrom, createdTo, sort, page, pageSize` | 200 `Page<Order>` |
| `GET /admin/orders/{id}` | None | 200 `{ data: Order }` |
| `PATCH /admin/orders/{id}/fulfilment` | `{ fulfilmentStatus, tracking? }`, If-Match | 200 updated Order |

Search matches reference, customer name/email and snapshot item names. Use machine enums, not display labels. Paid orders move `processing → shipped → delivered`; shipping requires carrier/number (max 100 each) and optional HTTPS tracking URL. Allow unpaid `awaiting_payment → cancelled`, releasing reservations once. Reject paid cancellation with 409 `REFUND_REQUIRED` until refund workflow is specified. Invalid transitions return 409 `INVALID_ORDER_TRANSITION`. No order deletion endpoint. Payment statuses come from payment processing, never fulfilment edits.

### Customers

```ts
type AdminCustomerResource = Customer & { orderCount: number; city: string | null };
```

| Endpoint | Request / permission | Success |
| --- | --- | --- |
| `GET /admin/customers` | `q, createdFrom, createdTo, sort, page, pageSize`; customers:read | 200 `Page<AdminCustomerResource>` |
| `GET /admin/customers/{id}` | customers:read | 200 customer resource |
| `PATCH /admin/customers/{id}` | Partial `{ name, email, phone, city }`, If-Match; customers:write | 200 updated customer |
| `DELETE /admin/customers/{id}` | If-Match; owner/customers:delete | 204 |

Search name/email/city. Fields use customer-form limits; duplicate email returns 409 `EMAIL_IN_USE`. History comes from `/admin/orders?customerId={id}`, not unbounded orderIds. `orderCount` counts historical orders. City updates deliveryAddress.city if an address exists; otherwise keep a separate profile city without fabricating address details.

Staff email edits change a contact record, not login identity/verification. Backend must separate these or reject staff email edits with 409 `CUSTOMER_VERIFICATION_REQUIRED`; authentication email changes require the verified customer flow. Deletion deactivates/anonymizes the profile per agreed retention rules, revokes sessions and retains required order snapshots. Business/backend must define retention durations; do not cascade-delete orders.

### Dashboard

`GET /admin/dashboard?createdFrom=2026-10-01&createdTo=2026-10-31`, permission `dashboard:read`, returns `{ data: Dashboard }`:

```ts
type Dashboard = {
  period: {
    createdFrom: string | null; createdTo: string | null; timezone: "Africa/Accra";
    salesFrom: string; salesTo: string; salesGranularity: "day" | "month";
  };
  generatedAt: DateTime;
  stats: { paidRevenue: Money; paidOrders: number; orders: number; catalogStyles: number; stockAttention: number };
  sales: { date: string; revenue: Money; paidOrders: number }[];
  orderStatuses: { status: FulfilmentStatus; count: number }[];
  topProducts: { productId: ID; name: string; image: ImageAsset | null; unitsSold: number; revenue: Money }[];
  recentOrders: Order[]; // newest 5; [] without orders:read
};
```

To match current date behavior, orders/revenue/top products use orders CREATED in the selected range, paid at read time. Paid revenue sums paid order totals including delivery; refunded/partially-refunded orders are excluded from this initial paid-only metric. This is an operational sales metric, not an accounting report. Sales buckets group the same orders by creation date and sum to paidRevenue. Top products sum paid line quantities/revenue, exclude delivery, rank units descending with ID tie-breaker, top 4.

Catalog counts use non-deleted products created in the selected range; stock attention counts those with current availableStock <=3. Include zero-count fulfilment statuses; counts sum to orders. Zero-fill sales dates. Omitted sales boundaries resolve from first order through today (empty store: today); return effective salesFrom/salesTo. Use monthly buckets when the effective interval exceeds 366 days, otherwise daily; date is bucket-start date. All metrics use the same snapshot. Frontend must replace the separately invented chart series with this data.

### Store content and review moderation

These prepare the informational admin sections for future editor controls. Page reads use `content:read`, writes `content:write`; moderation `reviews:moderate`.

| Endpoint | Request / success |
| --- | --- |
| `GET /admin/pages/{key}` | 200 `{ data: { key, content, updatedAt, version } }`; key = home/shop/about/contact |
| `PATCH /admin/pages/{key}` | `{ content }`, If-Match; 200 updated document |
| `GET /admin/site` | Owner; 200 `{ data: { content: SiteConfig, updatedAt, version } }` |
| `PATCH /admin/site` | Owner; `{ content: SiteConfig }`, If-Match; 200 updated document |
| `GET /admin/reviews` | `status=pending|approved|rejected`, productId, page, pageSize; 200 `Page<AdminReview>` |
| `PATCH /admin/reviews/{id}` | `{ status: "approved" or "rejected", featured?: boolean }`, If-Match; 200 updated review |

`SiteConfig` is the GET /site data shape above. Page `content` uses the corresponding public page shape, with these write substitutions: images become `{ assetId, alt }`; home featuredProducts becomes `featuredProductIds: ID[]`; upcomingCategories becomes `upcomingCategoryIds: ID[]`; home reviews becomes `{ reviewIds: ID[] }`. Server derives review totals/averages. Other fields retain their public shape. Backend expands references on reads and filters unpublished resources; admin reads use the same write shape so forms round-trip. No arbitrary HTML/script fields. Validate links as storefront-relative paths or approved HTTPS destinations; tel/mailto only for contacts. Feature flags cannot enable unavailable services. Saves publish atomically and invalidate public caches; draft publication/history is future scope.

`AdminReview = Review & { productId: ID; customerId: ID; status: "pending" | "approved" | "rejected"; featured: boolean; updatedAt: DateTime; version: number }`. Only approved reviews can be featured. Moderation cannot change verifiedPurchase. Public reviews never expose customerId. Do not seed sample testimonials as verified purchases.

### Settings and staff management

Owner-only; current screen is informational. Connection statuses never contain credentials.

```ts
type Settings = {
  storeName: string; currency: "GHS"; timezone: "Africa/Accra";
  contact: { whatsapp: string | null; phone: string | null; email: string | null };
  connections: {
    service: "authentication" | "catalog" | "payments" | "email";
    status: "configured" | "unavailable";
  }[];
  version: number;
};
type StaffResource = Staff & { status: "active" | "disabled"; version: number };
```

| Endpoint | Request | Success |
| --- | --- | --- |
| `GET /admin/settings` | None | 200 Settings |
| `PATCH /admin/settings` | Partial `{ storeName, contact }`, If-Match | 200 Settings |
| `GET /admin/staff` | page, pageSize | 200 `Page<StaffResource>` |
| `POST /admin/staff/invitations` | `{ email, role: "catalog" or "fulfilment" }` | 201 `{ id, email, role, status: "pending", expiresAt }` |
| `PATCH /admin/staff/{id}` | `{ role?: "catalog" or "fulfilment", status?: "active" or "disabled" }`, If-Match | 200 StaffResource |

Currency/timezone/connections are read-only in this version. Settings storeName/contact and site name/contact update the same underlying fields atomically; invalidate both versions/caches. Owner provisioning/transfer is operator-controlled; these staff APIs cannot disable/demote an owner. Disabling staff revokes sessions immediately. Invitation acceptance/MFA enrolment require the chosen provider flow before implementation.

## Backend acceptance criteria and integration notes

- Every read/write is scoped to principal and store. Another customer's resource returns 404. Admin 401 means no staff session; 403 means missing permission.
- Reject unknown writable fields with 422, including browser-supplied totals, roles and verification flags. Validate references server-side. Never trust frontend stock/permissions.
- Resource creates return 201 (Location where a resource GET exists), reads/updates 200, asynchronous acknowledgements 202, deletes/sign-out 204 except cart/wishlist mutations that explicitly return updated state.
- Use the shared error envelope above and indexed paths such as `variants.0.stock`. Add `PRECONDITION_REQUIRED` (428), `VERSION_CONFLICT` (412), `FILE_TOO_LARGE` (413), `UNSUPPORTED_MEDIA_TYPE` (415). Unexpected failures use 500 `INTERNAL_ERROR`; include requestId, never stack traces. 429 includes Retry-After.
- Invalidate public catalog/content/rating caches after relevant admin writes and stock/payment changes. Cart/checkout revalidate publication/stock regardless of cached cards. Private/admin responses must stay outside shared/service-worker caches.
- Public visibility rules apply consistently to home, shop, recommendations, direct product reads and wishlist. Unavailable cart lines remain removable and block checkout. No new backend product should require a frontend static-catalog edit to appear.
- Frontend adapters must convert current major-unit prices to integer pesewas; grouped color/size rows to stable purchasable variants; empty optional strings to null; UI payment/status labels to machine enums. Preserve opaque IDs from responses. Skeletons, dialogs, wizard steps and list/grid toggles require no dedicated endpoints.
- Existing local cart migration, if required: `POST /cart/import` with Idempotency-Key and `{ items: { productId, colorId, size, quantity }[] }` → updated Cart with adjustments. Resolve legacy color names through an explicit migration map; reject ambiguous mappings with 422. Never guess variant IDs. This import is optional rollout work, not the normal add-item API.
- Do not migrate invented orders/customers/revenue/stock or sample testimonials as real production data. Deliberately map static catalog IDs and approved assets only.
- Backend handoff deliverables: OpenAPI 3.1 matching the agreed contract, staging base URL, cookie/CORS/CSRF settings, fixtures and test accounts per role. Cover empty lists, sold-out combinations, stale edits, hidden products, reservation expiry, payment retries and duplicate webhooks.

## Decisions to confirm before production

1. Authentication provider, verification delivery, staff enrolment/recovery and deployment origins.
2. Payment provider/hosted flow, refund/late-payment reconciliation and approval of the proposed 15-minute stock reservation.
3. Ghana delivery rates/coverage and returns policy; checkout remains disabled until real quotes are available.
4. Customer retention/erasure rules, review eligibility/moderation ownership and final role permissions.
5. Publication ownership, business email and initial catalog/asset migration. Example prices are catalog examples, not permanent category-wide rules.

Suggested delivery sequence: sessions/permissions and uploads → taxonomy/products/public catalog → customer/cart/wishlist → quotes/orders/payments/webhooks → dashboard/customer operations → content/reviews/staff tools. Real checkout requires verified payment reconciliation and reservation expiry together.
