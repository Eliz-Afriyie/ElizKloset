"use client";
import { GalleryButton } from "./ImageGallery";
import ErrorToast from "../../components/ErrorToast";
import FormError from "../../components/FormError";
import Skeleton from "../../components/Skeleton";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { adminRequest, AdminApiError, unwrap } from "../lib/api";
import { useAdminSession } from "./AdminSession";
import Icon from "../../components/Icon";
import ActionMenu from "./ActionMenu";
import { AdminDialog, ApiPagination, ApiStatus } from "./ApiControls";
import { useAdminQuery } from "../lib/useAdminQuery";
import { isObject, parsePage } from "../lib/resources";
import Image from "next/image";
import { saveTaxonomy, validateTaxonomyImage, type TaxonomyImage } from "../lib/taxonomy";

type Item = { id: string; name: string; slug: string; description: string; status: "active" | "draft"; assignedProductCount: number; version: number; imageId?: string; image_url?: string; image?: { id?: string; url: string; alt?: string } | null };

function TaxonomyThumbnail({ item }: { item: Item }) {
  const [failed, setFailed] = useState(false);
  return item.image?.url && !failed
    ? <Image className="admin-taxonomy-thumbnail" src={item.image.url} alt={item.image.alt || item.name} width={56} height={64} unoptimized onError={() => setFailed(true)} />
    : <span className="admin-taxonomy-thumbnail admin-taxonomy-placeholder" role="img" aria-label={`No image for ${item.name}`} title="No image available"><Icon name="bag" /><span>No image</span></span>;
}
type Result = { data: Item[]; pagination: { total: number; totalPages: number } };

function parseItem(value: unknown): Item {
  const item = unwrap(value);
  if (!isObject(item) || typeof item.id !== "string" || typeof item.name !== "string" || !Number.isInteger(item.version)) throw new Error("Unsupported category or collection response.");
  return { ...item, image: item.image_url ? { url: item.image_url } : item.image } as Item;
}
function parseAssignments(value: unknown) {
  return parsePage(value, (item) => {
    if (!isObject(item) || typeof item.id !== "string" || typeof item.name !== "string") throw new Error("Unsupported product assignment response.");
    return item as { id: string; name: string };
  });
}
function TaxonomyDetails({ kind, id, onClose }: { kind: string; id: string; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const query = useAdminQuery(`${kind}/${encodeURIComponent(id)}`, parseItem);
  const products = useAdminQuery(`${kind}/${encodeURIComponent(id)}/products?page=${page}&pageSize=8`, parseAssignments);
  return <AdminDialog title={query.data?.name ?? "Details"} onClose={onClose}><ApiStatus loading={query.loading} error={query.error} retry={query.refresh} />{query.data && <><p>{query.data.description || "No description added."}</p><dl className="admin-definition"><div><dt>Slug</dt><dd>{query.data.slug}</dd></div><div><dt>Status</dt><dd>{query.data.status}</dd></div><div><dt>Assigned products</dt><dd>{query.data.assignedProductCount}</dd></div></dl></>}<h3>Assigned products</h3><ApiStatus loading={products.loading} error={products.error} retry={products.refresh} />{products.data && !products.loading && <><ul>{products.data.data.map((product) => <li key={product.id}>{product.name}</li>)}</ul>{!products.data.data.length && <p>No products assigned.</p>}<ApiPagination page={page} total={products.data.pagination.total} totalPages={products.data.pagination.totalPages} loading={products.loading} onChange={setPage} /></>}</AdminDialog>;
}

export default function LiveTaxonomy() {
  const { staff } = useAdminSession();
  const canWrite = !!staff?.permissions.includes("catalog:write");
  const [kind, setKind] = useState("categories");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const fieldAliases: Record<string, string> = { taxonomy_status: "status", file: "image", image_id: "image", imageId: "image" };
  const firstInvalidField = Object.keys(fieldErrors).map((field) => fieldAliases[field] ?? field).find((field) => ["name", "description", "status", "image", ...(editing ? ["slug"] : [])].includes(field));
  const [viewing, setViewing] = useState<string | null>(null);
  const [image, setImage] = useState<TaxonomyImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!image?.url.startsWith("blob:")) return;
    const url = image.url;
    return () => URL.revokeObjectURL(url);
  }, [image]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const response = await adminRequest<Result>(`${kind}?${new URLSearchParams({ page: String(page), pageSize: "8", q: query })}`, { signal: controller.signal });
        if (!Array.isArray(response.data) || !response.pagination || response.data.some((item) => !Number.isInteger(item.version))) throw new Error("Unsupported taxonomy response from the API.");
        if (!controller.signal.aborted) { setResult({ ...response, data: response.data.map(parseItem) }); if (page > Math.max(1, response.pagination.totalPages)) setPage(Math.max(1, response.pagination.totalPages)); }
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load records."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [kind, page, query, revision]);
  function open(item: Item | null) {
    if (item) item = parseItem(item); setEditing(item); setFormVersion((value) => value + 1); setFormError(""); setFieldErrors({});
    setImage(item?.image ? { id: item.imageId ?? item.image.id ?? "", url: item.image.url } : item?.imageId ? { id: item.imageId, url: "" } : null);
    if (fileInput.current) fileInput.current.value = "";
    dialog.current?.showModal();
  }
  async function upload(file: File | undefined) {
    if (!file || uploading) return;
    setUploading(true); setFormError("");
    try {
      validateTaxonomyImage(file);
      setImage({ id: "", url: URL.createObjectURL(file), file });
    }
    catch (error) { setFormError(error instanceof Error ? error.message : "Unable to upload image."); }
    finally { setUploading(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || uploading) return;
    const fields = new FormData(event.currentTarget); setBusy(true); setFormError(""); setFieldErrors({});
    try {
      const body = Object.fromEntries(["name", "description", "status"].map((key) => [key, String(fields.get(key)).trim()]));
      await saveTaxonomy(kind, body, image?.id, editing, image?.file, image?.fromGallery ? image.url : undefined);
      dialog.current?.close(); setRevision((value) => value + 1); setNotice("Saved to the store.");
    } catch (error) {
      if (error instanceof AdminApiError) setFieldErrors(error.fields);
      setFormError(error instanceof Error ? error.message.replace(/Please check the highlighted fields\./i, "Please correct the validation errors below.") : "Unable to save.");
    }
    finally { setBusy(false); }
  }
  async function remove(item: Item) {
    if (busy) return; setBusy(true); setError("");
    try { await adminRequest(`${kind}/${encodeURIComponent(item.id)}`, { method: "DELETE", version: item.version }); setRevision((value) => value + 1); setNotice("Record deleted."); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to delete."); }
    finally { setBusy(false); }
  }
  return <>
    {viewing && <TaxonomyDetails kind={kind} id={viewing} onClose={() => setViewing(null)} />}
    <div className="admin-heading-actions">{["categories", "collections"].map((value) => <button className={`admin-button ${kind !== value ? "secondary" : ""}`} key={value} onClick={() => { setKind(value); setPage(1); setResult(null); }} disabled={busy}>{value === "categories" ? "Categories" : "Collections"}</button>)}</div>
    <ErrorToast message={notice} tone="success" onDismiss={() => setNotice("")} /><ErrorToast message={formError} />
    {error && <FormError  className="admin-form-error">{error} <button onClick={() => setRevision((value) => value + 1)}>Retry</button></FormError>}
    <section className="admin-card"><div className="admin-card-heading"><h2>{kind === "categories" ? "Categories" : "Collections"}</h2>{canWrite && <button className="admin-button" disabled={busy} onClick={() => open(null)}><Icon name="plus" />Add {kind === "categories" ? "category" : "collection"}</button>}</div>
      <div className="admin-filters"><label className="admin-search"><Icon name="search" /><input aria-label="Search categories and collections" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search by name…" /></label></div>
      {loading ? <Skeleton variant="table" label="Loading categories and collections" /> : <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Image</th><th>Name</th><th>Slug</th><th>Status</th><th>Products</th><th>Actions</th></tr></thead><tbody>{result?.data.map((item) => <tr key={item.id}><td><TaxonomyThumbnail key={item.image?.url || "no-image"} item={item} /></td><td>{item.name}</td><td>{item.slug}</td><td>{item.status}</td><td>{item.assignedProductCount}</td><td>{!busy && <ActionMenu name={item.name} actions={[{ label: "View details", onSelect: () => setViewing(item.id) }, ...(canWrite ? [{ label: "Edit", onSelect: async () => { setBusy(true); try { open(unwrap(await adminRequest<{ data: Item }>(`${kind}/${encodeURIComponent(item.id)}`))); } catch (error) { setError(error instanceof Error ? error.message : "Unable to load details."); } finally { setBusy(false); } } }] : [])]} deletion={canWrite ? { name: item.name, blocked: kind === "categories" && item.assignedProductCount > 0 ? "Reassign this category's products before deletion." : undefined, description: kind === "collections" ? "Delete this collection and detach its product memberships? Products are retained." : "Delete this category?", onDelete: () => void remove(item) } : undefined} />}</td></tr>)}</tbody></table>{!result?.data.length && <p className="admin-empty">No records found.</p>}</div>}
      <nav className="admin-pagination" aria-label="Taxonomy pagination"><p>{result?.pagination.total ?? 0} records</p><div><button disabled={loading || page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button disabled={loading || page >= (result?.pagination.totalPages ?? 0)} onClick={() => setPage(page + 1)}>Next</button></div></nav>
    </section>
    <dialog ref={dialog} className="shopping-dialog admin-dialog" aria-labelledby="live-taxonomy-title" onCancel={(event) => { if (busy || uploading) event.preventDefault(); }}><div className="admin-dialog-heading"><h2 id="live-taxonomy-title">{editing ? "Edit" : "Add"} {kind === "categories" ? "category" : "collection"}</h2><button aria-label="Close editor" disabled={busy || uploading} onClick={() => dialog.current?.close()}><Icon name="close" /></button></div><form className="admin-form" key={`${editing?.id ?? kind}:${formVersion}`} onSubmit={save}>{formError && <FormError className="admin-form-error" field={firstInvalidField}>{formError}{Object.keys(fieldErrors).length > 0 && <ul id="taxonomy-validation-details">{Object.entries(fieldErrors).map(([field, messages]) => <li key={field}>{field === "status" || field === "taxonomy_status" ? "Status" : field}: {messages.join(" ")}</li>)}</ul>}</FormError>}<fieldset disabled={busy || uploading} style={{ border: 0, padding: 0 }}><label>{kind === "categories" ? "Category image (required)" : "Collection image"}<input aria-invalid={!!(fieldErrors.file || fieldErrors.image || fieldErrors.image_id || fieldErrors.imageId)} ref={fileInput} name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload(event.target.files?.[0])} /></label><GalleryButton onSelect={(asset) => { setImage({ id: asset.id, url: asset.url, fromGallery: true }); setFormError(""); if (fileInput.current) fileInput.current.value = ""; }} />{image?.url && <Image src={image.url} alt="Selected image" width={160} height={120} unoptimized style={{ objectFit: "cover", borderRadius: 8, marginBlock: 12 }} />}{image?.file && <p>Image selected. It will upload when you save.</p>}{image?.id && <p>Image selected. Choose from gallery or upload a file to replace it.</p>}{uploading && <p role="status">Uploading image...</p>}<label>Name<input aria-invalid={!!fieldErrors.name} name="name" required maxLength={100} defaultValue={editing?.name} /></label>{editing && <dl className="admin-definition"><div><dt>Slug</dt><dd>{editing.slug}</dd></div></dl>}<label>Description<textarea aria-invalid={!!fieldErrors.description} name="description" maxLength={3000} defaultValue={editing?.description} /></label><label>Status<select aria-invalid={!!(fieldErrors.status || fieldErrors.taxonomy_status)} name="status" defaultValue={editing?.status ?? "draft"}><option value="draft">Draft</option><option value="active">Active</option></select></label><button className="admin-button" type="submit">{busy ? "Saving…" : "Save"}</button></fieldset></form></dialog>
  </>;
}

