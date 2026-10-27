"use client";
import { useMemo, useSyncExternalStore } from "react";
import { readShoppingState, type ShoppingState } from "./catalog";
import { useCustomerSession } from "./customer-session";
const KEY = "elizkloset-shopping-v2";
const EMPTY = '{"cart":[],"wishlist":[]}';
let fallback = EMPTY;
let memoryOnly = false;
const wishlists = new Map<string, string>();
const listeners = new Set<() => void>();
function wishlistKey(userId: string | number | undefined) { return userId === undefined ? null : `elizkloset-wishlist-v1:${encodeURIComponent(String(userId))}`; }
function snapshot(key: string | null) {
  let cartRaw = fallback; let wishlistRaw = key ? wishlists.get(key) ?? "[]" : "[]";
  try { if (!memoryOnly) { cartRaw = localStorage.getItem(KEY) ?? fallback; if (key) wishlistRaw = localStorage.getItem(key) ?? wishlistRaw; } } catch {}
  let wishlist = [];
  try { wishlist = JSON.parse(wishlistRaw); } catch {}
  return JSON.stringify({ cart: readShoppingState(cartRaw).cart, wishlist: readShoppingState(JSON.stringify({ wishlist })).wishlist });
}
function subscribe(listener: () => void) {
  listeners.add(listener); window.addEventListener("storage", listener);
  return () => { listeners.delete(listener); window.removeEventListener("storage", listener); };
}
export function useShoppingStore() {
  const { user, getUser } = useCustomerSession();
  const key = wishlistKey(user?.id);
  const raw = useSyncExternalStore(subscribe, () => snapshot(key), () => EMPTY);
  const state = useMemo(() => readShoppingState(raw), [raw]);
  const update = (change: (previous: ShoppingState) => ShoppingState) => {
    // Read the latest verified identity, including immediately after an async session check.
    const currentKey = wishlistKey(getUser()?.id);
    const next = change(readShoppingState(snapshot(currentKey)));
    fallback = JSON.stringify({ cart: next.cart, wishlist: [] });
    if (currentKey) wishlists.set(currentKey, JSON.stringify(next.wishlist));
    try { localStorage.setItem(KEY, fallback); if (currentKey) localStorage.setItem(currentKey, JSON.stringify(next.wishlist)); } catch { memoryOnly = true; }
    listeners.forEach((listener) => listener());
  };
  return { state, update };
}
