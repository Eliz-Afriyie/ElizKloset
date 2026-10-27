# Admin backend integration

Started 26 October 2026 against the deployed backend OpenAPI document, saved in [backend-openapi.json](backend-openapi.json).

Swagger: https://elizkloset.onrender.com/elizkloset/api/v1/docs

Actual API base: `https://elizkloset.onrender.com/api/v1`. The docs URL prefix is not the API prefix. The root `/openapi.json` defines the actual routes.

## Connected admin features

- Staff sign-in, MFA challenge verification, session restoration through `/admin/auth/me`, expiry handling and sign-out.
- Product list with server search/category/stock/date filters and pagination, inventory summaries and product details modal (including direct details URLs).
- Product creation/editing through the existing wizard, image uploads, activation/deactivation and confirmed deletion.
- Categories/collections: server pagination/search, detail dialogs with paginated product assignments, create/edit/delete. Create a category before adding the first product.
- Category editor requires an image, uploads JPEG/PNG/WebP through `/admin/assets`, previews the returned URL and sends `imageId` on create/update. Existing image IDs survive editing and successful uploads remain selected after a failed save. Collection image uploads are optional. The backend owner confirmed category images are required although the saved OpenAPI marks `imageId` optional; the backend should document and validate this requirement with 422 rather than 500.
- Overview statistics, status counts, top products, sales chart/history and recent-order details from `/admin/dashboard`.
- Orders: server search, payment/fulfilment/date filters, pagination, full details and versioned fulfilment updates with shipping/tracking and unpaid cancellation confirmation.
- Customers: server search/date filters, pagination, fresh detail reads, edit/delete with confirmation, and owner-authorized order history. Historical orders are not edited with profiles.
- Store content: read/edit/publish home, shop, about, contact and site documents, structured nested fields, image uploads, list ordering and catalog/review selectors. Site configuration is owner-only. An empty document opens a blank form structure, never fabricated copy.
- Reviews: status/product filters, pagination, full review text, approval/rejection and feature controls. Verification flags remain server-owned.
- Settings: business/contact edits and actual connection statuses; currency/timezone are read-only.
- Staff: paginated staff list, invitations, catalog/fulfilment role changes and active/disabled access controls. Owner accounts cannot be edited through these controls.
- Staff permission gates apply to navigation and mounted pages; unauthorized sections never mount their data requests. Backend authorization is still required on every request.

The demo entry point, mock admin modules, seeded catalog/inventory/customers/orders, illustrative revenue series and sample date reference have been removed. Every admin read goes to the API; empty results stay empty and failures never substitute mock records. Test fixtures exist only under `tests/`.

## Admin interface

The admin now uses the supplied dashboard reference: compact account/date header, cream sidebar with burgundy active items, four metric cards, a revenue/paid-order line chart, latest-order table and a top-product spotlight. Product photos, sales, counts and order rows come from `/admin/dashboard`; comparison percentages and marketplace badges are not invented. Existing detail dialogs, permissions and mutation endpoints are preserved.

Desktop navigation collapses to an accessible icon rail. Its preference is stored locally under `elizkloset-admin-sidebar` (this contains no session data). Mobile uses an overlay drawer with focus containment, Escape dismissal, background scroll locking and focus restoration. Sales periods request the existing `createdFrom`/`createdTo` filters; chart points support pointer and keyboard inspection. Order search filters the latest returned orders; the adjacent link opens the full server-filtered order page.

The sidebar and its loading placeholder now use deeper burgundy `#430B20`; primary action buttons retain the brand primary colour. Backend error request IDs are displayed beside admin errors, including failed image uploads, for server-log correlation.

Storage follow-up: the refreshed deployed OpenAPI still specifies multipart `file` on `POST /api/v1/admin/assets`, matching all frontend upload paths. Direct and same-origin proxy probes with an unauthenticated tiny PNG both return staff-required 401. These confirm endpoint/proxy reachability only; storage success must be verified with a current authenticated upload. No storage-provider fix is inferred from an authentication rejection.

Customer home/shop now read the public backend catalog. Published active products can appear without rebuilding the frontend; see CUSTOMER-INTEGRATION.md for customer integration status and missing commerce endpoints.

## Transport and configuration

Staff sign-in now has two screens: `/admin/login` collects credentials and `/admin/login/verify` accepts the six-digit OTP. A challenge response routes to verification; `POST /admin/auth/mfa` sends `{ challengeId, code }`, then `/admin/auth/me` must return a valid staff profile before the workspace opens. The OTP input supports formatted paste, leading zeroes and mobile autofill, with retry and expiry states.

Only the pending challenge ID, email and expiry are retained in tab sessionStorage for refresh recovery. Passwords and OTP codes are never persisted. Challenges use the server expiry with a five-minute client maximum, and are cleared after success, cancellation or expiration. The API exposes no staff OTP resend endpoint, so requesting a new code restarts sign-in.

Browser calls `/api/admin/*` on the frontend origin. The Next.js Route Handler forwards to the backend `/api/v1/admin/*`, preserving query strings, multipart bodies, version headers, upstream status codes and cookies. It blocks cross-origin writes, disables caching and times out authentication requests after 60 seconds and other upstream requests after 30 seconds. It does not replace backend authorization.

After validating the write origin, the proxy supplies `X-CSRF-Token` from a backend CSRF/XSRF cookie or a token retained from an authentication response (`csrfToken`/`csrf_token`) or response header. Response tokens are retained in a private HttpOnly proxy cookie and never forwarded as backend cookies. Explicit CSRF headers are preserved. Backend CSRF validation remains enabled. Sessions created before response-token retention may need a fresh login. Proxy tests cover cookie tokens, login tokens, explicit headers and rejection of foreign-origin requests; a live category save must still be verified with the staff session.

The configured backend above is the default. Override it with a **server-only** `.env.local` entry when needed:

```dotenv
ADMIN_API_BASE_URL=https://elizkloset.onrender.com/api/v1
```

Restart Next.js after changing server configuration. Do not put secrets or credentials in a `NEXT_PUBLIC_` variable.

Cookie sessions are relayed as HttpOnly cookies, with their path rewritten to the local proxy. If sign-in/MFA returns an `access_token` or `accessToken`, it is moved into a secure HttpOnly proxy cookie and removed from the JSON returned to browser JavaScript. No credentials are saved in localStorage. Backend remains responsible for verifying sessions, role permissions, MFA, expiration and revocation. No token-refresh behavior is assumed; expired sessions require signing in again.

## Data mapping

- API money amounts are integer pesewas; display/form values are GHS. Conversion occurs at the adapter boundary.
- Product list stock is available stock. Wizard quantities are physical stock, including reserved stock; edits never copy available quantities over physical quantities.
- Purchasable variant IDs survive updates by color ID and size. Color IDs are stable product-scoped keys. New combinations omit variant ID so the server creates it.
- Existing asset IDs survive edits. New images upload as multipart files before product save. Data URLs never enter product JSON. Successful uploads are reused on retry during the current browser session.
- PATCH/DELETE send quoted `If-Match` versions. Conflicts surface to staff for reload; writes do not automatically overwrite newer server records.
- Date presets use today's UTC date, matching the current Ghana business timezone. Product prices and variant sizes start blank on creation.

## Response-schema limitation and verification

The deployed OpenAPI document defines request schemas but describes admin successful responses as empty schemas (`{}`). Adapters therefore use the handoff resource shapes and validate essential fields at runtime. Product reads expect `data` with id, version, price, category, collections, images, colors, variants, availableStock and createdAt. Lists expect `data`, `pagination`, and product `summary`. Staff reads expect id, email and an array of permission strings inside `data` (a direct staff object is also accepted). Unsupported responses produce errors; they never fall back to sample data.

Read-only live probes confirmed the root OpenAPI is reachable, `/api/v1/admin/auth/me` rejects an unauthenticated request with 401, the docs-prefixed admin URL returns 404, and the public catalog currently returns an empty list. No account was created or live store record mutated during implementation. Authenticated end-to-end verification still requires a real staff account/MFA through the login screen. Do not send passwords or MFA codes in chat.

Next.js runtime checks: login/products/collections pages returned HTTP 200. The local proxy reached the deployed backend and correctly relayed 401 for unauthenticated staff/profile and product requests. Unknown proxy routes returned 404 and foreign-origin writes returned 403. Network access is required for the development server to reach Render; a sandboxed process without network access reports a retryable 502 instead.

Completion checks on 26 October: refreshed the deployed definition (41 admin operations); login/orders/customers/content/settings pages returned HTTP 200 without demo content. Read-only local proxy calls for auth/me, orders, customers, pages/home, site, reviews, settings and staff all reached Render and relayed its authentication-required 401. The production build, TypeScript, scoped lint and all 27 automated tests passed. No authenticated production mutation was performed.

Remaining operational verification: sign in using a real staff account/MFA and exercise the deployed success responses. Successful admin response schemas remain unspecified in OpenAPI, so compatibility is checked against the handoff shapes and contract fixtures. Credentials, invitation acceptance/MFA enrolment and password recovery for staff require backend/provider provisioning; this API does not expose those setup flows. No placeholder setup controls were added.

### Staff-login diagnosis (26 October 2026)

Follow-up timeout investigation: the user reports that submitting credentials also hangs in backend Swagger, which bypasses the frontend proxy. Direct checks returned `/openapi.json` 200 in 933ms, `/api/v1/site` 200 in 882ms, and unauthenticated `/api/v1/admin/auth/me` 401 in 898ms. An empty-body `POST /api/v1/admin/auth/sign-in` returned validation 422 in 294ms. These probes verify reachability and validation only, not successful credential processing or OTP delivery.

Backend investigation required: trace a stalled sign-in request through staff lookup, password verification, challenge creation and OTP provider delivery. Check database connection/pool waits and outbound provider timeouts. These are candidate blocking steps, not verified causes. Apply bounded dependency timeouts and return a structured error if challenge creation/delivery fails; return a valid challenge promptly on success. The frontend must not fabricate an OTP challenge when the backend has not created one. This workspace contains the frontend, not the backend service implementation.

Using the account supplied for login troubleshooting, direct requests to the deployed backend returned:

| Request | Result |
| --- | --- |
| `POST /api/v1/admin/auth/sign-in` with the documented JSON fields | 401 |
| `POST /auth/token` with the general-login form fields | 200 |
| `GET /api/v1/admin/auth/me` with that general access token/session | 401 |

The account is accepted by general authentication but is not accepted for the staff portal. This reproduces without the frontend proxy. Backend action: provision/authorize the intended account for staff authentication, or deliberately align the two identity systems while retaining staff permissions and MFA. The frontend must not treat a successful general login as staff access while the staff verification endpoint rejects it. No password/token is recorded in this document or application files. The staff error now provides guidance about credentials and staff access; no authentication bypass or fallback is introduced.

Validation commands:

```sh
node --test tests/admin-api.test.cjs tests/admin-resources.test.cjs tests/admin-otp.test.cjs tests/admin-taxonomy.test.cjs tests/admin-ui.test.cjs
npx tsc --noEmit
npx eslint app/admin app/api/admin app/components/DesignPhoto.tsx
```

Tests cover origin/path guards, upload forwarding, cookie/token isolation, error handling, version headers, preservation of product variant/asset IDs and physical stock, remaining admin mutation payloads, fulfilment transitions, empty responses, rendered API-backed pages, access restrictions and removal of dummy runtime modules.

The current suite includes 43 automated tests and an optional dependency-free Edge browser check:

```sh
# With the frontend running on localhost:3100:
node tests/admin-browser-check.cjs
node tests/admin-browser-check.cjs --login
```

This browser check uses an isolated temporary browser profile and intercepts API responses with test fixtures. It does not bypass authentication in the application or mutate the real store. It verifies desktop/mobile layout, horizontal overflow, persisted collapse, Escape/focus behavior, chart keyboard controls, date-filter requests and empty states. Screenshots are saved in ignored `.admin-checks/`. Authenticated backend success verification still requires an actual staff login.

The `--login` variant checks the left-panel background image, minimum field/button spacing, failed staff-login guidance, the dedicated OTP route, refresh recovery, incorrect-code retry, formatted paste, verified staff-session handoff, challenge cleanup and mobile overflow with synthetic test credentials. The login and OTP panels reuse the storefront burgundy hero portrait with a burgundy overlay; form fields have a 24px gap and the primary button is separated by at least 28px.




