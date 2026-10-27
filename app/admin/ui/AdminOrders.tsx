"use client";
import FormError from "../../components/FormError";

import { useState, type FormEvent } from "react";
import { formatPrice } from "../../lib/catalog";
import { fulfilmentOptions, parsers, updateFulfilment, type Order } from "../lib/resources";
import { useAdminQuery } from "../lib/useAdminQuery";
import { useAdminSession } from "./AdminSession";
import DateRangeFilter, { allDates } from "./DateRangeFilter";
import { AdminDialog, ApiPagination, ApiStatus } from "./ApiControls";

const statuses = ["awaiting_payment", "processing", "shipped", "delivered", "cancelled"];
const label = (value: string) => value.replaceAll("_", " ");

export function OrderDetails({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const query = useAdminQuery(`orders/${encodeURIComponent(id)}`, parsers.order);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { staff } = useAdminSession();
  const canWrite = !!staff?.permissions.includes("orders:write");
  async function save(event: FormEvent<HTMLFormElement>, order: Order) {
    event.preventDefault(); if (busy) return;
    const fields = new FormData(event.currentTarget);
    const fulfilmentStatus = String(fields.get("fulfilmentStatus"));
    const carrier = String(fields.get("carrier") ?? "").trim();
    const number = String(fields.get("number") ?? "").trim();
    const url = String(fields.get("url") ?? "").trim();
    if (fulfilmentStatus === "shipped" && (!carrier || !number)) { setError("Shipping requires a carrier and tracking number."); return; }
    if (url && !url.startsWith("https://")) { setError("Use an HTTPS tracking link."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      await updateFulfilment(order, { fulfilmentStatus, ...(carrier || number || url ? { tracking: { carrier, number, url: url || null } } : {}) });
      setNotice("Fulfilment updated."); query.refresh(); onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to update fulfilment."); }
    finally { setBusy(false); }
  }
  const order = query.data;
  return <AdminDialog title={order ? `Order ${order.reference}` : "Order details"} busy={busy} onClose={onClose}>
    <ApiStatus loading={query.loading} error={query.error} retry={query.refresh} />
    {notice && <p role="status" className="admin-notice">{notice}</p>}
    {error && <FormError  className="admin-form-error">{error} <button disabled={busy} onClick={() => { setError(""); query.refresh(); }}>Reload order</button></FormError>}
    {order && <><dl className="admin-definition"><div><dt>Customer</dt><dd>{order.customer.name}<br />{order.customer.email}<br />{order.customer.phone}</dd></div><div><dt>Delivery</dt><dd>{order.deliveryAddress.address}<br />{order.deliveryAddress.city}, {order.deliveryAddress.region}</dd></div><div><dt>Payment</dt><dd>{label(order.paymentStatus)}</dd></div><div><dt>Fulfilment</dt><dd>{label(order.fulfilmentStatus)}</dd></div><div><dt>Created</dt><dd>{order.createdAt?.slice(0, 10)}</dd></div></dl>
      <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Item</th><th>Quantity</th><th>Total</th></tr></thead><tbody>{order.items.map((item) => <tr key={item.id}><td>{item.name}<small>{item.color} / {item.size}</small></td><td>{item.quantity}</td><td>{formatPrice(item.lineTotal.amount / 100)}</td></tr>)}</tbody></table></div>
      <dl className="admin-definition"><div><dt>Subtotal</dt><dd>{formatPrice(order.subtotal.amount / 100)}</dd></div><div><dt>Delivery fee</dt><dd>{formatPrice(order.deliveryFee.amount / 100)}</dd></div><div><dt>Total</dt><dd>{formatPrice(order.total.amount / 100)}</dd></div></dl>
      {order.tracking && <p>Tracking: {order.tracking.carrier} · {order.tracking.number}{order.tracking.url?.startsWith("https://") && <> · <a href={order.tracking.url} target="_blank" rel="noopener noreferrer">Track shipment</a></>}</p>}
      {canWrite && !["cancelled", "delivered"].includes(order.fulfilmentStatus) && <FulfilmentForm key={`${order.id}-${order.version}`} order={order} busy={busy} onSubmit={(event) => void save(event, order)} />}
    </>}
  </AdminDialog>;
}

function FulfilmentForm({ order, busy, onSubmit }: { order: Order; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const allowed = fulfilmentOptions(order);
  const [next, setNext] = useState(allowed[0] ?? "");
  if (!allowed.length) return null;
  return <form className="admin-form" onSubmit={onSubmit}><fieldset disabled={busy}><legend>Update fulfilment</legend><label>Next status<select name="fulfilmentStatus" value={next} onChange={(event) => setNext(event.target.value)}>{allowed.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label>{next === "shipped" && <><label>Carrier<input name="carrier" required maxLength={100} defaultValue={order.tracking?.carrier} /></label><label>Tracking number<input name="number" required maxLength={100} defaultValue={order.tracking?.number} /></label><label>Tracking link<input name="url" type="url" defaultValue={order.tracking?.url ?? ""} placeholder="https://..." /></label></>}{next === "cancelled" && <label className="admin-checkbox"><input type="checkbox" required />Confirm cancellation of this order.</label>}<button className="admin-button" type="submit">{busy ? "Saving..." : "Update fulfilment"}</button></fieldset></form>;
}

export default function AdminOrders({ customerId }: { customerId?: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [range, setRange] = useState(allDates);
  const [selected, setSelected] = useState<string | null>(null);
  const params = new URLSearchParams({ page: String(page), pageSize: "8" });
  if (customerId) params.set("customerId", customerId);
  if (search.trim()) params.set("q", search.trim());
  if (status) params.set("fulfilmentStatus", status);
  if (payment) params.set("paymentStatus", payment);
  if (range.from) params.set("createdFrom", range.from);
  if (range.to) params.set("createdTo", range.to);
  const query = useAdminQuery(`orders?${params}`, parsers.orders);
  return <><section className="admin-card"><div className="admin-card-heading"><h2>{customerId ? "Customer orders" : "Orders"}</h2><DateRangeFilter value={range} onChange={(value) => { setRange(value); setPage(1); }} label="Order creation date" /></div>
    <div className="admin-filters"><label className="admin-search"><input aria-label="Search orders" placeholder="Search reference, customer or product..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label><select aria-label="Fulfilment status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All fulfilment statuses</option>{statuses.map((value) => <option value={value} key={value}>{label(value)}</option>)}</select><select aria-label="Payment status" value={payment} onChange={(event) => { setPayment(event.target.value); setPage(1); }}><option value="">All payments</option>{["pending", "paid", "failed", "partially_refunded", "refunded"].map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></div>
    <ApiStatus loading={query.loading} error={query.error} retry={query.refresh} />
    {query.data && !query.loading && <><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Reference</th><th>Customer</th><th>Total</th><th>Payment</th><th>Fulfilment</th><th>Actions</th></tr></thead><tbody>{query.data.data.map((order) => <tr key={order.id}><td>{order.reference}</td><td>{order.customer.name}<small>{order.deliveryAddress.city}</small></td><td>{formatPrice(order.total.amount / 100)}</td><td>{label(order.paymentStatus)}</td><td>{label(order.fulfilmentStatus)}</td><td><button className="admin-text-button" onClick={() => setSelected(order.id)}>View details</button></td></tr>)}</tbody></table>{!query.data.data.length && <p className="admin-empty">No orders found.</p>}</div><ApiPagination page={page} total={query.data.pagination.total} totalPages={query.data.pagination.totalPages} loading={query.loading} onChange={setPage} /></>}
  </section>{selected && <OrderDetails id={selected} onClose={() => setSelected(null)} onSaved={query.refresh} />}</>;
}
