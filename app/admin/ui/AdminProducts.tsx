"use client";
import { GalleryButton } from "./ImageGallery";
import ErrorToast from "../../components/ErrorToast";
import FormError from "../../components/FormError";
import Skeleton from "../../components/Skeleton";

import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from "react";
import Link from "next/link";
import Photo from "../../components/DesignPhoto";
import Icon from "../../components/Icon";
import { formatPrice } from "../../lib/catalog";
import type { AdminProduct, Taxonomy } from "./AdminCatalog";

import VariantEditor, { blankVariant, type VariantDraft } from "./VariantEditor";

import ActionMenu from "./ActionMenu";
import DateRangeFilter, { allDates } from "./DateRangeFilter";
import AdminProductDetails from "./AdminProductDetails";

import { useAdminSession } from "./AdminSession";
import { adminRequest, AdminApiError, unwrap } from "../lib/api";
import { changeProductStatus, deleteProduct, listTaxonomy, parseProductPage, productStockSummary, ProductCompletionError, saveProduct, toProduct, type ProductPage, type ProductRecord } from "../lib/products";
const PAGE_SIZE = 8;
export default function AdminProducts({ startNew = false, detailsId }: { startNew?: boolean; detailsId?: string }) {
  const { staff } = useAdminSession();
  const canWrite = !!staff?.permissions.includes("catalog:write");
  const [result, setResult] = useState<ProductPage | null>(null);
  const [liveTaxonomy, setLiveTaxonomy] = useState<Taxonomy[]>([]);
  const [fetching, setFetching] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [taxonomyError, setTaxonomyError] = useState("");
  const [revision, setRevision] = useState(0);
  const [detailProduct, setDetailProduct] = useState<AdminProduct | undefined>();
  const catalog = result?.data.map(toProduct) ?? [];
  const taxonomy = liveTaxonomy;
  const [dateRange, setDateRange] = useState(allDates);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [stock, setStock] = useState("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [variants, setVariants] = useState<VariantDraft[]>(() => startNew ? [blankVariant()] : []);
  const [image, setImage] = useState("");
  const [imageError, setImageError] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState("");
  const [step, setStep] = useState(1);
  const [review, setReview] = useState<{ name: string; price: number; category: string; description: string; collections: string[] }>({ name: "", price: 0, category: "", description: "", collections: [] });
  const [version, setVersion] = useState(0);
  const details = useRef<HTMLDialogElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(detailsId ?? null);
  useEffect(() => { if (detailsId) details.current?.showModal(); }, [detailsId]);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (startNew) dialog.current?.showModal(); }, [startNew]);
  useEffect(() => {
    if (!Object.keys(fieldErrors).length) return;
    const form = dialog.current?.querySelector('form');
    if (!form) return;
    const aliases: Record<string, string> = { name:'name', description:'description', price:'price', price_amount:'price', discountAmount:'discount', discount_amount:'discount', priceAmount:'price', categoryId:'category', category_id:'category', status:'status', product_status:'status', file:'image' };
    const marked: HTMLElement[] = [];
    let first: HTMLElement | null = null;
    for (const field of Object.keys(fieldErrors)) {
      const target = form.elements.namedItem(aliases[field.split('.')[0]] ?? field);
      if (target instanceof HTMLElement && !target.matches(':disabled')) {
        target.setAttribute('aria-invalid','true');target.setAttribute('aria-describedby','product-validation-details');marked.push(target);first ??= target;
      }
    }
    const frame = requestAnimationFrame(() => { if(first?.checkVisibility()) { first.focus({preventScroll:true}); first.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); } });
    return () => { cancelAnimationFrame(frame);for(const target of marked){target.removeAttribute('aria-invalid');target.removeAttribute('aria-describedby');} };
  }, [fieldErrors, step, busy]);
  const uploadGeneration = useRef(0);
  const [readingImage, setReadingImage] = useState(false);
  const hasSummary = !!result?.summary;
  const low = result?.summary?.lowStock ?? 0;
  const out = result?.summary?.outOfStock ?? 0;
  const total = result?.pagination.total ?? 0;
  const allCount = result?.summary?.all ?? (stock === "all" ? result?.pagination.total : undefined);
  const pages = Math.max(1, result?.pagination.totalPages ?? 1);
  const current = Math.min(page, pages);
  const rows = catalog;
  useEffect(() => {
    const controller = new AbortController();
    listTaxonomy(controller.signal).then((value) => { if (!controller.signal.aborted) { setLiveTaxonomy(value); setTaxonomyError(""); } }).catch((error) => { if (!controller.signal.aborted) setTaxonomyError(error.message); });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setFetching(true); setLoadError(""); setResult(null);
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
        if (query.trim()) params.set("q", query.trim());
        if (category !== "all") params.set("categoryId", category);
        if (stock !== "all") params.set("stock", stock);
        if (dateRange.from) params.set("createdFrom", dateRange.from);
        if (dateRange.to) params.set("createdTo", dateRange.to);
        const value = parseProductPage(await adminRequest<unknown>(`products?${params}`, { signal: controller.signal }));
        if (!controller.signal.aborted) { setResult(value); if (value.pagination.totalPages > 0 && page > value.pagination.totalPages) setPage(value.pagination.totalPages); }
        if (!value.summary) {
          try {
            const summary = await productStockSummary(value, params, controller.signal);
            if (!controller.signal.aborted) setResult({ ...value, summary });
          } catch { /* Keep the catalog available when optional stock totals fail. */ }
        }
      } catch (error) { if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Unable to load products."); }
      finally { if (!controller.signal.aborted) setFetching(false); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, category, stock, page, dateRange.from, dateRange.to, revision]);
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    adminRequest<{ data: ProductRecord }>(`products/${encodeURIComponent(selectedId)}`, { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) setDetailProduct(toProduct(unwrap(value))); })
      .catch((error) => { if (!controller.signal.aborted) setLoadError(error.message); });
    return () => controller.abort();
  }, [selectedId, revision]);
  async function mutateProduct(product: AdminProduct, remove = false) {
    if (busy || !canWrite) return;
    setBusy(true); setError(""); setLoadError("");
    try {
      if (remove) { await deleteProduct(product); details.current?.close(); }
      else { const updated = await changeProductStatus(product); setDetailProduct(updated); }
      setNotice(remove ? "Product deleted." : "Product status updated."); setRevision((value) => value + 1);
    } catch (error) { const message = error instanceof Error ? error.message : "The change could not be saved."; setLoadError(message); setError(message); }
    finally { setBusy(false); }
  }
  function open(product: AdminProduct | null) { setFieldErrors({}); setStep(1); uploadGeneration.current++; setReadingImage(false); setEditing(product); setVariants(product ? product.variants.map((variant) => ({ ...variant, sizes: variant.sizes.map((size) => ({ ...size })) })) : [blankVariant()]); setImage(product?.image ?? ""); setError(""); setImageError(""); setVersion((value) => value + 1); dialog.current?.showModal(); }
  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const generation = ++uploadGeneration.current;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { setImageError("Choose a JPG, PNG or WebP image under 5 MB."); event.target.value = ""; setReadingImage(false); return; }
    setImageError(""); setReadingImage(true);
    const reader = new FileReader(); reader.onload = () => { if (generation !== uploadGeneration.current) return; setImage(String(reader.result)); setReadingImage(false); }; reader.onerror = () => { if (generation !== uploadGeneration.current) return; setImageError("Could not read this image. Please try again."); setReadingImage(false); }; reader.readAsDataURL(file);
  }
  function validateVariants() {
    if (variants.some((variant) => variant.reading || variant.imageError)) return "Please finish choosing valid colour images.";
    if (!variants.length || variants.some((variant) => !variant.color.trim() || !variant.sizes.length || variant.sizes.some((item) => !item.size.trim() || !Number.isInteger(item.stock) || item.stock < 0 || item.stock > 1000000))) return "Every colour needs a name, at least one size and whole quantities of zero or more.";
    if (new Set(variants.map((variant) => variant.color.trim().toLowerCase())).size !== variants.length) return "Each colour name must be unique.";
    if (variants.some((variant) => new Set(variant.sizes.map((item) => item.size.trim().toLowerCase())).size !== variant.sizes.length)) return "Each size must be unique within its colour variant.";
    return "";
  }
  function submitStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setFieldErrors({});
    if (step === 1) {
      const controls = event.currentTarget.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-step="1"] input, [data-step="1"] select, [data-step="1"] textarea');
      for (const control of controls) { if (!control.reportValidity()) return; }
      const data = new FormData(event.currentTarget);
      if (!String(data.get("name")).trim()) { setError("Enter a product name."); return; }
      if (imageError || readingImage) { setError("Please finish choosing a valid product image."); return; }
      setReview({ name: String(data.get("name")).trim(), price: Number(data.get("price")), category: String(data.get("category")), description: String(data.get("description")).trim(), collections: data.getAll("collections").map(String) }); setStep(2); return;
    }
    if (step === 2) { const issue = validateVariants(); if (issue) { setError(issue); return; } setStep(3); return; }
    void save(event);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !canWrite) return; const data = new FormData(event.currentTarget);
    const name = String(data.get("name")).trim(); const price = Number(data.get("price"));
    const discount = Number(data.get("discount") || 0);
    if (!Number.isFinite(discount) || discount < 0 || discount >= price) { setFieldErrors({ discountAmount: ["Enter a discount below the product price."] }); setStep(1); setError("Check the discount amount."); return; }
    if (!name || !Number.isFinite(price) || price <= 0) { setError("Enter a product name and a valid price."); return; }
    if (imageError || readingImage || variants.some((variant) => variant.reading || variant.imageError)) { setError("Please finish choosing valid images before saving."); return; }
    if (!variants.length || variants.some((variant) => !variant.color.trim() || !variant.sizes.length || variant.sizes.some((item) => !item.size.trim() || !Number.isInteger(item.stock) || item.stock < 0))) { setError("Every colour needs a name, at least one size and whole quantities of zero or more."); return; }
    if (new Set(variants.map((variant) => variant.color.trim().toLowerCase())).size !== variants.length) { setError("Each colour name must be unique."); return; }
    if (variants.some((variant) => new Set(variant.sizes.map((item) => item.size.trim().toLowerCase())).size !== variant.sizes.length)) { setError("Each size must be unique within its colour variant."); return; }
    const cleanVariants = variants.map(({ id, color, hex, image, sizes }) => ({ id, color: color.trim(), hex, image, sizes: sizes.map((item) => ({ size: item.size.trim(), stock: item.stock })) }));
    const sizes = [...new Set(cleanVariants.flatMap((variant) => variant.sizes.map((item) => item.size)))];
    const colors = cleanVariants.map((variant) => variant.color);
    const quantity = cleanVariants.reduce((sum, variant) => sum + variant.sizes.reduce((count, item) => count + item.stock, 0), 0);
    const product: AdminProduct = { createdAt: editing?.createdAt ?? new Date().toISOString(), id: editing?.id ?? crypto.randomUUID(), name, discount, price: Math.round(price * 100) / 100, stock: quantity, description: String(data.get("description")).trim(), image: image || cleanVariants.find((variant) => variant.image)?.image || "", categoryId: String(data.get("category")), collectionIds: data.getAll("collections").map(String), sizes, colors, variants: cleanVariants, status: data.get("status") === "active" ? "active" : data.get("status") === "inactive" ? "inactive" : "draft" };
    setBusy(true); setFieldErrors({});
    try { const saved = await saveProduct(product, editing); setDetailProduct(saved); setRevision((value) => value + 1); setNotice("Product saved to the store."); dialog.current?.close(); }
    catch (error) {
      if (error instanceof ProductCompletionError) { setEditing(error.product); setRevision((value) => value + 1); }
      if (error instanceof AdminApiError && Object.keys(error.fields).length) {
        setFieldErrors(error.fields);
        const fields=Object.keys(error.fields);
        if(fields.some(field=>/^(name|description|price|price_amount|priceAmount|categoryId|category_id|file)(\.|$)/.test(field)))setStep(1);
        else if(fields.some(field=>/^(colors|variants)(\.|\[|$)/.test(field)))setStep(2);
        else if(fields.some(field=>field==='status'||field==='product_status'))setStep(3);
        setError(error.message.replace(/Please check the highlighted fields\./i,'Please correct the validation errors below.'));
      } else setError(error instanceof Error ? error.message : "Could not save the product.");
    }
    finally { setBusy(false); }
  }
  return <>

    {taxonomyError && <FormError className="admin-form-error" >{taxonomyError}</FormError>}{!fetching && !taxonomy.some((item) => item.kind === "category") && !taxonomyError && <p className="admin-notice">Create a category before adding products. <Link href="/admin/collections">Manage categories</Link></p>}
    {loadError && <FormError className="admin-form-error" >{loadError} <button className="admin-text-button" onClick={() => setRevision((value) => value + 1)}>Retry</button></FormError>}
    
    <div className="admin-inventory-summary"><button className={stock === "all" ? "selected" : ""} onClick={() => { setStock("all"); setPage(1); }}><span>All products</span><strong>{allCount ?? "\u2014"}</strong></button><button className={stock === "out" ? "selected" : ""} onClick={() => { setStock("out"); setPage(1); }}><span>Out of stock</span><strong className="admin-stock-red" aria-label={hasSummary ? undefined : "Stock total unavailable"}>{hasSummary ? out : "\u2014"}</strong></button><button className={stock === "low" ? "selected" : ""} onClick={() => { setStock("low"); setPage(1); }}><span>Low stock · 1–3 units</span><strong aria-label={hasSummary ? undefined : "Stock total unavailable"}>{hasSummary ? low : "\u2014"}</strong></button></div>
    {(out > 0 || low > 0) && <div className={`admin-inventory-alert ${out > 0 ? "critical" : "warning"}`} role="status"><Icon name="warning" /><div><strong>{out > 0 ? "Inventory needs attention" : "Low stock warning"}</strong><p>{out} out-of-stock and {low} low-stock styles. Review your inventory to keep products available.</p><small>Available stock from the store API.</small></div></div>}
    <ErrorToast message={notice} tone="success" onDismiss={() => setNotice("")} /><ErrorToast message={error || loadError || taxonomyError} />
    <section className="admin-card"><div className="admin-card-heading"><div><h2>Product catalog <span className="admin-count">{result ? total : "\u2014"}</span></h2><p>Manage your store catalog and inventory.</p></div><div className="admin-heading-actions"><DateRangeFilter label="Product creation date" value={dateRange} onChange={(range) => { setDateRange(range); setPage(1); }} /><button className="admin-button" disabled={!canWrite || busy || (!taxonomy.some((item) => item.kind === "category"))} onClick={() => open(null)}><Icon name="plus" />Add product</button></div></div>
      <div className="admin-filters"><label className="admin-search"><Icon name="search" /><input aria-label="Search products" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search products or references…" /></label><select aria-label="Filter product category" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}><option value="all">All categories</option>{taxonomy.filter((item) => item.kind === "category").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Filter stock" value={stock} onChange={(event) => { setStock(event.target.value); setPage(1); }}><option value="all">All stock</option><option value="out">Out of stock</option><option value="low">Low stock</option><option value="available">4+ units</option></select></div>
      {fetching && <Skeleton variant="table" label="Loading products" />}<div hidden={fetching || !!loadError} className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Available stock</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{rows.map((product) => <tr key={product.id}><td><div className="admin-product-cell">{product.image ? <Photo src={product.image} alt={product.name} /> : <span className="admin-image-placeholder"><Icon name="bag" /></span>}<div><strong>{product.name}</strong><small>{product.sizes.join(", ")} · {product.colors.length} {product.colors.length === 1 ? "colour" : "colours"}</small></div></div></td><td>{taxonomy.find((item) => item.id === product.categoryId)?.name ?? "Unassigned"}</td><td>{formatPrice(product.price)}</td><td><span className={`admin-status ${product.stock === 0 ? "red" : product.stock <= 3 ? "amber" : "green"}`}>{product.stock === 0 ? "Out of stock" : product.stock <= 3 ? `Low stock · ${product.stock}` : `${product.stock} units`}</span></td><td><span className="admin-status">{product.status === "active" ? "Active" : product.status === "inactive" ? "Inactive" : "Draft"}</span></td><td>{product.createdAt.slice(0, 10)}</td><td className="admin-action-cell"><ActionMenu name={product.name} actions={[{ label: "View details", onSelect: () => { setDetailProduct(undefined); setSelectedId(product.id); details.current?.showModal(); } }, ...(canWrite && !busy ? [{ label: "Edit product", onSelect: () => open(product) }, { label: product.status === "active" ? "Deactivate product" : "Activate product", onSelect: () => void mutateProduct(product) }] : [])]} deletion={canWrite && !busy ? { name: product.name, description: "Delete this product from the store? Historical orders are retained.", onDelete: () => void mutateProduct(product, true) } : undefined} /></td></tr>)}</tbody></table>{!rows.length && <p className="admin-empty">No products match these filters.</p>}</div>
      {!fetching && !loadError && <nav className="admin-pagination" aria-label="Product pagination"><p role="status">{total ? (current - 1) * PAGE_SIZE + 1 : 0}–{Math.min(current * PAGE_SIZE, total)} of {total} products</p><div><button disabled={current === 1 || fetching} onClick={() => setPage(current - 1)}>Previous</button>{Array.from({ length: pages }, (_, index) => index + 1).filter((number) => number === 1 || number === pages || Math.abs(number - current) <= 1).map((number, index, list) => <span key={number}>{index > 0 && number - list[index - 1] > 1 && <span className="admin-pagination-gap">…</span>}<button aria-label={`Page ${number}`} aria-current={current === number ? "page" : undefined} onClick={() => setPage(number)}>{number}</button></span>)}<button disabled={current === pages || fetching} onClick={() => setPage(current + 1)}>Next</button></div></nav>}
    </section>
    <dialog ref={details} className="shopping-dialog admin-dialog admin-product-details-dialog" aria-labelledby="product-details-title" onClose={() => setSelectedId(null)} onClick={(event) => { if (event.target === event.currentTarget) details.current?.close(); }}>
      <div className="admin-dialog-heading"><h2 id="product-details-title">Product details</h2><button type="button" aria-label="Close product details" autoFocus onClick={() => details.current?.close()}><Icon name="close" /></button></div>
      {loadError && <FormError className="admin-form-error" >{loadError}</FormError>}<AdminProductDetails canWrite={canWrite && !busy} taxonomy={taxonomy} onToggle={(product) => void mutateProduct(product)} onDelete={(product) => void mutateProduct(product, true)} product={detailProduct} onEdit={(product) => { details.current?.close(); open(product); }} onClose={() => details.current?.close()} />
    </dialog>
    <dialog ref={dialog} className="shopping-dialog admin-dialog admin-product-dialog admin-product-wizard" aria-labelledby="product-form-title" onCancel={(event) => { if (busy) event.preventDefault(); }} onClick={(event) => { if (!busy && event.target === event.currentTarget) dialog.current?.close(); }}><div className="admin-dialog-heading"><div><p className="admin-small-label">CATALOG WORKSPACE</p><h2 id="product-form-title">{editing ? "Edit product" : "Add a new product"}</h2></div><button aria-label="Close product form" disabled={busy} onClick={() => dialog.current?.close()}><Icon name="close" /></button></div>
      <ol className="admin-wizard-steps" aria-label="Product form progress">{["Product details", "Colours & stock", "Review & save"].map((label, index) => <li key={label} className={step === index + 1 ? "current" : step > index + 1 ? "complete" : ""} aria-current={step === index + 1 ? "step" : undefined}><span>{index + 1}</span><strong>{label}</strong></li>)}</ol><form className="admin-form admin-wizard-form" key={version} noValidate onSubmit={submitStep}>{imageError && <FormError className="admin-form-error" >{imageError}</FormError>}{error && <FormError className="admin-form-error admin-wizard-error">{error}{Object.keys(fieldErrors).length > 0 && <ul id="product-validation-details">{Object.entries(fieldErrors).map(([field,messages]) => <li key={field}>{field === "status" || field === "product_status" ? "Publication status" : field}: {messages.join(" ")}</li>)}</ul>}{Object.keys(fieldErrors).length === 0 && <button type="button" disabled={busy} onClick={() => { dialog.current?.close(); setRevision((value) => value + 1); }}>Reload catalog</button>}</FormError>}<div className="admin-wizard-body" inert={busy}><div className="admin-wizard-panel" data-step="1" hidden={step !== 1}><p className="admin-notice">Changes are saved to the store only after final confirmation. Quantities are physical stock, including reserved units.</p><div className="admin-form-columns admin-product-fields"><label>Product name<input name="name" required maxLength={150} defaultValue={editing?.name} /></label><label>Category<select name="category" required defaultValue={editing?.categoryId ?? taxonomy.find((item) => item.kind === "category")?.id ?? ""}>{taxonomy.filter((item) => item.kind === "category").map((item) => <option key={item.id} value={item.id}>{item.name}{item.status === "draft" ? " (draft)" : ""}</option>)}</select></label><label>Price (GHS)<input name="price" type="number" min="0.01" max="1000000" step="0.01" required defaultValue={editing?.price ?? ""} /></label><label>Discount amount (GHS)<input name="discount" aria-describedby="product-discount-help" type="number" min="0" step="0.01" defaultValue={editing?.discount ?? 0} /></label></div><p className="admin-discount-help" id="product-discount-help">The discount is taken off the original price. Discounted products display the Reduced to clear tag.</p><label>Description<textarea name="description" rows={3} maxLength={3000} defaultValue={editing?.description} /></label><fieldset className="admin-collection-options"><legend>Collections</legend>{taxonomy.filter((item) => item.kind === "collection").map((item) => <label key={item.id}><input type="checkbox" name="collections" value={item.id} defaultChecked={editing?.collectionIds.includes(item.id)} />{item.name}</label>)}<Link href="/admin/collections" onClick={() => dialog.current?.close()}>Manage categories & collections <Icon name="arrow" /></Link></fieldset><label>Product image (JPG, PNG or WebP · up to 5 MB)<input name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} /></label><GalleryButton onSelect={(asset) => { uploadGeneration.current++; setReadingImage(false); setImageError(""); setImage(asset.url); }} />{readingImage && <p role="status">Reading image…</p>}{image && <div className="admin-image-preview"><Photo src={image} alt="Product image preview" /><button className="admin-text-button" type="button" onClick={() => { uploadGeneration.current++; setReadingImage(false); setImage(""); setImageError(""); }}>Remove image</button></div>}</div><div className="admin-wizard-panel" data-step="2" hidden={step !== 2}><VariantEditor key={version} variants={variants} setVariants={setVariants} /></div><div className="admin-wizard-panel" data-step="3" hidden={step !== 3}><div className="admin-wizard-review"><div>{image || variants.find((variant) => variant.image)?.image ? <Photo src={image || variants.find((variant) => variant.image)!.image} alt={review.name} /> : <span className="admin-wizard-no-image"><Icon name="bag" /></span>}</div><div><p className="admin-small-label">READY FOR YOUR REVIEW</p><h3>{review.name}</h3><strong className="admin-wizard-price">{formatPrice(review.price)}</strong><p>{taxonomy.find((item) => item.id === review.category)?.name}</p><p>{review.collections.map((id) => taxonomy.find((item) => item.id === id)?.name).filter(Boolean).join(", ") || "No collections assigned"}</p></div></div>{review.description && <p className="admin-wizard-description">{review.description}</p>}<div className="admin-wizard-variant-summary">{variants.map((variant) => <article key={variant.id}><span style={{ backgroundColor: variant.hex }} /><strong>{variant.color}</strong><span>{variant.sizes.reduce((sum, item) => sum + (Number.isFinite(item.stock) ? item.stock : 0), 0)} units</span><small>{variant.image ? "Colour photo added" : "No colour photo"}</small></article>)}</div><p className="admin-wizard-total">Total physical stock <strong>{variants.reduce((sum, variant) => sum + variant.sizes.reduce((count, size) => count + (Number.isFinite(size.stock) ? size.stock : 0), 0), 0)} units</strong></p><label>Publication status<select name="status" defaultValue={editing?.status ?? "draft"}><option value="draft">Draft</option><option value="active">Active</option><option value="inactive">Inactive / hidden</option></select></label><p className="admin-wizard-save-note">Confirm to save these changes to your store.</p></div></div><div className="admin-wizard-footer"><span>Step {step} of 3</span><div><button className="admin-button secondary" disabled={busy} type="button" onClick={() => { if (step === 1) dialog.current?.close(); else { setError(""); setStep(step - 1); } }}>{step === 1 ? "Cancel" : "Back"}</button><button className="admin-button" type="submit" disabled={busy || !canWrite || readingImage || variants.some((variant) => variant.reading)}>{busy ? "Saving..." : step === 3 ? "Save product" : "Next"}{step < 3 && <Icon name="arrow" />}</button></div></div></form>
    </dialog>
  </>;
}
