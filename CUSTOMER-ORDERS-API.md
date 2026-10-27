# Customer orders: backend handoff

Current Swagger exposes only staff order reads and updates. The customer Orders
page (`/orders`) and account-menu entry are added, but history/tracking integration
is blocked until authenticated customer endpoints exist. The page shows an
availability message, not a fabricated empty history. No admin endpoint is used.

## Existing admin flow

Staff with `orders:write` can update fulfilment via
`PATCH /api/v1/admin/orders/{order_id}/fulfilment`.

| Current state | Available action in the current UI |
| --- | --- |
| awaiting_payment, paid | processing (accept) |
| awaiting_payment, unpaid | cancelled |
| processing, paid | shipped (requires carrier and tracking number) |
| processing, unpaid | cancelled |
| shipped | delivered (complete) |
| delivered or cancelled | no further update |

Payload enum: `processing`, `shipped`, `delivered`, `cancelled`.
Payment is a separate status. There are no literal `accepted` or `completed`
values. Existing changes send the record version through `If-Match`.

## Proposed customer endpoints (not currently available)

`GET /api/v1/orders?page=1&pageSize=8&sort=createdAt:desc`

Authenticate with the customer's bearer token. Resolve the customer from that
identity on the server; never allow a customerId parameter to select another
person's records. Return only that customer's orders, newest first.

```ts
type Money = { amount: number; currency: "GHS" }; // integer minor units
type Order = {
  id: string;
  reference: string;
  createdAt: string; // ISO 8601
  paymentStatus: "pending" | "paid" | "failed" | "partially_refunded" | "refunded";
  fulfilmentStatus: "awaiting_payment" | "processing" | "shipped" | "delivered" | "cancelled";
  items: {
    id: string; name: string; color: string; size: string;
    quantity: number; unitPrice: Money; lineTotal: Money;
    image: { url: string; alt: string } | null;
  }[];
  subtotal: Money;
  deliveryFee: Money;
  total: Money;
  tracking: { carrier: string; number: string; url: string | null } | null;
  statusHistory: { status: Order["fulfilmentStatus"]; occurredAt: string }[];
};
type OrderList = {
  data: Order[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};
```

`GET /api/v1/orders/{order_id}` returns `{ data: Order }` after checking
ownership. Return 404 for an unknown order or an order owned by someone else.
Return 401 for missing/expired customer credentials. Do not include staff notes,
other customers' information, payment secrets, passwords, or OTPs.

Use the existing error envelope `{ error: { code, message, requestId } }`.
An empty successful list means no orders; a failed or unavailable service must
remain distinct from an empty history. Customer reads must reflect staff updates.

Once implemented, wire these through the customer proxy with private/no-store
responses, pagination, loading skeletons, retry handling, and identity-change
cleanup. Customer order creation/checkout also needs its own backend contract.
