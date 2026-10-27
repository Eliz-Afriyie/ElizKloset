# Customer flow preview

- `/cart`: saved bag, size/color details, quantity adjustment, removal, subtotal, checkout dialog and suggested styles.
- `/wishlist`: saved styles with links to choose a size on their product pages, removal and suggested styles.
- `/products/{productId}`: full photo, color/size options, add to bag, wishlist control, fit/care and delivery information, four related products from the same category. Unknown IDs return not found.
- Header account button: sign-in/create-account dialog, password-reset preview and editable profile. Sign-out opens a separate confirmation dialog, with a cancel action.
- Cart checkout: contact and delivery form, preferred payment method, review acknowledgement. No order is placed and no payment credentials are collected.

All account and checkout interactions are mock flows. Profile is memory-only; cart and wishlist retain their existing browser storage. No passwords or checkout fields are sent to a server. Authentication, order creation, live inventory and payment processing remain integration work. Related styles use catalog/category matching rather than behavioral personalization.

Manual acceptance flow: open a product from home/shop, choose size/color, add to bag, visit bag via header, adjust quantity, open checkout, complete sample details and review; then save a style, open wishlist and return to its product page. Open account, switch to Create account, submit sample matching passwords, edit profile, cancel sign-out, then confirm sign-out. Verify Escape closes each dialog and focus returns to its trigger. Repeat at mobile width.
