"use client";
import FormError from "../../components/FormError";

import Link from "next/link";
import Skeleton from "../../components/Skeleton";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Icon from "../../components/Icon";
import { useAdminSession } from "./AdminSession";
import { AdminApiError } from "../lib/api";
import AdminAuthLayout from "./AdminAuthLayout";

export default function AdminLogin() {
  const router = useRouter();
  const { signIn, staff, loading, sessionError, pendingOtp } = useAdminSession();
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true); setNotice("");
    try {
      const pending = await signIn(String(fields.get("email")).trim(), String(fields.get("password")));
      form.reset(); router.push(pending ? "/admin/login/verify" : "/admin");
    } catch (error) {
      setNotice(error instanceof AdminApiError && error.status === 401
        ? "The staff portal could not verify these credentials. Check your email and password, or ask the store owner to confirm your staff access."
        : error instanceof Error ? error.message : "Unable to sign in. Please retry.");
    } finally { setBusy(false); }
  }
  return <AdminAuthLayout step={1} title="Welcome back." introduction="Sign in to receive your staff verification code.">
    {pendingOtp && !loading && <p className="admin-notice">A verification request is already in progress. <Link href="/admin/login/verify">Continue verification</Link></p>}
    {sessionError && <FormError className="admin-notice" >{sessionError}</FormError>}{notice && <FormError className="admin-notice" >{notice}</FormError>}
    {loading ? <Skeleton variant="form" label="Loading staff sign-in" /> : <form onSubmit={submit} className="admin-form admin-sign-in-form"><fieldset disabled={busy || loading}><div className="admin-sign-in-fields"><label>Work email<input name="email" type="email" autoComplete="username" required maxLength={254} placeholder="name@example.com" /></label><label>Password<div className="admin-password"><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required maxLength={128} placeholder="Enter your password" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</button></div></label></div><button className="admin-button" type="submit">{busy ? "Signing in..." : "Continue"}<Icon name="arrow" /></button></fieldset></form>}
    {staff && <Link className="admin-button" href="/admin">Continue to workspace</Link>}
    <p className="admin-login-note">Use the work email associated with your staff invitation.</p><p className="admin-invite-note">Need access? Ask the store owner to invite you to the staff portal.</p>
  </AdminAuthLayout>;
}
