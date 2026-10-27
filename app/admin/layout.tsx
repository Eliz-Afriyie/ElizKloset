import type { Metadata } from "next";
import AdminSession from "./ui/AdminSession";
import "./admin.css";
import "./overview.css";
import "./date-picker.css";
import "./controls.css";
import "./product-wizard.css";
import "./dashboard.css";

export const metadata: Metadata = { title: "Admin Portal | ElizKloset", robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminSession><div className="ek-admin">{children}</div></AdminSession>;
}
