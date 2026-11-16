"use client";
import { adminRequest } from "../lib/api";
import { useAdminSession } from "./AdminSession";
import { useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { isImageUrl, parseGallery, type GalleryImage } from "../lib/gallery";
import { useAdminQuery } from "../lib/useAdminQuery";
import { AdminDialog, ApiPagination, ApiStatus } from "./ApiControls";
import "./gallery.css";

function Thumbnail({ item }: { item: GalleryImage }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="gallery-missing">Image unavailable</span> : <Image src={item.url} alt={item.alt || item.name || "Gallery image"} width={220} height={180} unoptimized onError={() => setFailed(true)} />;
}

export default function ImageGallery({ onSelect }: { onSelect?: (image: GalleryImage) => void }) {
  const { staff } = useAdminSession();
  const canWrite = staff?.permissions.some((permission) => ["catalog:write", "content:write"].includes(permission));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<GalleryImage | null>(null);
  const query = useAdminQuery("gallery", parseGallery);
  const filtered = (query.data?.data || []).filter((item) => `${item.name} ${item.alt} ${item.url}`.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filtered.length / 12);
  const pasted = isImageUrl(url.trim()) ? { id: "", url: url.trim(), name: "Image from URL", alt: "" } : null;
  const choose = (item: GalleryImage) => { setSelected(item); };
  return <div className="image-gallery">
    <div className="gallery-toolbar"><div className="gallery-heading"><h2>{onSelect ? "Your images" : "Image gallery"}</h2><p>Browse uploaded images or add an image using its cloud URL.</p></div><label className="gallery-search">Search gallery<input type="search" value={search} placeholder="Search by image name" onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label></div>
    <ApiStatus loading={query.loading} error={query.error ? `Gallery is unavailable. ${query.error}` : ""} retry={query.refresh} />
    {!query.loading && !query.error && query.data && <><div className="gallery-grid">{filtered.slice((page - 1) * 12, page * 12).map((item) => <button key={item.id + item.url} type="button" className="gallery-tile" aria-pressed={selected?.url === item.url} onClick={() => choose(item)}><Thumbnail item={item} /><strong>{item.name || item.alt || "Uploaded image"}</strong><small>{item.url}</small></button>)}</div>{!filtered.length && <p>No images found. Try another search or paste a URL.</p>}<ApiPagination page={page} total={filtered.length} totalPages={totalPages} loading={query.loading} onChange={setPage} /></>}
    <div className="gallery-url"><label>Cloud image URL<input type="url" placeholder="https://storage.googleapis.com/.../image.jpg" value={url} onChange={(event) => { setUrl(event.target.value); setSelected(null); setSaved(false); setSaveError(""); }} /></label>{url && !pasted && <p role="status">Enter a complete HTTPS image URL.</p>}{pasted && <button type="button" className="admin-button secondary" onClick={() => choose(pasted)}>Preview URL</button>}{pasted && canWrite && <button type="button" className="admin-button secondary" disabled={saving || saved} onClick={async () => { setSaving(true); setSaveError(""); try { await adminRequest("gallery", { method: "POST", body: { gallery_url: pasted.url } }); setSaved(true); setPage(1); query.refresh(); } catch (error) { setSaveError(error instanceof Error ? error.message : "Unable to add the image."); } finally { setSaving(false); } }}>{saving ? "Adding..." : saved ? "Added to gallery" : "Add URL to gallery"}</button>}{saveError && <p role="alert">{saveError}</p>}</div>
    {selected && <section className="gallery-selection" aria-label="Selected image"><Thumbnail key={selected.url} item={selected} /><div><strong>Selected image</strong><p>{selected.name || selected.alt}</p><label>Image URL<input readOnly value={selected.url} onFocus={(event) => event.target.select()} /></label>{onSelect && <button type="button" className="admin-button" onClick={() => onSelect(selected)}>Use this image</button>}</div></section>}
  </div>;
}

export function GalleryButton({ onSelect }: { onSelect: (image: GalleryImage) => void }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className="admin-button secondary" onClick={() => setOpen(true)}>Select from gallery</button>{open && createPortal(<div className="ek-admin"><AdminDialog title="Select an image" onClose={() => setOpen(false)}><ImageGallery onSelect={(image) => { onSelect(image); setOpen(false); }} /></AdminDialog></div>, document.body)}</>;
}
