"use client";
import FormError from "./FormError";

import Link from "next/link";
import Skeleton from "./Skeleton";
import Image from "next/image";
import { useState } from "react";
import Icon from "./Icon";
import { useStoreCatalog } from "./StoreCatalog";
import { storeRequest } from "../lib/store-api";

export function MoreCollections() {
  const { categories } = useStoreCatalog();
  return <div className="more-collections" aria-label="More collections">{categories.map((collection) => <Link key={collection.id} href={`/shop?collection=${encodeURIComponent(collection.slug)}`}><Icon name="bag" /><span><strong>{collection.name}</strong><small>{collection.description}</small></span><Icon name="arrow" /></Link>)}</div>;
}

export function BrandExperience() {
  return <section className="brand-experience section" id="about" aria-labelledby="experience-title"><div className="experience-inner">
    <div className="experience-photo"><Image src="/images/hero-burgundy.png" alt="ElizKloset burgundy corporate fashion" fill sizes="(max-width: 560px) 35vw, 28vw" /></div>
    <div className="experience-copy"><p className="eyebrow">The ElizKloset experience</p><h2 id="experience-title">Style worth talking about</h2><p>Discover timeless corporate fashion for women in Ghana. Dress for the opportunities ahead.</p><Link className="button primary" href="/shop">Explore our Collections<Icon name="arrow" /></Link></div>
    <div className="experience-values"><span><Icon name="diamond" />Timeless & professional styles</span><span><Icon name="heart" />Carefully selected outfits</span><span><Icon name="lock" />Quality you can trust</span><span><Icon name="user" />Everyday essentials for women & men</span></div>
  </div></section>;
}

export function Newsletter() {
  const { site, loading } = useStoreCatalog(); const enabled = site?.features?.newsletterSignup === true;
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  return <section className="newsletter" id="contact" aria-labelledby="newsletter-title"><div><h2 id="newsletter-title">Join the ElizKloset Family</h2><p>Be first to hear about new arrivals and style inspiration.</p></div>{loading && !site && <Skeleton variant="form" label="Loading newsletter signup" />}<form hidden={loading && !site} onSubmit={async (event) => {
    event.preventDefault(); if (busy || !enabled) return; const form = event.currentTarget;
    const email = String(new FormData(form).get("email")).trim(); setBusy(true); setError(""); setMessage("");
    try { await storeRequest("newsletter/subscriptions", { method: "POST", body: { email } }); form.reset(); setMessage("Your subscription request was accepted. Check your inbox for any confirmation instructions."); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to subscribe."); }
    finally { setBusy(false); }
  }}>{error && <FormError className="newsletter-status" >{error}</FormError>}<label className="newsletter-label" htmlFor="newsletter-email">Email address</label><div className="newsletter-field"><input type="email" name="email" id="newsletter-email" required maxLength={254} placeholder="Enter your email address" autoComplete="email" disabled={busy || !enabled} /><button type="submit" disabled={busy || !enabled}>{busy ? "Subscribing..." : "Subscribe"}</button></div>{!enabled && <p className="newsletter-status">Newsletter signup is currently unavailable.</p>}{message && <p className="newsletter-status" role="status">{message}</p>}</form><p className="newsletter-motto">Style Today.<br />A Brighter Tomorrow.</p></section>;
}

