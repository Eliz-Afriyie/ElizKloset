# ElizKloset

A corporate fashion storefront and staff management portal built with Next.js 16, React 19, and TypeScript. The interface uses ElizKloset's burgundy, cream, and gold branding and connects to a separate backend API.

## Local setup

Requires Node.js 20.9 or newer and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The storefront is at `/`; staff sign-in is at `/admin/login`.

To use another port, run `npm run dev -- --port 3100`.

## Environment variables

Create an optional `.env.local` in the project root to override the defaults:

```dotenv
STORE_API_ORIGIN=https://elizkloset.onrender.com
ADMIN_API_BASE_URL=https://elizkloset.onrender.com/api/v1
```

| Variable | Purpose |
| --- | --- |
| `STORE_API_ORIGIN` | Backend origin for customer authentication and public store requests. Do not append `/api/v1`; the proxy selects the appropriate path. |
| `ADMIN_API_BASE_URL` | Backend API base for staff requests, including `/api/v1`. Do not append `/admin`; the proxy adds it. |

These variables are server-only. Keep environment files and credentials out of Git. Restart the server after changing them.

## Storefront

- Live products, categories, collections, published reviews, and variant availability.
- Product search overlay, server filtering and sorting, and cursor pagination.
- Product details dialogs and direct product links.
- Shopping bag and account-scoped saved styles stored on the current device.
- Customer sign-in, registration, verification, password reset, and profile updates.
- Account menu with profile, Orders, and confirmed sign-out actions.
- Sign-in required before saving styles or proceeding toward checkout.
- Contact and newsletter forms enabled through backend feature settings.
- Responsive layouts, skeleton loaders, tooltips, and dismissible service-error toasts with Retry.
- PWA manifest, installation assets, and a static offline fallback. The service worker does not cache API responses or account pages.

## Admin portal

- Staff sign-in and OTP verification when required by the backend.
- OTP resend through a fresh sign-in request with password confirmation; the current API has no dedicated staff resend endpoint.
- Collapsible navigation and permission-based management sections.
- Dashboard metrics, sales charts, date filters, and recent orders.
- Product, variant, stock, category, collection, and image management.
- Order details and fulfilment updates with carrier and tracking information.
- Customer records, content publishing, review moderation, settings, and staff management.

Admin fulfilment uses `processing`, `shipped`, `delivered`, and `cancelled`. The interface also recognises `awaiting_payment`. Payment status is separate: accepting a paid order means moving it to `processing`; marking it `delivered` completes fulfilment.

## Integration limits

- **Checkout and payments are unavailable.** The current API does not provide the customer checkout/payment flow. Adding items to the bag does not create an order.
- **Customer order history needs backend support.** `/orders` has sign-in protection and an availability message. The API currently exposes staff order endpoints only.
- **Optional-email registration needs backend support.** The frontend accepts registration without email, but the documented backend schema still requires it. Phone sign-in and verification also depend on backend support.
- Bag and wishlist contents are not synchronised across devices.
- Expired customer sessions require signing in again; automatic token refresh is not implemented.
- Image uploads depend on the backend storage service being configured and available.
- Authored hero and About content remain in the frontend. Admin content publishing does not yet replace those branded sections.

No sample catalog is injected when the API is empty or unavailable. Live functionality depends on backend availability, data, and permissions.

## API architecture

The browser calls Next.js route handlers at `/api/store/*` and `/api/admin/*`. They forward allowed requests to the backend and keep bearer tokens in HttpOnly cookies. Customer and staff authentication use separate proxy flows. Production hosting requires HTTPS for secure session cookies.

The backend is maintained separately; this repository does not contain its server or database.

## Project structure

```text
app/
  components/       Storefront UI, authentication, overlays, loaders, and toasts
  lib/              Customer API adapters, catalog models, and shopping state
  api/store/        Customer and public-store API proxy
  api/admin/        Staff API proxy
  admin/            Staff routes, components, API adapters, and styles
  shop/             Filterable catalog
  products/[slug]/  Direct product pages
  cart/             Shopping bag
  wishlist/         Saved styles
  orders/           Customer orders page awaiting backend integration
public/             Images, icons, and service worker
tests/             Automated checks and isolated browser fixtures
```

## Checks

```sh
npm run lint
npx tsc --noEmit
node --test tests/admin-api.test.cjs tests/admin-resources.test.cjs tests/admin-otp.test.cjs tests/admin-taxonomy.test.cjs tests/admin-ui.test.cjs tests/store-api.test.cjs
npm run build
```

Optional browser checks use an isolated Microsoft Edge session on Windows and intercept API calls with fixtures. They do not create live accounts or modify store records. Start the frontend on port 3100, then run:

```sh
node tests/store-browser-check.cjs
node tests/admin-browser-check.cjs
node tests/admin-browser-check.cjs --login
```

Set `STORE_CHECK_URL` or `ADMIN_CHECK_URL` to use a different local URL. Admin checks also support `ADMIN_CHECK_BROWSER` for the browser executable. Screenshots go to the Git-ignored `.admin-checks/` directory.

## Production

```sh
npm ci
npm run build
npm run start
```

Use a host that supports the Next.js server runtime and route handlers; the app requires more than static file hosting. Configure the backend variables in the hosting environment and use HTTPS. Builds need access to Google Fonts for the existing `next/font` configuration.

## Backend handoff documents

- [Admin integration](ADMIN-INTEGRATION.md)
- [Customer integration](CUSTOMER-INTEGRATION.md)
- [Customer orders API proposal](CUSTOMER-ORDERS-API.md)
- [API contract and handoff](API-CONTRACT.md)
- [Saved OpenAPI snapshot](backend-openapi.json)

The handoff documents describe both connected features and proposed work. The saved OpenAPI document is a snapshot; confirm backend changes against the deployed specification before extending an integration.
