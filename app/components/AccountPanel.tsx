"use client";
import FormError from "./FormError";
import Skeleton from "./Skeleton";
import { useEffect, useState, type FormEvent } from "react";
import { storeRequest } from "../lib/store-api";
import { useCustomerSession } from "../lib/customer-session";
export default function AccountPanel({ onSignedIn, onSaved }: { onSignedIn?: () => void; onSaved?: () => void } = {}) {
  const { user: profile, loading, error: sessionError, refresh, loadProfile, requestSignOut } = useCustomerSession();
  const [mode, setMode] = useState<"signin" | "signup" | "verify" | "forgot" | "reset">("signin");
  const [errorField, setErrorField] = useState<string>();
  const [target, setTarget] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const [profileLoading, setProfileLoading] = useState(!!profile);
  const [profileError, setProfileError] = useState(""); const [profileRevision, setProfileRevision] = useState(0);
  const profileId = profile?.id;
  useEffect(() => {
    if (profileId === undefined) return;
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setProfileLoading(true); setProfileError("");
      try { await loadProfile(controller.signal); }
      catch (error) { if (!controller.signal.aborted) setProfileError(error instanceof Error ? error.message : "Unable to load your profile."); }
      finally { if (!controller.signal.aborted) setProfileLoading(false); }
    });
    return () => controller.abort();
  }, [profileId, profileRevision, loadProfile]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; const form = event.currentTarget; const fields = new FormData(form);
    const email = String(fields.get("email") ?? target).trim(); setBusy(true); setMessage(""); setError(""); setErrorField(undefined);
    try {
      if (mode === "signin") {
        await storeRequest("auth/sign-in", { method: "POST", body: { email, password: String(fields.get("password")) } });
        if (!await refresh()) throw new Error("Unable to verify your account. Please sign in again."); form.reset(); onSignedIn?.();
      } else if (mode === "signup") {
        for (const [field, label] of [["first_name", "First name"], ["last_name", "Last name"], ["phone", "Phone number"]]) {
          if (!String(fields.get(field) ?? "").trim()) { setErrorField(field); throw new Error(`${label} is required.`); }
        }
        if (fields.get("password") !== fields.get("confirmPassword")) { setErrorField("confirmPassword"); throw new Error("Your passwords do not match."); }
        await storeRequest("auth/register", { method: "POST", body: { ...(email ? { email } : {}), first_name: String(fields.get("first_name")).trim(), last_name: String(fields.get("last_name")).trim(), phone: String(fields.get("phone")).trim(), password: String(fields.get("password")) } });
        form.reset(); setTarget(email || String(fields.get("phone")).trim()); setMode("verify"); setMessage("Account registration accepted. Enter the verification code sent to your email or phone.");
      } else if (mode === "verify") {
        await storeRequest(email.includes("@") ? "auth/verify-otp" : "auth/verify-phone-otp", { method: "POST", body: { target: email, code: String(fields.get("code")) } });
        setMode("signin"); setMessage("Account verified. You can now sign in.");
      } else if (mode === "forgot") {
        await storeRequest("auth/forgot-password", { method: "POST", body: { target: email } });
        setTarget(email); setMode("reset"); setMessage("If this account is eligible, follow the reset instructions sent to your email.");
      } else {
        await storeRequest("auth/reset-password", { method: "POST", body: { target: email, code: String(fields.get("code")), new_password: String(fields.get("password")) } });
        setMode("signin"); setMessage("Password reset. Sign in with your new password.");
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to complete this request."); }
    finally { setBusy(false); }
  }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !profile) return; const fields = new FormData(event.currentTarget);
    setBusy(true); setError(""); setMessage("");
    try {
      await storeRequest("auth/profile", { method: "POST", body: Object.fromEntries(["email", "first_name", "last_name", "phone"].map((field) => [field, String(fields.get(field)).trim()])) });
      await loadProfile(); setMessage("Your profile was saved."); onSaved?.();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save your profile."); }
    finally { setBusy(false); }
  }
  async function resend() { if (busy) return; setBusy(true); setError(""); setMessage(""); try { await storeRequest("auth/resend-otp", { method: "POST", body: { target } }); setMessage("A new verification code was requested. Check your email or phone."); } catch (error) { setError(error instanceof Error ? error.message : "Unable to request a code."); } finally { setBusy(false); } }
  const feedback = (error || sessionError) && <FormError className="account-message" field={errorField}>{error || sessionError}</FormError>;
  if (loading || (profile && profileLoading)) return <Skeleton variant="form" label="Loading your account" />;
  if (profile && profileError) return <div className="account-panel"><FormError >{profileError}</FormError><button className="button outline" onClick={() => setProfileRevision((value) => value + 1)}>Retry loading profile</button></div>;
  return <div className="account-panel">{profile ? <><p className="eyebrow">Your ElizKloset account</p><h3>Hello{`, ${profile.first_name || profile.display_name || "there"}`}</h3><form className="account-form" key={String(profile.id)} onSubmit={saveProfile}>{feedback}<fieldset disabled={busy} style={{ border: 0, padding: 0 }}><label>First name<input name="first_name" defaultValue={profile.first_name} autoComplete="given-name" maxLength={100} /></label><label>Last name<input name="last_name" defaultValue={profile.last_name} autoComplete="family-name" maxLength={100} /></label><label>Email<input name="email" type="email" required defaultValue={profile.email ?? ""} autoComplete="email" maxLength={254} /></label><label>Phone<input name="phone" type="tel" defaultValue={profile.phone} autoComplete="tel" maxLength={25} /></label><button className="button primary" type="submit">{busy ? "Please wait..." : "Save profile"}</button></fieldset></form><p>Order history will be available when online ordering opens.</p><button className="button outline" disabled={busy} title="Sign out of your account" onClick={requestSignOut}>Sign out</button></> : <>
    <div className="account-tabs">{(["signin", "signup"] as const).map((value) => <button key={value} disabled={busy} aria-pressed={mode === value} onClick={() => { setMode(value); setError(""); setMessage(""); }}>{value === "signin" ? "Sign in" : "Create account"}</button>)}</div>
    <h3>{mode === "signup" ? "Create your account" : mode === "verify" ? "Verify your account" : mode === "forgot" ? "Request a password reset" : mode === "reset" ? "Reset your password" : "Welcome back"}</h3>
    <form key={mode} className="account-form" onSubmit={submit}>{feedback}<fieldset disabled={busy} style={{ border: 0, padding: 0 }}>
      {mode === "signup" && <><label><span>First name <span className="required-mark" aria-hidden="true">*</span></span><input name="first_name" required autoComplete="given-name" maxLength={100} /></label><label><span>Last name <span className="required-mark" aria-hidden="true">*</span></span><input name="last_name" required autoComplete="family-name" maxLength={100} /></label><label><span>Phone number <span className="required-mark" aria-hidden="true">*</span></span><input name="phone" type="tel" required autoComplete="tel" maxLength={25} /></label></>}
      <label><span>{mode === "signup" ? "Email address (optional)" : "Email or phone number"}{mode !== "signup" && <span className="required-mark" aria-hidden="true"> *</span>}</span><input name="email" type={mode === "signup" ? "email" : "text"} required={mode !== "signup"} defaultValue={mode === "signup" ? "" : target} onChange={(event) => { if (mode === "verify") setTarget(event.target.value); }} autoComplete={mode === "signup" ? "email" : "username"} maxLength={254} /></label>
      {(mode === "verify" || mode === "reset") && <label><span>Six-digit code <span className="required-mark" aria-hidden="true">*</span></span><input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} autoComplete="one-time-code" required /></label>}
      {(mode === "signin" || mode === "signup" || mode === "reset") && <label><span>{mode === "reset" ? "New password" : "Password"}<span className="required-mark" aria-hidden="true"> *</span></span><input name="password" type="password" required minLength={mode === "signin" ? 1 : 8} maxLength={128} autoComplete={mode === "signin" ? "current-password" : "new-password"} /></label>}
      {mode === "signup" && <label><span>Confirm password <span className="required-mark" aria-hidden="true">*</span></span><input name="confirmPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" /></label>}
      <button className="button primary" type="submit">{busy ? "Please wait..." : mode === "signup" ? "Create account" : mode === "verify" ? "Verify account" : mode === "forgot" ? "Request reset code" : mode === "reset" ? "Reset password" : "Sign in"}</button>
    </fieldset></form>
    {mode === "signin" && <div className="account-help-actions"><button className="text-button" disabled={busy} onClick={() => { setMode("verify"); setTarget(""); setError(""); }}>Verify an existing account</button><button className="text-button" disabled={busy} onClick={() => { setMode("forgot"); setError(""); }}>Forgot password?</button></div>}
    {mode === "verify" && <button className="text-button" disabled={busy || !target} onClick={() => void resend()}>Request a new code</button>}
    {(mode === "verify" || mode === "reset" || mode === "forgot") && <button className="text-button" disabled={busy} onClick={() => { setMode("signin"); setError(""); }}>Back to sign in</button>}
  </>}{message && <p className="account-message" role="status">{message}</p>}</div>;
}


