"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import Icon from "../../components/Icon";
import Skeleton, { type SkeletonVariant } from "../../components/Skeleton";

export function ApiStatus({ loading, error, retry, variant = "table" }: { loading: boolean; error: string; retry: () => void; variant?: SkeletonVariant }) {
  return <>{loading && <Skeleton variant={variant} label="Loading store data" />}{error && <p className="admin-form-error" role="alert">{error} <button type="button" className="admin-text-button" onClick={retry}>Retry</button></p>}</>;
}
export function ApiPagination({ page, total, totalPages, loading, onChange }: { page: number; total: number; totalPages: number; loading: boolean; onChange: (page: number) => void }) {
  return <nav className="admin-pagination" aria-label="Result pagination"><p>{total} records</p><div><button type="button" disabled={loading || page <= 1} onClick={() => onChange(page - 1)}>Previous</button><span>Page {page} of {Math.max(1, totalPages)}</span><button type="button" disabled={loading || page >= totalPages} onClick={() => onChange(page + 1)}>Next</button></div></nav>;
}
export function AdminDialog({ title, busy = false, onClose, children }: { title: string; busy?: boolean; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog ref={dialog} className="shopping-dialog admin-dialog admin-resource-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} onClick={(event) => { if (!busy && event.target === event.currentTarget) onClose(); }}><div className="admin-dialog-heading"><h2 id={titleId}>{title}</h2><button type="button" autoFocus aria-label="Close dialog" disabled={busy} onClick={onClose}><Icon name="close" /></button></div>{children}</dialog>;
}
