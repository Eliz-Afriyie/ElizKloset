"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { adminRequest, AdminApiError, parseStaff, type Staff } from "../lib/api";
import { ADMIN_MFA_ENABLED } from "../lib/auth-config";

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
  const sessionVersion = useRef(0);
  const checkingSession = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    const initialVersion = sessionVersion.current;
    Promise.resolve().then(async () => {
      const pending = ADMIN_MFA_ENABLED ? readPendingOtp() : null;
      if (!ADMIN_MFA_ENABLED) savePendingOtp(null);
      if (controller.signal.aborted) return;
      if (pending) { setPendingOtp(pending); return; }
      const response = await adminRequest<unknown>("auth/me", { signal: controller.signal });
      if (!controller.signal.aborted && sessionVersion.current === initialVersion) setStaff(parseStaff(response));
    })
      .catch((error) => { if (!controller.signal.aborted && !(error instanceof AdminApiError && error.status === 401)) setSessionError(error instanceof Error ? error.message : "Unable to restore your staff session."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    // A write/upload endpoint can reject a request independently of auth/me.
    // Confirm expiry before removing the workspace and its unsaved form values.
    const recheck = async () => {
      if (checkingSession.current) return;
      checkingSession.current = true;
      const version = sessionVersion.current;
      try {
        const profile = parseStaff(await adminRequest<unknown>("auth/me", { signal: controller.signal }));
        if (!controller.signal.aborted && version === sessionVersion.current) setStaff(profile);
      } catch (error) {
        if (!controller.signal.aborted && version === sessionVersion.current && error instanceof AdminApiError && error.status === 401) {
          sessionVersion.current++;
          setStaff(null); setPendingOtp(null); savePendingOtp(null); setSessionError("Your staff session has expired. Please sign in again.");
        }
      } finally { checkingSession.current = false; }
    };
    window.addEventListener("admin-session-check", recheck);
    return () => { controller.abort(); window.removeEventListener("admin-session-check", recheck); };
  }, []);
  function cancelOtp() { setPendingOtp(null); savePendingOtp(null); setSessionError(""); }
  async function completeSignIn() {
    const profile = parseStaff(await adminRequest<unknown>("auth/me"));
    setStaff(profile); cancelOtp();
  }
  async function signIn(email: string, password: string) {
    sessionVersion.current++;
    setStaff(null);
    const response = await adminRequest<unknown>("auth/sign-in", { method: "POST", body: { email, password } });
    cancelOtp();
    // Retained for re-enabling MFA after the backend development period.
    if (ADMIN_MFA_ENABLED) {
      const pending = parseOtpChallenge(response, email);
      if (pending) { setPendingOtp(pending); savePendingOtp(pending); return pending; }
    }
    await completeSignIn(); return null;
  }
  async function verifyOtp(code: string) {
    if (!ADMIN_MFA_ENABLED) throw new Error("Please return to sign in to continue.");
    if (!pendingOtp) throw new Error("Start sign-in before verifying a code.");
    await submitStaffOtp(pendingOtp, code);
    await completeSignIn();
  }
  async function leave() {
    sessionVersion.current++;
    try { await adminRequest("auth/sign-out", { method: "POST" }); }
    catch (error) { if (!(error instanceof AdminApiError && error.status === 401)) throw error; }
    setStaff(null); cancelOtp();
  }
  return <Context.Provider value={{ staff, loading, sessionError, pendingOtp, signIn, verifyOtp, cancelOtp, leave }}>{children}</Context.Provider>;
}
