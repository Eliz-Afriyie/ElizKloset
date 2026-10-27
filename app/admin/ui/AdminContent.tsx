"use client";
import FormError from "../../components/FormError";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { adminRequest, unwrap } from "../lib/api";
import { isObject, parsers, saveDocument, type ContentObject, type ContentValue, type StoreDocument } from "../lib/resources";
import { useAdminQuery } from "../lib/useAdminQuery";
import { useAdminSession } from "./AdminSession";
import { ApiPagination, ApiStatus } from "./ApiControls";
import AdminReviews from "./AdminReviews";

function title(key: string) { return key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").replace(/^./, (first) => first.toUpperCase()); }
const referenceKeys: Record<string, string> = { featuredProductIds: "products", upcomingCategoryIds: "categories", reviewIds: "reviews", collectionIds: "collections" };
type ChoicePage = { data: { id: string; name?: string; title?: string; displayName?: string }[]; pagination: { total: number; totalPages: number } };
function parseChoices(value: unknown): ChoicePage {
  if (!isObject(value) || !Array.isArray(value.data) || !isObject(value.pagination) || value.data.some((item) => !isObject(item) || typeof item.id !== "string")) throw new Error("Unable to read available content choices.");
  return value as ChoicePage;
}
function ReferenceList({ name, value, onChange }: { name: string; value: string[]; onChange: (value: ContentValue) => void }) {
  const [page, setPage] = useState(1);
  const resource = referenceKeys[name];
  const query = useAdminQuery(`${resource}?page=${page}&pageSize=8${resource === "reviews" ? "&status=approved" : ""}`, parseChoices);
  return <fieldset className="admin-content-group"><legend>{title(name.replace(/Ids$/, ""))}</legend><p>{value.length} selected</p><ApiStatus variant="form" loading={query.loading} error={query.error} retry={query.refresh} />{query.data && !query.loading && <>{query.data.data.map((item) => <label className="admin-checkbox" key={item.id}><input type="checkbox" checked={value.includes(item.id)} onChange={(event) => onChange(event.target.checked ? [...value, item.id] : value.filter((id) => id !== item.id))} />{item.name || item.title || item.displayName || item.id}</label>)}{!query.data.data.length && <p>No available records.</p>}<ApiPagination page={page} total={query.data.pagination.total} totalPages={query.data.pagination.totalPages} loading={query.loading} onChange={setPage} /><button className="admin-text-button" type="button" onClick={() => onChange([])}>Clear selections</button></>}</fieldset>;
}

function ImageField({ name, value, onChange, onUploading }: { name: string; value: ContentObject; onChange: (value: ContentValue) => void; onUploading: (delta: number) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file || uploading) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5242880) { setError("Choose a JPG, PNG or WebP image under 5 MB."); event.target.value = ""; return; }
    setUploading(true); onUploading(1); setError("");
    try {
      const body = new FormData(); body.set("file", file);
      const asset = unwrap(await adminRequest<{ data: { id: string; url: string } }>(`assets?alt=${encodeURIComponent(String(value.alt ?? ""))}`, { method: "POST", body }));
      if (!asset.id || !asset.url) throw new Error("The upload did not return an image reference.");
      onChange("assetId" in value ? { ...value, assetId: asset.id } : { ...value, url: asset.url });
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to upload image."); }
    finally { setUploading(false); onUploading(-1); }
  }
  return <fieldset className="admin-content-group" disabled={uploading}><legend>{title(name)}</legend>{(value.assetId || value.url) && <p>Image selected</p>}<label>Replace image<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => void upload(event)} /></label><label>Image description<input value={String(value.alt ?? "")} onChange={(event) => onChange({ ...value, alt: event.target.value })} /></label>{uploading && <p role="status">Uploading image...</p>}{error && <FormError  className="admin-form-error">{error}</FormError>}</fieldset>;
}

function blankLike(value: ContentValue): ContentValue {
  if (Array.isArray(value)) return [];
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === "id" ? crypto.randomUUID() : blankLike(item)]));
  return typeof value === "boolean" ? false : typeof value === "number" ? 0 : "";
}
const listTemplates: Record<string, ContentValue> = {
  heroSlides: { id: "", eyebrow: "", title: "", description: "", image: { assetId: "", alt: "" }, primaryAction: { label: "", href: "" } },
  collectionCards: { id: "", title: "", subtitle: "", image: { assetId: "", alt: "" }, href: "" },
  navigation: { label: "", href: "" }, links: { label: "", href: "" },
  socials: { platform: "", handle: "", url: "" },
  values: { title: "", description: "", icon: "" }, methods: { type: "", label: "", value: "", href: "" },
  subjects: { value: "", label: "" }, story: "",
};

// Empty form structures, not storefront copy or example records.
const emptyImage = { assetId: "", alt: "" };
const emptyLink = { label: "", href: "" };
const emptyBanner = { eyebrow: "", title: "", description: "", image: emptyImage, primaryAction: emptyLink };
const emptyPages: Record<string, ContentObject> = {
  "pages/home": { heroSlides: [], collectionCards: [], upcomingCategoryIds: [], featuredProductIds: [], featuredProductsAction: emptyLink, experience: { ...emptyBanner, values: [] }, reviews: { reviewIds: [] } },
  "pages/shop": { hero: emptyBanner },
  "pages/about": { eyebrow: "", title: "", introduction: "", story: [], ceo: { name: "", role: "", portrait: emptyImage, biography: null }, values: [], action: emptyLink },
  "pages/contact": { hero: emptyBanner, heading: "", introduction: "", methods: [], form: { enabled: false, subjects: [], maxMessageLength: 3000 } },
  site: { name: "", tagline: "", theme: { primary: "", background: "" }, navigation: [], contact: { whatsapp: null, phone: null, email: null }, socials: [], features: { contactSubmission: false, newsletterSignup: false, checkout: false }, footer: { copyrightName: "", links: [] } },
};

function ContentField({ name, value, onChange, onUploading, depth = 0 }: { name: string; value: ContentValue; onChange: (value: ContentValue) => void; onUploading: (delta: number) => void; depth?: number }) {
  if (depth > 10) return <p>This field is too deeply nested to edit here.</p>;
  if (name === "id") return null;
  if (Array.isArray(value)) {
    if (referenceKeys[name]) return <ReferenceList name={name} value={value as string[]} onChange={onChange} />;
    return <fieldset className="admin-content-group"><legend>{title(name)}</legend>{value.map((item, index) => <div className="admin-content-list-item" key={index}><ContentField name={`${name} ${index + 1}`} value={item} onChange={(next) => onChange(value.map((entry, position) => position === index ? next : entry))} onUploading={onUploading} depth={depth + 1} /><button className="admin-text-button" type="button" onClick={() => onChange(value.filter((_, position) => position !== index))}>Remove item {index + 1}</button><div className="admin-heading-actions"><button type="button" disabled={index === 0} onClick={() => { const next = [...value]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next); }}>Move up</button><button type="button" disabled={index === value.length - 1} onClick={() => { const next = [...value]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; onChange(next); }}>Move down</button></div></div>)}<button className="admin-button secondary" type="button" onClick={() => onChange([...value, blankLike(value[0] ?? listTemplates[name] ?? "")])}>Add item</button></fieldset>;
  }
  if (value !== null && typeof value === "object") {
    if ("assetId" in value || ((/image|portrait/i.test(name)) && "url" in value)) return <ImageField name={name} value={value} onChange={onChange} onUploading={onUploading} />;
    return <fieldset className="admin-content-group"><legend>{title(name)}</legend>{Object.entries(value).map(([key, item]) => <ContentField key={key} name={key} value={item} onChange={(next) => onChange({ ...value, [key]: next })} onUploading={onUploading} depth={depth + 1} />)}</fieldset>;
  }
  if (typeof value === "boolean") return <label className="admin-checkbox"><input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />{title(name)}</label>;
  if (typeof value === "number") return <label>{title(name)}<input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
  if (/description|introduction|biography|body|story/i.test(name)) return <label>{title(name)}<textarea rows={4} value={value ?? ""} onChange={(event) => onChange(event.target.value || (value === null ? null : ""))} /></label>;
  return <label>{title(name)}<input value={value ?? ""} onChange={(event) => onChange(event.target.value || (value === null ? null : ""))} /></label>;
}

function DocumentForm({ path, document, canWrite, onSaved }: { path: string; document: StoreDocument; canWrite: boolean; onSaved: () => void }) {
  const [content, setContent] = useState(Object.keys(document.content).length ? document.content : structuredClone(emptyPages[path] ?? {}));
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || uploads || !canWrite) return;
    setBusy(true); setError("");
    try { await saveDocument(path, document, content); onSaved(); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not save content."); }
    finally { setBusy(false); }
  }
  return <form className="admin-form admin-content-editor" onSubmit={save}>{error && <FormError className="admin-form-error" >{error}</FormError>}<fieldset disabled={busy || uploads > 0 || !canWrite} inert={busy}><ContentField name="Content" value={content} onChange={(value) => setContent(value as ContentObject)} onUploading={(delta) => setUploads((value) => value + delta)} />{canWrite && <button className="admin-button" type="submit" disabled={busy || uploads > 0}>{busy ? "Saving..." : uploads ? "Uploading images..." : "Save & publish"}</button>}</fieldset></form>;
}

export default function AdminContent() {
  const { staff } = useAdminSession();
  const canRead = !!staff?.permissions.includes("content:read");
  const canWrite = !!staff?.permissions.includes("content:write");
  const owner = staff?.role === "owner";
  const canReviews = !!staff?.permissions.includes("reviews:moderate");
  const [tab, setTab] = useState(canRead ? "home" : "reviews");
  const [notice, setNotice] = useState("");
  const path = tab === "site" ? "site" : `pages/${tab}`;
  const query = useAdminQuery(tab !== "reviews" ? path : null, parsers.document);
  return <><div className="admin-heading-actions">{[...(canRead ? ["home", "shop", "about", "contact"] : []), ...(owner ? ["site"] : []), ...(canReviews ? ["reviews"] : [])].map((key) => <button className={`admin-button ${tab !== key ? "secondary" : ""}`} key={key} onClick={() => { setTab(key); setNotice(""); }}>{title(key)}</button>)}</div>{notice && <p role="status" className="admin-notice">{notice}</p>}{tab === "reviews" ? <AdminReviews /> : <section className="admin-card"><div className="admin-card-heading"><h2>{title(tab)} content</h2><button className="admin-text-button" onClick={() => { if (window.confirm("Reload this page and discard unsaved content changes?")) query.refresh(); }}>Reload content</button></div><ApiStatus variant="form" loading={query.loading} error={query.error} retry={query.refresh} />{query.data && !query.loading && <DocumentForm key={`${path}-${query.data.version}`} path={path} document={query.data} canWrite={tab === "site" ? owner : canWrite} onSaved={() => { setNotice("Content saved and published."); query.refresh(); }} />}</section>}</>;
}
