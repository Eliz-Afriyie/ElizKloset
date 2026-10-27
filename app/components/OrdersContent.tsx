"use client";

import Link from "next/link";
import { useState } from "react";
import { useCustomerSession } from "../lib/customer-session";
import Icon from "./Icon";
import Skeleton from "./Skeleton";

export default function OrdersContent() {
  const { user, loading, error, requireUser, refresh } = useCustomerSession();
  const [notice, setNotice] = useState("");
  if (loading) return <Skeleton variant="table" label="Checking your account" />;
  if (!user) return <div className="customer-orders-state">
    <Icon name="bag" /><p className="eyebrow">Your ElizKloset account</p><h2>Your orders, in one place.</h2>
    <p>Sign in to access your order history and delivery updates when online ordering opens.</p>
    {(notice || error) && <p role="alert">{notice || error}</p>}
    <button className="button primary" onClick={() => { void requireUser("Please sign in to access your orders.").catch((error) => setNotice(error instanceof Error ? error.message : "Unable to verify your account.")); }}>Sign in to view orders</button>
    {error && <button className="text-button" onClick={() => { void refresh(); }}>Retry account check</button>}
  </div>;
  // Customer order reads are not exposed by the current API. Do not use staff
  // endpoints or present a fabricated empty history as the customer's records.
  return <div className="customer-orders-state">
    <Icon name="bag" /><p className="eyebrow">Order history & delivery updates</p><h2>Order history is not available yet.</h2>
    <p>Online ordering is being prepared. Once available, you will be able to see your purchases and follow their delivery progress here.</p>
    <p>Need help with an existing purchase? Contact us with your order reference.</p>
    <div className="customer-orders-actions"><Link className="button primary" href="/contact">Contact Us <Icon name="arrow" /></Link><Link className="button outline" href="/shop">Continue shopping</Link></div>
  </div>;
}
