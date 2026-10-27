"use client";

import { useSyncExternalStore } from "react";

const preferenceKey = "elizkloset-admin-sidebar";
let fallback = false;
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("admin-sidebar-change", listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener("admin-sidebar-change", listener); };
}
function snapshot() { try { return localStorage.getItem(preferenceKey) === "collapsed"; } catch { return fallback; } }
export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, snapshot, () => false);
  function toggle() {
    fallback = !collapsed;
    try { localStorage.setItem(preferenceKey, fallback ? "collapsed" : "expanded"); } catch { /* Preference remains available for this session. */ }
    window.dispatchEvent(new Event("admin-sidebar-change"));
  }
  return { collapsed, toggle };
}
function subscribeMobile(listener: () => void) {
  const query = window.matchMedia("(max-width: 850px)"); query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
export function useMobileSidebar() {
  return useSyncExternalStore(subscribeMobile, () => window.matchMedia("(max-width: 850px)").matches, () => false);
}
