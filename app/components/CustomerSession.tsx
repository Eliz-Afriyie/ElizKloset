"use client";
import FormError from "./FormError";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CustomerSessionContext, parseCustomerUser, type CustomerUser } from "../lib/customer-session";
import { storeRequest, StoreApiError } from "../lib/store-api";
import AccountPanel from "./AccountPanel";
import Icon from "./Icon";

export default function CustomerSession({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CustomerUser | null>(null); const current = useRef<CustomerUser | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [reason, setReason] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const signOutDialog = useRef<HTMLDialogElement>(null);
  const [signingOut, setSigningOut] = useState(false); const [signOutError, setSignOutError] = useState("");
  const pendingAction = useRef<(() => void) | undefined>(undefined);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      let next = parseCustomerUser(await storeRequest("auth/me", { signal }));
      const previous = current.current;
      if (previous && String(previous.id) === String(next.id)) next = parseCustomerUser({ ...previous, ...next, first_name: next.first_name || previous.first_name, last_name: next.last_name || previous.last_name, phone: next.phone || previous.phone, display_name: previous.display_name || next.display_name });
      if (!signal?.aborted) { current.current = next; setUser(next); setError(""); }
      return next;
    } catch (error) {
      if (signal?.aborted) return null;
      current.current = null; setUser(null);
      if (error instanceof StoreApiError && error.status === 401) { setError(""); return null; }
      setError(error instanceof Error ? error.message : "Unable to verify your account."); throw error;
    }
  }, []);
  const loadProfile = useCallback(async (signal?: AbortSignal) => {
    const expectedId = current.current?.id;
    let profile: CustomerUser;
    try { profile = parseCustomerUser(await storeRequest("auth/profile", { signal })); }
    catch (error) {
      if (!signal?.aborted && error instanceof StoreApiError && error.status === 401) { current.current = null; setUser(null); setError("Your session expired. Please sign in again."); }
      throw error;
    }
    if (!signal?.aborted) {
      if (expectedId === undefined || String(profile.id) !== String(expectedId) || String(current.current?.id) !== String(expectedId)) throw new Error("Your account changed. Please reopen your profile.");
      current.current = profile; setUser(profile);
    }
    return profile;
  }, []);
  function requestSignOut() { setSignOutError(""); signOutDialog.current?.showModal(); }
  async function signOut() {
    if (signingOut) return; setSigningOut(true); setSignOutError("");
    try {
      try { await storeRequest("auth/sign-out", { method: "POST", body: {} }); }
      catch (error) { if (!(error instanceof StoreApiError && error.status === 401)) throw error; }
      await refresh(); signOutDialog.current?.close();
    } catch (error) { setSignOutError(error instanceof Error ? error.message : "Unable to sign out. Please retry."); }
    finally { setSigningOut(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => refresh(controller.signal)).catch(() => {}).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  const requireUser = useCallback(async (message: string, afterSignIn?: () => void) => {
    // Recheck with the backend before every protected action, including after expiry in another tab.
    const verified = await refresh();
    if (!verified) { pendingAction.current = afterSignIn; setReason(message); dialog.current?.showModal(); }
    return verified;
  }, [refresh]);
  return <CustomerSessionContext.Provider value={{ user, loading, error, refresh, loadProfile, requestSignOut, requireUser, getUser: () => current.current }}>
    {children}
    <dialog ref={dialog} className="shopping-dialog customer-auth-dialog" aria-labelledby="customer-auth-title" onClose={() => { pendingAction.current = undefined; setReason(""); }} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="dialog-header"><h2 id="customer-auth-title">Sign in to continue</h2><button className="icon-button" aria-label="Close sign in" onClick={() => dialog.current?.close()}><Icon name="close" /></button></div>
      {reason && <><p className="customer-auth-reason">{reason}</p><AccountPanel onSignedIn={() => { if (current.current) { const action = pendingAction.current; pendingAction.current = undefined; action?.(); } dialog.current?.close(); }} /></>}
    </dialog>
    <dialog ref={signOutDialog} className="shopping-dialog customer-signout-dialog" aria-labelledby="customer-signout-title" aria-describedby="customer-signout-description" onClose={() => { if (!document.querySelector("dialog[open]")) document.querySelector<HTMLButtonElement>(".customer-account-button")?.focus(); }} onCancel={(event) => { if (signingOut) event.preventDefault(); }} onClick={(event) => { if (!signingOut && event.target === event.currentTarget) signOutDialog.current?.close(); }}>
      <div className="dialog-header"><h2 id="customer-signout-title">Sign out?</h2><button type="button" className="icon-button" aria-label="Close sign-out confirmation" title="Keep me signed in" disabled={signingOut} onClick={() => signOutDialog.current?.close()}><Icon name="close" /></button></div>
      <div className="customer-signout-content"><p id="customer-signout-description">You can come back anytime. Your bag will stay on this device, and your saved styles will be here when you sign in again.</p>{signOutError && <FormError  className="account-message">{signOutError}</FormError>}<div className="logout-actions"><button type="button" autoFocus className="button outline" disabled={signingOut} onClick={() => signOutDialog.current?.close()}>Stay signed in</button><button type="button" className="button primary" disabled={signingOut} onClick={() => void signOut()}>{signingOut ? "Signing out..." : "Yes, sign out"}</button></div></div>
    </dialog>
  </CustomerSessionContext.Provider>;
}
