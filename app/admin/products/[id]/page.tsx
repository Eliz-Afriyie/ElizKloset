import Skeleton from "../../../components/Skeleton";
import { Suspense } from "react";
import AdminPortal from "../../ui/AdminPortal";
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<Skeleton variant="detail" label="Loading page" />}><Details params={params} /></Suspense>;
}
async function Details({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; return <AdminPortal section="products" productDetailsId={id} />;
}
