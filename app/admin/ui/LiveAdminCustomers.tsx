"use client";
import FormError from "../../components/FormError";

import { useState, type FormEvent } from "react";
import { parsers, removeCustomer, updateCustomer } from "../lib/resources";
import { useAdminQuery } from "../lib/useAdminQuery";
import { useAdminSession } from "./AdminSession";
import ActionMenu from "./ActionMenu";
import DateRangeFilter, { allDates } from "./DateRangeFilter";
import { AdminDialog, ApiPagination, ApiStatus } from "./ApiControls";
import AdminOrders from "./AdminOrders";

function CustomerDialog({ id, mode: initialMode, onClose, onSaved }: { id: string; mode: "view" | "edit" | "delete"; onClose: () => void; onSaved: () => void }) {
  const query = useAdminQuery(`customers/${encodeURIComponent(id)}`, parsers.customer);
  const { staff } = useAdminSession();
  const [mode, setMode] = useState(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const customer = query.data;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!customer || busy) return;
    const fields = new FormData(event.currentTarget); setBusy(true); setError("");
    try {
      if (mode === "delete") { await removeCustomer(customer); onSaved(); onClose(); }
      else { await updateCustomer(customer, { name: String(fields.get("name")).trim(), email: String(fields.get("email")).trim(), phone: String(fields.get("phone")).trim() || null, city: String(fields.get("city")).trim() || null }); onSaved(); setMode("view"); query.refresh(); }
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save customer changes."); }
    finally { setBusy(false); }
  }
  return <AdminDialog title={mode === "edit" ? "Edit customer" : mode === "delete" ? "Delete customer" : "Customer details"} busy={busy} onClose={onClose}><ApiStatus loading={query.loading} error={query.error} retry={query.refresh} />
    {error && <FormError  className="admin-form-error">{error} <button disabled={busy} onClick={() => { setError(""); query.refresh(); }}>Reload customer</button></FormError>}
    {customer && !query.loading && (mode === "view" ? <><dl className="admin-definition">{[["Name", customer.name], ["Email", customer.email], ["Phone", customer.phone || "Not provided"], ["City", customer.city || customer.deliveryAddress?.city || "Not provided"], ["Orders", customer.orderCount], ["Joined", customer.createdAt.slice(0, 10)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{staff?.permissions.includes("customers:write") && <button className="admin-button" onClick={() => setMode("edit")}>Edit customer</button>}{staff?.permissions.includes("orders:read") && <AdminOrders customerId={id} />}</> : <form className="admin-form" key={`${customer.id}-${customer.version}-${mode}`} onSubmit={submit}><fieldset disabled={busy}>{mode === "delete" ? <><p>Delete {customer.name}&apos;s customer profile? Historical order records are retained.</p><label className="admin-checkbox"><input type="checkbox" required />Confirm deletion of this profile.</label></> : <><label>Full name<input name="name" required maxLength={100} defaultValue={customer.name} /></label><label>Email<input name="email" type="email" required maxLength={254} defaultValue={customer.email} /></label><label>Phone<input name="phone" type="tel" maxLength={25} defaultValue={customer.phone ?? ""} /></label><label>Town / city<input name="city" maxLength={100} defaultValue={customer.city ?? customer.deliveryAddress?.city ?? ""} /></label></>}<div className="admin-dialog-actions"><button type="button" className="admin-button secondary" onClick={() => setMode("view")}>Cancel</button><button type="submit" className={`admin-button ${mode === "delete" ? "danger" : ""}`}>{busy ? "Saving..." : mode === "delete" ? "Delete customer" : "Save changes"}</button></div></fieldset></form>)}
  </AdminDialog>;
}

export default function LiveAdminCustomers() {
  const { staff } = useAdminSession();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState(allDates);
  const [selected, setSelected] = useState<{ id: string; mode: "view" | "edit" | "delete" } | null>(null);
  const params = new URLSearchParams({ page: String(page), pageSize: "8" });
  if (search.trim()) params.set("q", search.trim());
  if (range.from) params.set("createdFrom", range.from);
  if (range.to) params.set("createdTo", range.to);
  const query = useAdminQuery(`customers?${params}`, parsers.customers);
  return <><section className="admin-card"><div className="admin-card-heading"><h2>Customers</h2><DateRangeFilter value={range} onChange={(value) => { setRange(value); setPage(1); }} label="Customer signup date" /></div><div className="admin-filters"><label className="admin-search"><input aria-label="Search customers" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search name, email or city..." /></label></div><ApiStatus loading={query.loading} error={query.error} retry={query.refresh} />
    {query.data && !query.loading && <><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>City</th><th>Orders</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{query.data.data.map((customer) => <tr key={customer.id}><td>{customer.name}</td><td>{customer.email}</td><td>{customer.city ?? customer.deliveryAddress?.city ?? "Not provided"}</td><td>{customer.orderCount}</td><td>{customer.createdAt.slice(0, 10)}</td><td><ActionMenu name={customer.name} actions={[{ label: "View customer", onSelect: () => setSelected({ id: customer.id, mode: "view" }) }, ...(staff?.permissions.includes("customers:write") ? [{ label: "Edit customer", onSelect: () => setSelected({ id: customer.id, mode: "edit" as const }) }] : []), ...(staff?.permissions.includes("customers:delete") ? [{ label: "Delete customer", onSelect: () => setSelected({ id: customer.id, mode: "delete" as const }) }] : [])]} /></td></tr>)}</tbody></table>{!query.data.data.length && <p className="admin-empty">No customers found.</p>}</div><ApiPagination page={page} total={query.data.pagination.total} totalPages={query.data.pagination.totalPages} loading={query.loading} onChange={setPage} /></>}
  </section>{selected && <CustomerDialog key={`${selected.id}-${selected.mode}`} {...selected} onClose={() => setSelected(null)} onSaved={() => { setPage(1); query.refresh(); }} />}</>;
}
