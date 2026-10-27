# Customer backend integration

Implemented 26 October 2026 against the deployed OpenAPI document in `backend-openapi.json`.

## Connected flows

- Home and shop use real products, categories and collections. Empty responses stay empty; sample products and reviews have been removed from runtime.
- Shop search, category/collection selection, string sizes, colours, GHS price limits, availability and sorting use server filters. Load more uses the returned cursor and retains previously loaded products.
- Product cards open a details dialog. Direct `/products/{slug}` links load the backend product, including products created after the frontend build. Missing products show unavailable; API failures show an error.
- Prices convert integer pesewas to GHS. Size/colour availability comes from actual variants; unavailable combinations cannot be added to the bag. Badges are shown only when supplied by the backend.
- Featured and product reviews use the published review endpoints. There is no review-submission endpoint, so no fake submission form is shown.
- Customer sign-in uses `/auth/token` with form-encoded `username` and `password`. Session restoration uses `/auth/me` with the access token in the documented JSON body. Sign-out uses `/auth/logout`.
- Registration uses `/api/v1/users/`, email verification uses `/users/verify-otp`, and resend/reset requests use the documented target/code fields. Passwords and codes are never saved to browser storage.
- Profile edits resolve the customer ID through the authenticated backend session before calling `PUT /api/v1/users/{id}`. The browser cannot select another user ID or update roles through this proxy.
- Contact messages and newsletter signup send actual requests and show success only after the server accepts them. They respect `site.features.contactSubmission` and `site.features.newsletterSignup`; currently both are false on the live backend.

## Branding and unavailable commerce endpoints

Registration requirement update: the owner explicitly requested optional email. First name, last name, phone, password and confirmation are required in the UI and display asterisks; whitespace-only names/phone are rejected. When email is absent, the frontend omits it entirely from the registration JSON and uses the phone number as the OTP target through `/users/verify-phone-otp`. Email verification continues through `/users/verify-otp` when email is supplied. Sign-in/reset target inputs accept email or phone.

**Backend change required before email-less accounts can be created:** the current deployed `UserCreate` schema still requires email. Make email optional, require and validate the other registration fields, support phone-based registration/OTP delivery/resend and sign-in, and allow account/profile responses to carry absent email. Never generate a fake email address. Existing account profile updates still follow the deployed schema, which currently requires an email. Fixture tests validate the intended email-less frontend flow; they do not establish deployed backend support.

The owner explicitly chose to retain the current branded hero, About content and campaign imagery. `/pages/*` currently returns sample copy and placeholder images, so these content documents are not rendered. Site feature settings are live; page-content publishing needs a later switch once approved backend content is ready.

The deployed API has no customer cart, wishlist, checkout, payment or order-history operations. Bag selections are stored on this device under `elizkloset-shopping-v2`, containing identifiers, size, colour and quantity only; wishlist identifiers use the account-specific keys described below. Prices and availability are read from the API. The new storage key excludes old preview selections. Missing products can be removed from the bag. Checkout remains disabled and no payment or order is fabricated. Delivery address editing is not connected because the user schema has no address fields.

Authentication gate update: the bag remains available to guests, while saving/viewing/updating a wishlist requires a verified customer session. A shared customer session provider restores the profile and rechecks `/auth/me` before wishlist mutations. Missing authentication opens a sign-in dialog; a pending save is added only after sign-in and profile verification succeed, and cancelling the dialog discards that pending action. Sign-out and failed session checks clear the active identity.

The regular account dialog closes after verified sign-in and after a successful profile save. The header then shows an account avatar, signed-in check mark and name (avatar/check only on narrow screens), and a brief success notification confirms the action. Customers can reopen the account dialog to edit their profile or sign out. Profile names support snake_case and camelCase backend fields with a contact-based fallback, so the greeting cannot be blank.

Signed-in avatar clicks now open a compact dropdown with **Go to profile** and **Sign out**, instead of immediately opening the form. The menu supports outside-click dismissal, Escape, arrow keys and focus restoration. Header icon tooltips appear on hover/focus. Sign out opens a shared confirmation dialog; cancelling never calls the API, and a failed sign-out leaves a retryable error.

Profile forms load `GET /api/store/auth/profile`, which verifies `/auth/me` and then reads `/api/v1/users/{verified-id}` server-side. The browser cannot choose an arbitrary account ID. Only profile fields are returned; password, OTP and internal account fields in the backend UserSchema are excluded from profile/session responses. Profile errors show a retry state instead of an empty form; successful reads prepopulate the uncontrolled inputs only after loading finishes. Saves reread the full profile. Minimal subsequent session checks preserve previously loaded names for the same identity, while expired sessions and account changes invalidate access.

Wishlist identifiers now use a separate device-storage key per backend customer ID (`elizkloset-wishlist-v1:{id}`), and signed-out customers see no wishlist. The former shared wishlist is not migrated across accounts. Cart identifiers remain in `elizkloset-shopping-v2`. Guests pressing the cart checkout control are prompted to sign in without losing their bag. Signed-in customers still see checkout unavailable because no order/payment endpoint exists. Future backend wishlist/checkout operations must enforce their own authentication; this frontend gate does not introduce those missing operations.

## Transport and session isolation

Browser calls use `/api/store/*`. The server-only `STORE_API_ORIGIN` defaults to `https://elizkloset.onrender.com`; generic authentication lives at `/auth/*`, public resources at `/api/v1/*`.

The proxy allowlists paths and methods, rejects foreign-origin writes, uses no-store responses, and returns explicit connection/timeout errors. Customer bearer tokens stay in HttpOnly cookies scoped to `/api/store`; backend cookies are namespaced and scoped to that proxy. Staff cookies and tokens are never sent to customer endpoints, and customer tokens are never sent to the public catalog. Refresh tokens are stripped from browser responses; automatic token refresh is not implemented. Expired sessions require signing in again.

Staff session restoration now lives inside the admin layout, so customer pages do not request staff authentication.

## Validation and backend follow-up

Shared skeleton loaders now cover navigation fallbacks, product/collection grids, product details, account forms, bag/wishlist, reviews and signup configuration. Admin session checks, OTP preparation, dashboard, tables, content/settings forms and detail dialogs use the same system. Decorative placeholders are hidden from assistive technology, each group has a loading status, and animations respect reduced motion. Delayed fixture responses (`STORE_CHECK_DELAY_MS=700 node tests/store-browser-check.cjs`, or set the environment variable first in PowerShell) verify that skeletons are non-interactive, stop animating under reduced motion and are replaced by actual results. Mutation buttons retain their busy labels so entered form values remain visible during a save.

Read-only live checks confirmed the products endpoint returns an empty cursor page with facets, categories and collections are empty, and published reviews are empty. The site reports contact/newsletter disabled. Public page documents contain sample content. Successful response schemas remain unspecified in OpenAPI; runtime adapters validate essential fields against the handoff shapes and live empty responses.

The isolated Edge browser check covers populated catalog fixtures, cursor pagination, product dialogs, string-size bag selection, empty/error states, customer sign-in/out, registration/email OTP, password reset, contact payload enums, newsletter submission and mobile overflow. It intercepts all API calls and performs no live account creation, messages, subscriptions or store writes. Live authenticated success responses still need verification with an actual customer account.

It also checks guest wishlist and checkout prompts, resuming a save after sign-in, hiding saved items after sign-out, account isolation and rejection of an expired session before saving.

Completion validation: production build, scoped lint and all 57 automated tests passed. Customer browser checks cover direct product slugs not enumerated during build, the account dropdown, prefilled full profiles, keyboard/tooltips, confirmation cancellation and mobile popup bounds. The existing admin OTP browser check passed after staff session handling moved into the admin layout. Full-profile UI tests use minimal auth/me fixtures plus a separate complete profile response; live profile contents still depend on the customer's stored backend record.

```sh
node --test tests/admin-api.test.cjs tests/admin-resources.test.cjs tests/admin-otp.test.cjs tests/admin-taxonomy.test.cjs tests/admin-ui.test.cjs tests/store-api.test.cjs
npx tsc --noEmit
npx eslint app/components app/lib app/api/store app/admin/layout.tsx app/layout.tsx app/shop tests/store-api.test.cjs tests/store-browser-check.cjs
# With the frontend running on localhost:3100:
node tests/store-browser-check.cjs
```

Backend follow-up: publish products with actual variants/photos, fix image storage, enable contact/newsletter only when their services are configured, publish approved page content, document successful customer authentication/profile responses, and supply cart/checkout/payment/order endpoints before enabling ordering.
