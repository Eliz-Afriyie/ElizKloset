"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { adminRequest, AdminApiError, parseStaff, type Staff } from "../lib/api";

import { parseOtpChallenge, readPendingOtp, savePendingOtp, submitStaffOtp, type PendingOtp } from "../lib/otp";

type Session = {
  loading: boolean; staff: Staff | null; sessionError: string;
  leave: () => Promise<void>;
  pendingOtp: PendingOtp | null;
  signIn: (email: string, password: string) => Promise<PendingOtp | null>;
  verifyOtp: (code: string) => Promise<void>;
  cancelOtp: () => void;
};
const Context = createContext<Session | null>(null);
export function useAdminSession() { const value = useContext(Context); if (!value) throw new Error("Admin session provider missing"); return value; }
export default function AdminSession({ children }: { children: React.ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingOtp, setPendingOtp] = useState<PendingOtp | null>(null);
  const [sessionError, setSessionError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(async () => {
      const pending = readPendingOtp();
      if (controller.signal.aborted) return;
      if (pending) { setPendingOtp(pending); return; }
      const response = await adminRequest<unknown>("auth/me", { signal: controller.signal });
      if (!controller.signal.aborted) setStaff(parseStaff(response));
    })
      .catch((error) => { if (!controller.signal.aborted && !(error instanceof AdminApiError && error.status === 401)) setSessionError(error instanceof Error ? error.message : "Unable to restore your staff session."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    const expire = () => { setStaff(null); setPendingOtp(null); savePendingOtp(null); setSessionError("Your staff session has expired. Please sign in again."); };
    window.addEventListener("admin-session-expired", expire);
    return () => { controller.abort(); window.removeEventListener("admin-session-expired", expire); };
  }, []);
  function cancelOtp() { setPendingOtp(null); savePendingOtp(null); setSessionError(""); }
  async function completeSignIn() {
    const profile = parseStaff(await adminRequest<unknown>("auth/me"));
    setStaff(profile); cancelOtp();
  }
  async function signIn(email: string, password: string) {
    setStaff(null);
    const response = await adminRequest<unknown>("auth/sign-in", { method: "POST", body: { email, password } });
    const pending = parseOtpChallenge(response, email);
    cancelOtp();
    if (pending) { setPendingOtp(pending); savePendingOtp(pending); return pending; }
    await completeSignIn(); return null;
  }
  async function verifyOtp(code: string) {
    if (!pendingOtp) throw new Error("Start sign-in before verifying a code.");
    await submitStaffOtp(pendingOtp, code);
    await completeSignIn();
  }
  async function leave() {
    try { await adminRequest("auth/sign-out", { method: "POST" }); }
    catch (error) { if (!(error instanceof AdminApiError && error.status === 401)) throw error; }
    setStaff(null); cancelOtp();
  }
  return <Context.Provider value={{ staff, loading, sessionError, pendingOtp, signIn, verifyOtp, cancelOtp, leave }}>{children}</Context.Provider>;
}
