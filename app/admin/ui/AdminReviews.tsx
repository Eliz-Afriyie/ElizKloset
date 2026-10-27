"use client";
import FormError from "../../components/FormError";

import { useState } from "react";
import { moderateReview, parsers, type ReviewRecord } from "../lib/resources";
import { useAdminQuery } from "../lib/useAdminQuery";
import { AdminDialog, ApiPagination, ApiStatus } from "./ApiControls";

export default function AdminReviews() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("pending");
  const [productId, setProductId] = useState("");
  const [selected, setSelected] = useState<ReviewRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const params = new URLSearchParams({ status, page: String(page), pageSize: "8" });
  if (productId.trim()) params.set("productId", productId.trim());
  const query = useAdminQuery(`reviews?${params}`, parsers.reviews);
  async function moderate(status: "approved" | "rejected", featured: boolean) {
    if (!selected || busy) return;
    setBusy(true); setError("");
    try { await moderateReview(selected, { status, featured }); setSelected(null); setPage(1); query.refresh(); setNotice("Review moderation saved."); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to moderate this review."); }
    finally { setBusy(false); }
  }
  return <section className="admin-card"><div className="admin-card-heading"><h2>Customer reviews</h2></div><div className="admin-filters"><label>Status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>{["pending", "approved", "rejected"].map((value) => <option key={value}>{value}</option>)}</select></label><label>Product reference<input value={productId} onChange={(event) => { setProductId(event.target.value); setPage(1); }} placeholder="Filter by product reference" /></label></div>
    {notice && <p role="status" className="admin-notice">{notice}</p>}<ApiStatus loading={query.loading} error={query.error} retry={query.refresh} />
    {query.data && !query.loading && <><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Customer</th><th>Review</th><th>Rating</th><th>Status</th><th>Featured</th><th>Actions</th></tr></thead><tbody>{query.data.data.map((review) => <tr key={review.id}><td>{review.displayName}<small>{review.verifiedPurchase ? "Verified purchase" : "Unverified purchase"}</small></td><td>{review.title}</td><td>{review.rating}/5</td><td>{review.status}</td><td>{review.featured ? "Yes" : "No"}</td><td><button className="admin-text-button" onClick={() => { setSelected(review); setError(""); }}>Review</button></td></tr>)}</tbody></table>{!query.data.data.length && <p className="admin-empty">No reviews in this status.</p>}</div><ApiPagination page={page} total={query.data.pagination.total} totalPages={query.data.pagination.totalPages} loading={query.loading} onChange={setPage} /></>}
    {selected && <AdminDialog title="Moderate review" busy={busy} onClose={() => setSelected(null)}><h3>{selected.title}</h3><p className="admin-review-body">{selected.body}</p><p>{selected.displayName} · {selected.rating}/5</p>{error && <FormError className="admin-form-error" >{error} <button disabled={busy} onClick={() => { setSelected(null); query.refresh(); }}>Reload reviews</button></FormError>}<div className="admin-dialog-actions"><button className="admin-button secondary" disabled={busy} onClick={() => void moderate("rejected", false)}>Reject</button><button className="admin-button secondary" disabled={busy} onClick={() => void moderate("approved", false)}>Approve</button><button className="admin-button" disabled={busy} onClick={() => void moderate("approved", true)}>Approve & feature</button></div></AdminDialog>}
  </section>;
}
