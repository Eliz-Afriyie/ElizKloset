"use client";

import { useRef } from "react";
export default function ConfirmDelete({ name, description, blocked, onDelete }: { name: string; description: string; blocked?: string; onDelete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <><button className="admin-row-delete" aria-label={`Delete ${name}`} onClick={() => dialog.current?.showModal()}>Delete</button><dialog ref={dialog} className="shopping-dialog admin-dialog" aria-label={`Delete ${name}?`} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}><h2>Delete {name}?</h2><p className="admin-card-description">{description}</p>{blocked && <p role="alert" className="admin-form-error" >{blocked}</p>}<div className="admin-dialog-actions"><button className="admin-button secondary" onClick={() => dialog.current?.close()}>Cancel</button><button className="admin-button danger" disabled={!!blocked} onClick={() => { dialog.current?.close(); onDelete(); }}>Confirm delete</button></div></dialog></>;
}
