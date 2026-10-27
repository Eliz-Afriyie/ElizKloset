"use client";
import FormError from "./FormError";

import Image from "next/image";
import Skeleton from "./Skeleton";
import { useState, type FormEvent } from "react";
import SocialLinks from "./SocialLinks";
import { storeRequest } from "../lib/store-api";
import { useStoreCatalog } from "./StoreCatalog";

export default function ContactContent() {
  const { site, loading } = useStoreCatalog(); const enabled = site?.features?.contactSubmission === true;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !enabled) return;
    const form = event.currentTarget; const fields = new FormData(form);
    setBusy(true); setMessage(""); setError("");
    try {
      await storeRequest("contact/messages", { method: "POST", body: Object.fromEntries(["name", "email", "subject", "message"].map((key) => [key, String(fields.get(key)).trim()])) });
      form.reset(); setMessage("Your message was sent. Thank you for contacting us.");
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to send your message."); }
    finally { setBusy(false); }
  }
  return <>
    <section className="shop-banner editorial-shop-banner contact-banner" aria-labelledby="contact-title"><div className="shop-banner-photo"><Image src="/images/hero-champagne.png" alt="Champagne corporate fashion from ElizKloset" fill sizes="(max-width: 650px) 45vw, 360px" preload /></div><div className="shop-banner-copy"><p className="shop-banner-eyebrow">We are here for you<span aria-hidden="true" /></p><h1 id="contact-title">Let’s Talk<br /><span>Style.</span></h1><p>Questions about a style, your size, or our collections? Get in touch.</p></div></section>
    <section className="contact-content section">
      <div className="contact-methods"><p className="eyebrow">Contact ElizKloset</p><h2>Let’s find your<br />next favourite.</h2><p>Message us on WhatsApp or give us a call. Wed love to help.</p>
        <a className="contact-method" href="https://wa.me/233560425514" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M20 11.5a8.5 8.5 0 0 1-12.8 7.3L3 20l1.2-4.2A8.5 8.5 0 1 1 20 11.5Z" /><path d="M8 7c0 5 3 8 8 8l1-2-3-1-1 1-3-3 1-1-1-3-2 1Z" /></svg><span><strong>WhatsApp</strong><span>056 042 5514</span><small>Chat with us</small></span><span aria-hidden="true">→</span></a>
        <a className="contact-method" href="tel:+233594717121"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m6 3 4 1-1 5-2 1c2 4 3 5 7 7l1-2 5-1 1 4c0 2-2 3-4 3C9 20 4 15 3 7c0-2 1-4 3-4Z" /></svg><span><strong>Call us</strong><span>059 471 7121</span><small>Speak with ElizKloset</small></span><span aria-hidden="true">→</span></a>
        <div className="contact-socials"><h3>Follow along</h3><SocialLinks showHandles /></div>
      </div>
      <div className="contact-form-panel"><h2>Send us a message</h2><p>Leave your name, email address, and question below.</p>{loading && !site && <Skeleton variant="form" label="Loading contact form" />}<form hidden={loading && !site} className="contact-email-form" onSubmit={sendMessage}>{error && <FormError >{error}</FormError>}<fieldset disabled={busy || !enabled} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="contact-form-row"><label>Your name<input name="name" autoComplete="name" required maxLength={100} placeholder="Full name" /></label><label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" /></label></div>
        <label>Subject<select name="subject" defaultValue="product_enquiry"><option value="product_enquiry">Product enquiry</option><option value="sizing_fit">Sizing and fit</option><option value="delivery_enquiry">Delivery enquiry</option><option value="general_enquiry">General enquiry</option></select></label>
        <label>Your message<textarea name="message" required rows={5} maxLength={3000} placeholder="How can we help?" /></label>
        <p className="contact-form-note" id="contact-send-note">{enabled ? "Send your enquiry directly to our team." : "Online messages are currently unavailable. Please contact us by phone or WhatsApp."}</p>
        <button className="button primary" type="submit" disabled={busy || !enabled} aria-describedby="contact-send-note">{busy ? "Sending..." : "Send message"}<span aria-hidden="true">→</span></button>
      </fieldset></form>{message && <p role="status">{message}</p>}</div>
    </section>
  </>;
}




