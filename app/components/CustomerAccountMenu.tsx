"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useCustomerSession } from "../lib/customer-session";
import Tooltip from "./Tooltip";
import { useRouter } from "next/navigation";
import Icon from "./Icon";

export default function CustomerAccountMenu({ onProfile, onSignIn, onOpen }: { onProfile: () => void; onSignIn: () => void; onOpen?: () => void }) {
  const router = useRouter();
  const { user, requestSignOut } = useCustomerSession(); const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null); const button = useRef<HTMLButtonElement>(null); const menu = useRef<HTMLDivElement>(null); const id = useId();
  const name = user?.first_name || user?.display_name || "Your account";
  const initials = (user?.display_name || name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  function openMenu() { onOpen?.(); setOpen(true); }
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    function outside(event: PointerEvent) { if (!root.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: globalThis.KeyboardEvent) { if (event.key === "Escape") { event.preventDefault(); setOpen(false); button.current?.focus(); } }
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault(); const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    items[event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length]?.focus();
  }
  return <div ref={root} className="customer-account-control" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <Tooltip label={user ? "Open account menu" : "Sign in or create an account"} disabled={open}><button ref={button} type="button" className={`icon-button customer-account-button ${user ? "is-signed-in" : ""}`} aria-label="Your account" aria-haspopup={user ? "menu" : "dialog"} aria-expanded={user ? open : undefined} aria-controls={user ? id : undefined} onClick={() => user ? open ? setOpen(false) : openMenu() : onSignIn()} onKeyDown={(event) => { if (user && ["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); openMenu(); } }}>{user ? <><span className="customer-account-avatar" aria-hidden="true">{initials}<span className="customer-account-check">✓</span></span><span className="customer-account-name">Hi, {name}</span><span className="sr-only">Signed in as {user.display_name || name}</span></> : <Icon name="user" />}</button></Tooltip>
    {user && open && <div ref={menu} id={id} className="customer-account-menu" role="menu" aria-label="Account options" onKeyDown={navigate}><div className="customer-menu-identity"><strong>{user.display_name || name}</strong><small>{user.email || user.phone}</small></div><button type="button" role="menuitem" title="View and update your account details" onClick={() => { setOpen(false); onProfile(); }}><Icon name="user" />Go to profile<Icon name="arrow" /></button><button type="button" role="menuitem" title="View your order history and delivery updates" onClick={() => { setOpen(false); router.push("/orders"); }}><Icon name="bag" />Orders<Icon name="arrow" /></button><button type="button" role="menuitem" title="Review sign-out confirmation" onClick={() => { setOpen(false); requestSignOut(); }}><Icon name="arrow-left" />Sign out</button></div>}
  </div>;
}
