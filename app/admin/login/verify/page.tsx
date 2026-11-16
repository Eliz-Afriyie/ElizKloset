import type { Metadata } from "next";
import AdminOtp from "../../ui/AdminOtp";
import { redirect } from "next/navigation";
import { ADMIN_MFA_ENABLED } from "../../lib/auth-config";

export const metadata: Metadata = { title: "Verify staff sign-in | ElizKloset" };
export default function Page() {
  if (!ADMIN_MFA_ENABLED) redirect("/admin/login");
  return <AdminOtp />;
}
