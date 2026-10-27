"use client";

import { useSearchParams } from "next/navigation";
import Storefront from "../components/Storefront";

export default function ShopCatalog() {
  const params = useSearchParams();
  const requested = params.get("collection") ?? "All";
  const filter = requested.slice(0, 100);
  const query = params.get("search") ?? "";
  return <Storefront key={`${filter}:${query}`} isShop initialFilter={filter} initialQuery={query} />;
}



