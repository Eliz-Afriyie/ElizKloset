# Admin integration status

Updated 26 October 2026.

The former demo plan has been completed and replaced with API-backed staff screens. The demo workspace and dummy admin data have been removed. Staff must authenticate to enter the portal.

See [ADMIN-INTEGRATION.md](ADMIN-INTEGRATION.md) for configuration, coverage, transport, validation and remaining operational verification. See [API-CONTRACT.md](API-CONTRACT.md) for the original proposed contract and [backend-openapi.json](backend-openapi.json) for the deployed API definition.

## Admin scope

- Staff sign-in/MFA, session restoration, expiry and sign-out.
- Overview, products, uploads, inventory, category/collection management and assignment dialogs.
- Orders and versioned fulfilment/tracking changes.
- Customer profiles, edits, confirmed deletion and order history.
- Page/site content publishing and review moderation.
- Store settings, staff invitations and versioned role/access changes.
- Server filters/pagination, permission-aware navigation, empty states, retries and conflict errors.

All supported admin endpoint groups from the deployed definition are used. Backend success responses still require verification with a real staff login because OpenAPI does not define their schemas. Automated tests use isolated contract fixtures and do not change the live store.

## Backend responsibilities

The backend must enforce staff sessions, effective permissions, MFA, stock/publication rules, version preconditions, order transitions, profile retention and upload validation. Frontend visibility checks are not authorization. Owner provisioning, invitation acceptance, MFA enrolment/recovery and staff password recovery depend on backend/provider setup; no such endpoints are present in the shared admin definition.

## Customer scope remains separate

Customer catalog, accounts, bag, wishlist, reviews and checkout still use the existing storefront preview flows. Administrative writes persist to the API but do not replace the frontend's static customer catalog yet. Customer integration must consume the public API before newly created admin products/content appear in those pages.
