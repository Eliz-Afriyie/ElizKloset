import Skeleton from "../../components/Skeleton";
import { Suspense } from "react";
import Storefront from "../../components/Storefront";


export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <Suspense fallback={<main className="section commerce-page"><Skeleton variant="detail" label="Loading product details" /></main>}><ProductPage params={params} /></Suspense>;
}

async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <Storefront key={slug} commercePage="product" productId={slug} />;
}
