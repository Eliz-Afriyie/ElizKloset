"use client";

import { Children, useEffect, useRef, type ReactNode } from "react";

export default function FormError({ children, className = "", field }: { children: ReactNode; className?: string; field?: string }) {
  const summary = useRef<HTMLDivElement>(null);
  const message = Children.toArray(children).filter((child) => typeof child === "string" || typeof child === "number").join("");
  useEffect(() => {
    const element = summary.current;
    if (!element || !element.checkVisibility()) return;
    const form = element.closest("form");
    const input = field ? form?.elements.namedItem(field) : null;
    const target = input instanceof HTMLElement && !input.matches(":disabled") ? input : element;
    if (target !== element) target.setAttribute("aria-invalid", "true");
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    return () => { if (target !== element) target.removeAttribute("aria-invalid"); };
  }, [message, field]);
  return <div ref={summary} className={`form-error-summary ${className}`} role="alert" tabIndex={-1}>{children}</div>;
}
