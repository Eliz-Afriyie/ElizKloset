"use client";
import { cloneElement, useId, type ReactElement } from "react";
export default function Tooltip({ label, children, disabled = false }: { label: string; children: ReactElement<{ "aria-describedby"?: string }>; disabled?: boolean }) {
  const id = useId();
  return <span className="customer-tooltip">{cloneElement(children, { "aria-describedby": [children.props["aria-describedby"], !disabled && id].filter(Boolean).join(" ") || undefined })}<span id={id} role="tooltip" hidden={disabled} className="customer-tooltip-text">{label}</span></span>;
}
