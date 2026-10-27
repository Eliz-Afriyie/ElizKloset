"use client";
import FormError from "./FormError";
import Link from "next/link";
import { useState } from "react";
import { useCustomerSession } from "../lib/customer-session";
export default function CheckoutDialog({ disabled }: { subtotal: number; disabled: boolean }) {
  const { user, loading, requireUser } = useCustomerSession();
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function signIn() {
    if (busy) return; setBusy(true); setError("");
    try { await requireUser("Please sign in before continuing to checkout. Your bag will stay here."); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to verify your account."); }
    finally { setBusy(false); }
  }
  return <><button className="button primary bag-checkout-button" disabled={loading || busy || !!user} onClick={() => void signIn()}>{loading || busy ? "Checking your account..." : user ? "Checkout unavailable" : "Sign in to checkout"}</button>{error && <FormError >{error}</FormError>}<p>{!user ? "Sign in is required to proceed from your bag. " : ""}{disabled ? "Check your bag items before checkout becomes available." : "Online ordering and payments are not available yet."} <Link href="/contact">Contact us for help</Link>.</p></>;
}
