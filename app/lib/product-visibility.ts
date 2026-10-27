"use client";

import { useSyncExternalStore } from "react";

let hidden: readonly string[] = [];
const listeners = new Set<() => void>();
const empty: readonly string[] = [];
export function setProductHidden(id: string, hide: boolean) {
  hidden = hide ? [...new Set([...hidden, id])] : hidden.filter((item) => item !== id);
  listeners.forEach((listener) => listener());
}
export function resetProductVisibility() { hidden = []; listeners.forEach((listener) => listener()); }
export function useHiddenProducts() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => hidden, () => empty);
}
