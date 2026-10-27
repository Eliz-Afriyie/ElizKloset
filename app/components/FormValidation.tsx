"use client";

import { useEffect } from "react";

// Native validation can emit one event per invalid input. Keep attention on the
// first field, including inside a scrollable dialog, without stealing focus on typing.
export default function FormValidation() {
  useEffect(() => {
    let frame = 0;
    function invalid(event: Event) {
      const field = event.target;
      if (!(field instanceof HTMLElement) || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!field.isConnected || !field.checkVisibility()) return;
        field.focus({ preventScroll: true });
        field.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      });
    }
    document.addEventListener("invalid", invalid, true);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("invalid", invalid, true); };
  }, []);
  return null;
}
