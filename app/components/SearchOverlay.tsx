"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "./Icon";
import Tooltip from "./Tooltip";

export default function SearchOverlay({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, [open]);
  function close() { dialog.current?.close(); }
  return <>
    <Tooltip label="Search products" disabled={open}><button ref={trigger} className="icon-button" type="button" aria-label="Search products" aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={() => { setQuery(initialQuery); dialog.current?.showModal(); input.current?.focus(); setOpen(true); }}><Icon name="search" /></button></Tooltip>
    <dialog ref={dialog} id={id} className="search-overlay" aria-labelledby={`${id}-title`} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(); } }} onClose={() => { setOpen(false); trigger.current?.focus(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="search-overlay-heading"><div><p className="eyebrow">Find your next favourite</p><h2 id={`${id}-title`}>What are you looking for?</h2></div><button type="button" className="icon-button" aria-label="Close search" title="Close search" onClick={close}><Icon name="close" /></button></div>
      <form role="search" onSubmit={(event) => { event.preventDefault(); close(); router.push(query.trim() ? `/shop?search=${encodeURIComponent(query.trim())}` : "/shop"); }}>
        <label htmlFor={`${id}-query`}>Search our collection</label>
        <div className="search-overlay-field"><Icon name="search" /><input ref={input} id={`${id}-query`} name="search" type="search" autoFocus autoComplete="off" maxLength={254} placeholder="Dresses, colours, two pieces..." value={query} onChange={(event) => setQuery(event.target.value)} /><button className="button primary" type="submit">Search <Icon name="arrow" /></button></div>
        <p className="search-overlay-hint">Search by style, product name or colour.</p>
      </form>
    </dialog>
  </>;
}
