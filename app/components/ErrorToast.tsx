"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Icon from "./Icon";

type Entry = { message: string; retry?: () => void; tone?: "error" | "success" };
const Context = createContext<(id: string, entry: Entry) => () => void>(() => () => {});

export function ErrorToastProvider({ children }: { children: ReactNode }) {
  const stack = useRef<HTMLDivElement>(null);
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
  useEffect(() => {
    const element = stack.current;
    if (!element || !element.showPopover) return;
    if (element.matches(":popover-open")) element.hidePopover();
    if (groups.length) element.showPopover();
  }, [groups]);
  return <Context.Provider value={register}>{children}<div ref={stack} popover="manual" className="error-toast-stack" aria-label="Notifications">{groups.map(([message, sources]) => <div key={message} className={`error-toast ${sources[0].tone === "success" ? "success-toast" : ""}`} role={sources[0].tone === "success" ? "status" : "alert"}><span className="error-toast-symbol" aria-hidden="true">{sources[0].tone === "success" ? "\u2713" : "!"}</span><div><strong>{sources[0].tone === "success" ? "Success" : "Something went wrong"}</strong><p>{message}</p>{sources.some((source) => source.retry) && <button type="button" className="error-toast-retry" onClick={() => { for (const source of sources) source.retry?.(); }}>Retry</button>}</div><button type="button" className="error-toast-close" aria-label="Dismiss notification" title="Dismiss notification" onClick={() => setDismissed((previous) => [...previous, message])}><Icon name="close" /></button></div>)}</div></Context.Provider>;
}

export default function ErrorToast({ message, onRetry, tone = "error", onDismiss }: { message: string; onRetry?: () => void; tone?: "error" | "success"; onDismiss?: () => void }) {
  const register = useContext(Context);
  const id = useId();
  const retry = useRef(onRetry);
  const dismiss = useRef(onDismiss);
  useEffect(() => { dismiss.current = onDismiss; }, [onDismiss]);
  useEffect(() => { retry.current = onRetry; }, [onRetry]);
  useEffect(() => {
    if (!message.trim()) return;
    const unregister = register(id, { message: message.trim(), tone, retry: onRetry ? () => retry.current?.() : undefined });
    const timer = tone === "success" ? setTimeout(() => { unregister(); dismiss.current?.(); }, 6000) : undefined;
    return () => { clearTimeout(timer); unregister(); };
    // Retry callbacks change on render; the ref keeps registration stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, message, register, !!onRetry, tone]);
  return null;
}
