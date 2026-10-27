"use client";

import { useCallback, useEffect, useState } from "react";
import { adminRequest } from "./api";

export function useAdminQuery<T>(path: string | null, parse: (value: unknown) => T) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ path: string | null; data: T | null; error: string; loading: boolean }>({ path, data: null, error: "", loading: !!path });
  const refresh = useCallback(() => {
    setState({ path, data: null, error: "", loading: !!path });
    setRevision((value) => value + 1);
  }, [path]);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    async function load() {
      setState({ path, data: null, error: "", loading: true });
      try {
        const result = parse(await adminRequest<unknown>(path!, { signal: controller.signal }));
        if (!controller.signal.aborted) setState({ path, data: result, error: "", loading: false });
      } catch (error) {
        if (!controller.signal.aborted) setState({ path, data: null, error: error instanceof Error ? error.message : "Unable to load store data.", loading: false });
      }
    }
    const timer = setTimeout(() => void load(), 150);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [path, parse, revision]);
  return { data: path && state.path === path ? state.data : null, error: state.path === path ? state.error : "", loading: !!path && (state.path !== path || state.loading), refresh };
}
