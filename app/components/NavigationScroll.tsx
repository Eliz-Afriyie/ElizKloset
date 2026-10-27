"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export default function NavigationScroll() {
  const pathname = usePathname();
  const historyNavigation = useRef<string | null>(null);

  useEffect(() => {
    const onPopState = () => { historyNavigation.current = window.location.pathname; };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    // Let the browser restore Back/Forward positions and explicit anchor links.
    const restoringHistory = historyNavigation.current === pathname;
    historyNavigation.current = null;
    if (restoringHistory) return;
    if (window.location.hash) return;
    const frame = requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}
