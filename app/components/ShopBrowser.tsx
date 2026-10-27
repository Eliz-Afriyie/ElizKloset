"use client";
import ErrorToast from "./ErrorToast";
import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import type { Product } from "../lib/catalog";

import { storeRequest } from "../lib/store-api";
import { parseProductPage, type ProductPage } from "../lib/store-catalog";
import { useStoreCatalog } from "./StoreCatalog";
import Skeleton from "./Skeleton";

export default function ShopBrowser({ initialCategory, initialQuery, renderProduct }: { initialCategory: string; initialQuery: string; renderProduct: (product: Product) => ReactNode }) {
  const { categories, collections } = useStoreCatalog();
  const [selected, setSelected] = useState(initialCategory === "All" ? "" : initialCategory);
  const [query, setQuery] = useState(initialQuery); const [size, setSize] = useState(""); const [color, setColor] = useState("");
  const [sort, setSort] = useState("featured"); const [stock, setStock] = useState(false); const [maxPrice, setMaxPrice] = useState("");
  const [view, setView] = useState("grid"); const [filtersOpen, setFiltersOpen] = useState(false);
  const [result, setResult] = useState<ProductPage | null>(null); const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [revision, setRevision] = useState(0);
  const filters = new URLSearchParams({ limit: "8", sort });
  if (query.trim()) filters.set("q", query.trim());
  if (selected) {
    const category = categories.find((item) => item.slug === selected || item.name === selected);
    const collection = collections.find((item) => item.slug === selected || item.name === selected);
    if (category) filters.set("category", category.slug);
    else filters.set("collection", collection?.slug ?? selected.toLowerCase().replace(/\s+/g, "-"));
  }
  if (size) filters.set("size", size); if (color) filters.set("color", color);
  if (stock) filters.set("inStock", "true"); if (maxPrice) filters.set("maxPrice", String(Math.round(Number(maxPrice) * 100)));
  const filterKey = filters.toString();
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError(""); setItems([]); setResult(null);
      try { const page = parseProductPage(await storeRequest(`products?${filterKey}`, { signal: controller.signal })); if (!controller.signal.aborted) { setResult(page); setItems(page.data); } }
      catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load products."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [filterKey, revision]);
  // Remount the result component on filter changes so an old next-page request cannot replace a new filter.
  function clear() { setSelected(""); setQuery(""); setSize(""); setColor(""); setStock(false); setMaxPrice(""); }
  return <>
    <section className="shop-banner editorial-shop-banner"><div className="shop-banner-photo"><Image src="/images/hero-burgundy.png" alt="ElizKloset corporate fashion" fill sizes="50vw" style={{ objectPosition: "center top" }} /></div><div className="shop-banner-copy"><p className="shop-banner-eyebrow">Collections &amp; New Arrivals</p><h1>Elegant<br /><span>Corporate Wear</span></h1><p>Discover stylish and professional outfits for every occasion.</p></div></section>
    <section className="shop-browser section" id="shop" aria-label="Browse products">
      <button className="mobile-filter-button button outline" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>Show filters</button>
      <aside className={`shop-sidebar ${filtersOpen ? "filters-open" : ""}`} aria-label="Product filters"><div className="sidebar-heading"><h2>Filters</h2><button onClick={clear}>Clear All</button></div>
        <details open><summary>Categories and collections</summary><div className="checkbox-options"><label><input type="radio" name="collection" checked={!selected} onChange={() => setSelected("")} />All styles</label>{[...categories, ...collections].map((item) => <label key={item.id}><input type="radio" name="collection" checked={selected === item.slug} onChange={() => setSelected(item.slug)} />{item.name}</label>)}</div></details>
        <details open><summary>Size</summary><select aria-label="Filter size" value={size} onChange={(event) => setSize(event.target.value)}><option value="">All sizes</option>{result?.facets.sizes.map((value) => <option key={value}>{value}</option>)}</select></details>
        <details open><summary>Colour</summary><select aria-label="Filter colour" value={color} onChange={(event) => setColor(event.target.value)}><option value="">All colours</option>{result?.facets.colors.map((item) => <option key={item.name} value={(item as { id?: string }).id ?? item.name}>{item.name}</option>)}</select></details>
        <details open><summary>Price</summary><label>Maximum price (GHS)<input type="number" min="0" step="0.01" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} /></label></details>
        <details open><summary>Availability</summary><label><input type="checkbox" checked={stock} onChange={(event) => setStock(event.target.checked)} />In stock only</label></details>
      </aside>
      <div className="shop-results"><div className="shop-toolbar"><label className="inline-shop-search"><span className="sr-only">Search products</span><input type="search" placeholder="Search styles..." value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="sort-control">Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Featured</option><option value="newest">Newest</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option><option value="name-asc">Name: A to Z</option></select></label><span role="status">{result?.pagination.total ?? 0} products</span><button className="text-button" onClick={() => setView(view === "grid" ? "list" : "grid")}>{view === "grid" ? "List view" : "Grid view"}</button></div>
      <ErrorToast message={error} onRetry={() => setRevision((value) => value + 1)} />
      {loading ? <Skeleton variant="cards" label="Loading products" /> : <StoreResults key={filterKey + revision} initial={items} initialPage={result} filters={filterKey} view={view} renderProduct={renderProduct} />}
      {!loading && !error && !items.length && <div className="empty-state"><h3>No styles found</h3><p>Try adjusting your filters or check back for new arrivals.</p><button className="button outline" onClick={clear}>Clear filters</button></div>}
      </div>
    </section>
  </>;
}
function StoreResults({ initial, initialPage, filters, view, renderProduct }: { initial: Product[]; initialPage: ProductPage | null; filters: string; view: string; renderProduct: (product: Product) => ReactNode }) {
  const [items, setItems] = useState(initial); const [page, setPage] = useState(initialPage); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function more() {
    if (busy || !page?.pagination.nextCursor) return; setBusy(true); setError("");
    try { const params = new URLSearchParams(filters); params.set("cursor", page.pagination.nextCursor); const next = parseProductPage(await storeRequest(`products?${params}`)); setItems((items) => [...new Map([...items, ...next.data].map((item) => [item.id, item])).values()]); setPage(next); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to load more styles."); }
    finally { setBusy(false); }
  }
  return <><div className={`product-grid shop-product-grid ${view === "list" ? "list-view" : ""}`}>{items.map(renderProduct)}</div>{busy && <Skeleton variant="cards" rows={2} label="Loading more products" />}{page && <p className="pagination-status" role="status">Showing {items.length} of {page.pagination.total} styles</p>}<ErrorToast message={error} onRetry={() => void more()} />{page?.pagination.hasMore && <button className="button outline" onClick={more} disabled={busy}>{busy ? "Loading..." : "Load more"}</button>}</>;
}

