import type { Metadata } from "next";
import { Suspense } from "react";
import ShopCatalog from "./ShopCatalog";
import { ShopLoadingSkeleton } from "../components/ProductSkeleton";

export const metadata: Metadata = {
  title: "Collections & New Arrivals | ElizKloset",
  description: "Shop all ElizKloset collections and new arrivals, including corporate dresses and two-piece outfits.",
};

export default function ShopPage() {
  return <Suspense fallback={<ShopLoadingSkeleton />}><ShopCatalog /></Suspense>;
}


