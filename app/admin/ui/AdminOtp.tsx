"use client";
import FormError from "../../components/FormError";
import Skeleton from "../../components/Skeleton";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Icon from "../../components/Icon";
import { AdminApiError } from "../lib/api";
import { useAdminSession } from "./AdminSession";
import AdminAuthLayout from "./AdminAuthLayout";

export default function AdminOtp() {
  const router = useRouter();
  const { pendingOtp, verifyOtp, signIn, cancelOtp, loading, staff } = useAdminSession();
  const [resending, setResending] = useState(false);
  const [resendAfter, setResendAfter] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState<number | null>(null);
  const [serverExpired, setServerExpired] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!pendingOtp) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pendingOtp]);
  const remaining = pendingOtp && now !== null ? Math.max(0, Math.ceil((Date.parse(pendingOtp.expiresAt) - now) / 1000)) : null;
  const expired = !!pendingOtp && (remaining === 0 || serverExpired);
  const resendWait = resendAfter && now !== null ? Math.max(0, Math.ceil((resendAfter - now) / 1000)) : 0;
  function restart() { cancelOtp(); router.replace("/admin/login"); }
  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || resendWait || !pendingOtp) return;
    const form = event.currentTarget;
    const password = String(new FormData(form).get("password") ?? "");
    form.reset(); setBusy(true); setNotice("");
    try {
      const pending = await signIn(pendingOtp.email, password);
      setCode(""); setServerExpired(false); setNow(Date.now());
      setResendAfter(Date.now() + 60000); setResending(false);
      if (!pending) { router.replace("/admin"); return; }
      setNotice("A new verification code has been requested. Use the latest code.");
      input.current?.focus();
    } catch (error) {
      const limited = error instanceof AdminApiError && error.status === 429;
      if (limited) setResendAfter(Date.now() + 60000);
      setNotice(error instanceof AdminApiError && error.status === 401 ? "Your password could not be verified. Please try again." : limited ? "Too many requests. Please wait a minute before trying again." : error instanceof Error ? error.message : "Unable to request a new code. Please try again.");
    } finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || expired || !pendingOtp) return;
    setBusy(true); setNotice("");
    try { await verifyOtp(code); setCode(""); router.replace("/admin"); }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 410) { setServerExpired(true); setNotice("This verification request has expired. Request a new code to continue."); }
      else setNotice(error instanceof AdminApiError && error.status === 401 ? "That code could not be verified. Check the latest code and try again." : error instanceof Error ? error.message : "Unable to verify the code. Please try again.");
      input.current?.focus(); input.current?.select();
    } finally { setBusy(false); }
  }
  return <AdminAuthLayout step={2} title="Verify your sign-in." introduction="Enter the six-digit one-time code for your staff sign-in.">
    {loading ? <Skeleton variant="form" label="Preparing verification" /> : staff && !pendingOtp ? <><p>You are already signed in.</p><Link href="/admin" className="admin-button">Continue to workspace <Icon name="arrow" /></Link></> : !pendingOtp ? <><p className="admin-notice" role="status">There is no active verification request. Sign in to start a new request.</p><Link href="/admin/login" className="admin-button">Back to sign in <Icon name="arrow-left" /></Link></> : <>
      <p className="admin-otp-account">Signing in as <strong>{pendingOtp.email}</strong></p>
      {notice && <FormError  className="admin-notice">{notice}</FormError>}
      <form className="admin-form admin-sign-in-form admin-otp-form" onSubmit={submit}><fieldset disabled={busy || expired}><label>Verification code<input ref={input} className="admin-otp-input" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoFocus spellCheck={false} value={code} aria-invalid={!!notice} aria-describedby="admin-otp-help" placeholder="000000" onPaste={(event) => { event.preventDefault(); setCode(event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)); setNotice(""); }} onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setNotice(""); }} /></label><button type="submit" className="admin-button" disabled={code.length !== 6}>{busy ? "Verifying..." : "Verify & continue"}<Icon name="arrow" /></button></fieldset></form>
      <p id="admin-otp-help" className="admin-otp-help">{expired ? "This verification request has expired." : remaining === null ? "Checking verification expiry..." : `Verification expires in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}.`}</p>
      
      {resending && <form className="admin-form admin-sign-in-form" onSubmit={resend}><p className="admin-otp-help">Confirm your password to request a new staff verification code.</p><fieldset disabled={busy}><label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={128} autoFocus /></label><button className="admin-button" type="submit" disabled={resendWait > 0}>{busy ? "Requesting code..." : resendWait ? `Try again in ${resendWait}s` : "Send new code"}</button><button type="button" className="admin-text-button" onClick={() => setResending(false)}>Cancel</button></fieldset></form>}
      <div className="admin-otp-actions">{!resending && <button type="button" className="admin-text-button admin-otp-restart" disabled={busy || resendWait > 0} onClick={() => { setNotice(""); setResending(true); }}>{resendWait ? `Resend OTP in ${resendWait}s` : "Resend OTP"}</button>}
      <button type="button" className="admin-text-button admin-otp-restart" disabled={busy} onClick={restart}><Icon name="arrow-left" /><span>Back to sign in</span></button></div>
    </>}
  </AdminAuthLayout>;
}
