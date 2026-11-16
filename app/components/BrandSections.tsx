"use client";
import ContentIcon from "./ContentIcon";
import { contentHref, imageSource, imageAlt } from "../lib/store-content";
import FormError from "./FormError";

import Link from "next/link";
import Skeleton from "./Skeleton";
import Image from "next/image";
import { useState } from "react";
import Icon from "./Icon";
import { useStoreCatalog } from "./StoreCatalog";
import { storeRequest } from "../lib/store-api";

export function MoreCollections() {
  const { collections } = useStoreCatalog();
  return <div className="more-collections" aria-label="Shop by collection">{collections.map((collection) => <Link key={collection.id} href={`/shop?collection=${encodeURIComponent(collection.slug)}`}><Icon name="bag" /><span><strong>{collection.name}</strong><small>{collection.description}</small></span><Icon name="arrow" /></Link>)}</div>;
}

export function BrandExperience() {
  const { page } = useStoreCatalog();
  const content = page?.style_worth_talking_about;
  if (!content) return null;
  const src = imageSource(content.image);
  return <section className="brand-experience section" id="about" aria-labelledby="experience-title"><div className="experience-inner"><div className="experience-photo">{src && <Image src={src} alt={imageAlt(content.image)} fill sizes="(max-width:560px) 35vw,28vw" unoptimized={/^https?:/.test(src)} />}</div><div className="experience-copy"><p className="eyebrow">{content.eyebrow}</p><h2 id="experience-title">{content.title}</h2><p>{content.description}</p>{content.button && <Link className="button primary" href={contentHref(content.button.link)}>{content.button.text}<Icon name="arrow" /></Link>}</div><div className="experience-values">{content.highlights?.map((item, index) => <span key={index}><ContentIcon name={item.icon} />{item.text}</span>)}</div></div></section>;
}
export function Newsletter() {
  const { site, loading } = useStoreCatalog(); const enabled = site?.features?.newsletterSignup === true;
  const content = site?.footer?.newsletter;
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  return <section className="newsletter" id="contact" aria-labelledby="newsletter-title"><div><h2 id="newsletter-title">{content?.title}</h2><p>{content?.description}</p></div>{loading && !site && <Skeleton variant="form" label="Loading newsletter signup" />}<form hidden={loading && !site} onSubmit={async (event) => {
    event.preventDefault(); if (busy || !enabled) return; const form = event.currentTarget;
    const email = String(new FormData(form).get("email")).trim(); setBusy(true); setError(""); setMessage("");
    try { await storeRequest("newsletter/subscriptions", { method: "POST", body: { email } }); form.reset(); setMessage("Your subscription request was accepted. Check your inbox for any confirmation instructions."); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to subscribe."); }
    finally { setBusy(false); }
  }}>{error && <FormError className="newsletter-status" >{error}</FormError>}<label className="newsletter-label" htmlFor="newsletter-email">{content?.form?.label || "Email address"}</label><div className="newsletter-field"><input type="email" name="email" id="newsletter-email" required maxLength={254} placeholder={content?.form?.placeholder} autoComplete="email" disabled={busy || !enabled} /><button type="submit" disabled={busy || !enabled}>{busy ? "Subscribing..." : content?.form?.button_text || "Subscribe"}</button></div>{!enabled && <p className="newsletter-status">{content?.form?.status_message || "Newsletter signup is currently unavailable."}</p>}{message && <p className="newsletter-status" role="status">{message}</p>}</form><p className="newsletter-motto">{content?.slogan?.line_one}<br />{content?.slogan?.line_two}</p></section>;
}

