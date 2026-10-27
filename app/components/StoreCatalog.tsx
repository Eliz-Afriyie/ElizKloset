"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Product } from "../lib/catalog";
import { storeRequest, unwrapStore, StoreApiError } from "../lib/store-api";
import { parseProduct, parseProductPage, parseTaxonomy, type StoreTaxonomy } from "../lib/store-catalog";
import { useShoppingStore } from "../lib/shopping-store";

export type StoreSite = { features?: { contactSubmission?: boolean; newsletterSignup?: boolean }; socials?: { platform: string; handle: string; url: string }[] };
const Context = createContext<{ products: Product[]; categories: StoreTaxonomy[]; collections: StoreTaxonomy[]; site: StoreSite | null; loading: boolean; error: string; retry: () => void }>({ products: [], categories: [], collections: [], site: null, loading: true, error: "", retry() {} });
export const useStoreCatalog = () => useContext(Context);
export default function StoreCatalog({ children, slug }: { children: ReactNode; slug?: string }) {
  const [products, setProducts] = useState<Product[]>([]); const [categories, setCategories] = useState<StoreTaxonomy[]>([]); const [collections, setCollections] = useState<StoreTaxonomy[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [revision, setRevision] = useState(0);
  const [site, setSite] = useState<StoreSite | null>(null);
  const { state } = useShoppingStore();
  const needed = JSON.stringify([...new Set([...(slug ? [slug] : []), ...state.cart.map((line) => line.productId), ...state.wishlist])]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(async () => {
      setLoading(true); setError("");
      const results = await Promise.allSettled([storeRequest("products?limit=50&sort=newest", { signal: controller.signal }).then(parseProductPage), storeRequest("categories", { signal: controller.signal }).then(parseTaxonomy), storeRequest("collections", { signal: controller.signal }).then(parseTaxonomy), storeRequest<{ data: StoreSite }>("site", { signal: controller.signal })]);
      if (controller.signal.aborted) return;
      const failures: string[] = []; let items: Product[] = [];
      if (results[0].status === "fulfilled") items = results[0].value.data; else failures.push(results[0].reason.message);
      if (results[1].status === "fulfilled") setCategories(results[1].value); else failures.push(results[1].reason.message);
      if (results[2].status === "fulfilled") setCollections(results[2].value); else failures.push(results[2].reason.message);
      if (results[3].status === "fulfilled") setSite(results[3].value.data); else failures.push(results[3].reason.message);
      const missing = (JSON.parse(needed) as string[]).filter((id) => !items.some((item) => item.id === id));
      const details = await Promise.allSettled(missing.map(async (id) => parseProduct(unwrapStore(await storeRequest(`products/${encodeURIComponent(id)}`, { signal: controller.signal })))));
      for (const detail of details) if (detail.status === "fulfilled") items.push(detail.value); else if (!(detail.reason instanceof StoreApiError && detail.reason.status === 404)) failures.push(detail.reason.message);
      if (!controller.signal.aborted) { setProducts(items); setError([...new Set(failures.filter(Boolean))].join(" ")); setLoading(false); }
    }).catch((error) => { if (!controller.signal.aborted) { setError(error instanceof Error ? error.message : "Unable to load the store."); setLoading(false); } });
    return () => controller.abort();
  }, [needed, revision]);
  return <Context.Provider value={{ products, categories, collections, site, loading, error, retry: () => setRevision((value) => value + 1) }}>{children}</Context.Provider>;
}

