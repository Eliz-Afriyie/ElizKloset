"use client";

import Link from "next/link";
import Icon from "../../components/Icon";
import { useId, useRef, useState } from "react";
type Action = { label: string; href?: string; onSelect?: () => void };
type DeleteAction = { name: string; description: string; blocked?: string; onDelete: () => void };
export default function ActionMenu({ name, actions, deletion }: { name: string; actions: Action[]; deletion?: DeleteAction }) {
  const id = useId(); const trigger = useRef<HTMLButtonElement>(null); const popup = useRef<HTMLDivElement>(null); const confirm = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false); const [position, setPosition] = useState({ top: 0, left: 0 });
  function close() { popup.current?.hidePopover(); }
  function select(action: () => void) { close(); trigger.current?.focus({ preventScroll: true }); action(); }
  return <><button ref={trigger} type="button" className="admin-actions-trigger" aria-label={`Actions for ${name}`} aria-haspopup="menu" aria-expanded={open} popoverTarget={id}><Icon name="more" /></button>
    <div ref={popup} id={id} popover="auto" role="menu" aria-label={`Actions for ${name}`} className="admin-actions-menu" style={position} onToggle={(event) => {
      const showing = event.newState === "open"; setOpen(showing);
      if (showing) { const rect = trigger.current?.getBoundingClientRect(); if (rect) setPosition({ left: Math.max(8, Math.min(rect.right - 190, window.innerWidth - 198)), top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - (actions.length + (deletion ? 1 : 0)) * 38 - 24)) }); requestAnimationFrame(() => popup.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true })); }
    }} onKeyDown={(event) => {
      const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')]; const current = items.indexOf(document.activeElement as HTMLElement);
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; items[next]?.focus(); }
      if (event.key === "Escape") { event.preventDefault(); close(); trigger.current?.focus({ preventScroll: true }); }
    }}>{actions.map((action) => action.href ? <Link key={action.label} role="menuitem" href={action.href} onClick={close}>{action.label}</Link> : <button key={action.label} role="menuitem" type="button" onClick={() => select(() => action.onSelect?.())}>{action.label}</button>)}{deletion && <button type="button" role="menuitem" className="admin-menu-delete" onClick={() => select(() => confirm.current?.showModal())}>Delete</button>}</div>
    {deletion && <dialog ref={confirm} className="shopping-dialog admin-dialog" aria-label={`Delete ${deletion.name}?`} onClick={(event) => { if (event.target === event.currentTarget) confirm.current?.close(); }}><h2>Delete {deletion.name}?</h2><p className="admin-card-description">{deletion.description}</p>{deletion.blocked && <p className="admin-form-error" role="alert">{deletion.blocked}</p>}<div className="admin-dialog-actions"><button className="admin-button secondary" onClick={() => confirm.current?.close()}>Cancel</button><button className="admin-button danger" disabled={!!deletion.blocked} onClick={() => { confirm.current?.close(); deletion.onDelete(); }}>Confirm delete</button></div></dialog>}
  </>;
}
