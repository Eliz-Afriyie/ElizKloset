"use client";
import Skeleton from "../../components/Skeleton";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Icon from "../../components/Icon";
import { useAdminSession } from "./AdminSession";
import AdminProducts from "./AdminProducts";
import LiveTaxonomy from "./LiveTaxonomy";
import LiveAdminOverview from "./LiveAdminOverview";
import AdminOrders from "./AdminOrders";
import LiveAdminCustomers from "./LiveAdminCustomers";
import AdminContent from "./AdminContent";
import AdminSettings from "./AdminSettings";
import { AdminDialog } from "./ApiControls";
import { useSidebarCollapsed, useMobileSidebar } from "../lib/sidebar";

const navigation = [
  { id: "dashboard", label: "Overview", icon: "diamond", permissions: ["dashboard:read"] },
  { id: "products", label: "Products", icon: "bag", permissions: ["catalog:read"] },
  { id: "collections", label: "Collections & categories", icon: "diamond", permissions: ["catalog:read"] },
  { id: "orders", label: "Orders", icon: "truck", permissions: ["orders:read"] },
  { id: "customers", label: "Customers", icon: "user", permissions: ["customers:read"] },
  { id: "content", label: "Store content", icon: "heart", permissions: ["content:read", "reviews:moderate"] },
  { id: "settings", label: "Settings & staff", icon: "lock", permissions: ["settings:write", "staff:manage"] },
] as const;

export default function AdminPortal({ section, startNewProduct = false, productDetailsId }: { section: string; startNewProduct?: boolean; productDetailsId?: string }) {
  const { leave, loading, staff, sessionError } = useAdminSession();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const { collapsed, toggle } = useSidebarCollapsed();
  const mobile = useMobileSidebar();
  const sidebar = useRef<HTMLElement>(null);
  const collapseButton = useRef<HTMLButtonElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menuOpen || !mobile) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = menuButton.current;
    document.body.style.overflow = "hidden";
    sidebar.current?.querySelector<HTMLElement>("a, button")?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); setMenuOpen(false); }
      if (event.key === "Tab") {
        const items = Array.from(sidebar.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []).filter((element) => element.getClientRects().length);
        if (collapseButton.current) items.push(collapseButton.current);
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", handleKey); trigger?.focus(); };
  }, [menuOpen, mobile]);
  const [logout, setLogout] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  if (loading) return <Skeleton variant="workspace" label="Checking your staff session" />;
  if (!staff) return <main className="admin-access"><div className="admin-login-lock"><Icon name="lock" /></div><p className="admin-small-label">ELIZKLOSET STAFF PORTAL</p><h1>Your workspace starts here.</h1><p>Sign in with your staff account to manage the store.</p>{sessionError && <p role="alert">{sessionError}</p>}<Link className="admin-button" href="/admin/login">Go to staff login <Icon name="arrow" /></Link><Link href="/" className="admin-text-button">Back to storefront</Link></main>;
  const visible = navigation.filter((item) => item.permissions.some((permission) => staff.permissions.includes(permission)));
  const current = visible.find((item) => item.id === section);
  const title = navigation.find((item) => item.id === section)?.label ?? "Overview";
  async function signOut() {
    setSigningOut(true); setLogoutError("");
    try { await leave(); router.push("/admin/login"); }
    catch (error) { setLogoutError(error instanceof Error ? error.message : "Could not sign out. Please retry."); }
    finally { setSigningOut(false); }
  }
  const displayName = staff.name?.trim() || staff.email.split("@")[0];
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const management = ["content", "settings"];
  function links(items: typeof visible) { return items.map((item) => <Link key={item.id} href={item.id === "dashboard" ? "/admin" : "/admin/" + item.id} className={section === item.id ? "active" : ""} aria-label={item.label} title={collapsed && !mobile ? item.label : undefined} aria-current={section === item.id ? "page" : undefined} onClick={() => setMenuOpen(false)}><Icon name={item.icon} /><span className="admin-nav-text">{item.label}</span></Link>); }
  return <div className={"admin-shell admin-modern-shell " + (collapsed ? "sidebar-collapsed" : "")}>
    <button ref={collapseButton} className="admin-sidebar-collapse" title={mobile ? "Close navigation" : collapsed ? "Expand sidebar" : "Collapse sidebar"} type="button" aria-label={mobile ? "Close navigation" : collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={mobile ? menuOpen : !collapsed} aria-controls="admin-navigation" onClick={() => mobile ? setMenuOpen(false) : toggle()}><Icon name={mobile ? "close" : collapsed ? "chevron-right" : "chevron-left"} /></button>
    {mobile && menuOpen && <button className="admin-sidebar-backdrop" aria-label="Close navigation" tabIndex={-1} onClick={() => setMenuOpen(false)} />}
    <aside ref={sidebar} id="admin-navigation" inert={mobile && !menuOpen} className={"admin-sidebar " + (menuOpen ? "is-open" : "")} aria-label="Staff navigation">
      <div className="admin-sidebar-brand"><Link href="/admin" aria-label="ElizKloset overview"><span className="admin-brand-monogram">EK</span><span className="admin-brand-text">Eliz<span>Kloset</span><small>STORE MANAGEMENT</small></span></Link></div>
      <p className="admin-nav-label">Main menu</p><nav aria-label="Admin navigation">{links(visible.filter((item) => !management.includes(item.id)))}</nav>
      {visible.some((item) => management.includes(item.id)) && <><p className="admin-nav-label">Store management</p><nav aria-label="Store management">{links(visible.filter((item) => management.includes(item.id)))}</nav></>}
      <div className="admin-sidebar-bottom"><Link href="/" aria-label="View storefront" title="View storefront"><Icon name="bag" /><span className="admin-nav-text">View storefront</span><Icon name="arrow" className="admin-nav-external" /></Link><button title="Sign out" aria-label="Sign out" onClick={() => setLogout(true)}><Icon name="arrow-left" /><span className="admin-nav-text">Sign out</span></button><div className="admin-sidebar-profile"><span className="admin-avatar">{initials}</span><div className="admin-nav-text"><strong>{displayName}</strong><small>{staff.role}</small></div></div></div>
    </aside>
    <div className="admin-workspace"><header className="admin-topbar"><div className="admin-topbar-heading"><button ref={menuButton} className="admin-mobile-menu" aria-label="Open navigation" aria-controls="admin-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" /></button><div><h1>{section === "dashboard" ? "Welcome back, " + displayName.split(" ")[0] + "." : title}</h1><p>{section === "dashboard" ? "Here is what is happening with your store today." : "Your store, thoughtfully managed."}</p></div></div><div className="admin-topbar-actions"><span className="admin-header-date"><Icon name="calendar" />{new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</span><Link href="/" className="admin-store-link">Visit store <Icon name="arrow" /></Link><span className="admin-header-profile" title={staff.email}><span className="admin-avatar" aria-label={displayName}>{initials}</span><span>{displayName}<small>{staff.role}</small></span></span></div></header>
      <main className="admin-main" id="admin-main-content">
        {!current ? <section className="admin-card"><h2>Access restricted</h2><p>Your staff account does not have permission to view this section.</p>{visible[0] && <Link className="admin-button" href={visible[0].id === "dashboard" ? "/admin" : "/admin/" + visible[0].id}>Open your workspace</Link>}</section> : <>
          {section === "dashboard" && <LiveAdminOverview />}
          {section === "products" && <AdminProducts startNew={startNewProduct} detailsId={productDetailsId} />}
          {section === "collections" && <LiveTaxonomy />}
          {section === "orders" && <AdminOrders />}
          {section === "customers" && <LiveAdminCustomers />}
          {section === "content" && <AdminContent />}
          {section === "settings" && <AdminSettings />}
        </>}
        <footer className="admin-footer"><span>ElizKloset - Management workspace</span><span>Thoughtfully styled. Carefully managed.</span></footer>
      </main>
    </div>
    {logout && <AdminDialog title="Leave the workspace?" busy={signingOut} onClose={() => setLogout(false)}><p>Your staff session will end. Saved changes remain in the store.</p>{logoutError && <p className="admin-form-error" role="alert">{logoutError}</p>}<div className="admin-dialog-actions"><button className="admin-button secondary" disabled={signingOut} onClick={() => setLogout(false)}>Stay here</button><button className="admin-button" disabled={signingOut} onClick={() => void signOut()}>{signingOut ? "Signing out..." : "Sign out"}</button></div></AdminDialog>}
  </div>;
}
