"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Icon from "./Icon";

type Entry = { message: string; retry?: () => void };
const Context = createContext<(id: string, entry: Entry) => () => void>(() => () => {});

export function ErrorToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [dismissed, setDismissed] = useState<string[]>([]);
  const register = useCallback((id: string, entry: Entry) => {
    setEntries((previous) => ({ ...previous, [id]: entry }));
    setDismissed((previous) => previous.filter((message) => message !== entry.message));
    return () => setEntries((previous) => { const next = { ...previous }; delete next[id]; return next; });
  }, []);
  const groups = useMemo(() => {
    const result = new Map<string, Entry[]>();
    for (const entry of Object.values(entries)) result.set(entry.message, [...(result.get(entry.message) ?? []), entry]);
    return [...result].filter(([message]) => !dismissed.includes(message));
  }, [entries, dismissed]);
  return <Context.Provider value={register}>{children}<div className="error-toast-stack" aria-label="Store notifications">{groups.map(([message, sources]) => <div key={message} className="error-toast" role="alert"><span className="error-toast-symbol" aria-hidden="true">!</span><div><strong>Something went wrong</strong><p>{message}</p>{sources.some((source) => source.retry) && <button type="button" className="error-toast-retry" onClick={() => { for (const source of sources) source.retry?.(); }}>Retry</button>}</div><button type="button" className="error-toast-close" aria-label="Dismiss error" title="Dismiss error" onClick={() => setDismissed((previous) => [...previous, message])}><Icon name="close" /></button></div>)}</div></Context.Provider>;
}

export default function ErrorToast({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const register = useContext(Context);
  const id = useId();
  const retry = useRef(onRetry);
  useEffect(() => { retry.current = onRetry; }, [onRetry]);
  useEffect(() => {
    if (!message.trim()) return;
    return register(id, { message: message.trim(), retry: onRetry ? () => retry.current?.() : undefined });
    // Retry callbacks change on render; the ref keeps registration stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, message, register, !!onRetry]);
  return null;
}
