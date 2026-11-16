# Gallery backend integration

Updated 4 November 2026 against the deployed OpenAPI document in `backend-openapi.json`.

The Gallery page (`/admin/gallery`) and shared picker support product covers, colour photos, category/collection images and page content image URLs. Navigation is available to catalog/content readers and editors; record saves retain their original permission checks.

## Listing and registration

- `GET /api/admin/gallery` forwards to `/api/v1/admin/gallery`. The documented listing has no search or pagination parameters, so the frontend filters and paginates the returned records locally, twelve images per page.
- Gallery records accept `gallery_url`; the adapter also supports `url` and `image_url` image records, and optional display names/alt text. Empty galleries remain empty.
- `POST /api/admin/gallery` sends JSON `{ "gallery_url": "https://.../image.jpg" }` when staff explicitly choose **Add URL to gallery**. The gallery refreshes after a successful response. Registration is separate from selecting an image for a form.
- The server proxy forwards staff authentication and the existing CSRF protections. Anonymous live requests return 401. Authenticated gallery records still require verification with a real staff session; no live gallery writes were performed during implementation.

## Selecting and saving images

Product multipart create and JSON PATCH use `image_url` for the cover. Category/collection multipart create and PATCH also use `image_url` instead of a file when selecting a cloud image. Existing file uploads remain supported. The deployed OpenAPI explicitly documents URL fields for product and category/collection creation and category/collection edits; product PATCH has an unspecified request schema. Colour JSON accepts `imageIds`, not `image_url`. On creation, new colour-image URLs are submitted as repeated `product_images` values; the returned product image IDs are then linked to the corresponding colours by a versioned PATCH. If the backend does not return matching URL/image-ID records, the created draft is retained and an explicit completion error is shown. On edits, colour photos must already have an asset ID on the product or be uploaded through the file flow.

Selecting an image updates the draft preview immediately; it does not register or upload it again. Cloud URLs are referenced directly, without downloading/re-uploading them. Read adapters prefer `image_url` over stale image records, including categories that return localhost asset URLs alongside the correct cloud URL.

The picker handles loading, empty/error states, broken thumbnails, local search/pagination, URL previews, selection and keyboard-accessible dialogs. Backend errors stay visible. New file uploads directly into the gallery, deleting gallery records and bulk assignment are outside this change.

## Validation

Adapter and proxy tests use intercepted fixtures. `tests/content-browser-check.cjs` reads the live public pages and intercepts all admin requests to verify gallery and product/category selection without changing backend records.