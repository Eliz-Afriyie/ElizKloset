import Skeleton from "../../components/Skeleton";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import AdminPortal from "../ui/AdminPortal";
const sections = ["products", "collections", "orders", "customers", "content", "settings"];
export function generateStaticParams() { return sections.map((section) => ({ section })); }
export default function Page({ params }: { params: Promise<{ section: string }> }) {
  return <Suspense fallback={<Skeleton variant="workspace" label="Loading page" />}><Section params={params} /></Suspense>;
}
async function Section({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  return <AdminPortal key={section} section={section} />;
}
