"use client";
import { useState, type FormEvent } from "react";
import FormError from "./FormError";
import PageBanner from "./PageBanner";
import SocialLinks from "./SocialLinks";
import ContentIcon from "./ContentIcon";
import Skeleton from "./Skeleton";
import { storeRequest } from "../lib/store-api";
import { contentHref } from "../lib/store-content";
import { useStoreCatalog } from "./StoreCatalog";

export default function ContactContent() {
  const { site, page, loading } = useStoreCatalog();
  const content = page?.contact_section;
  const formContent = content?.form;
  const enabled = site?.features?.contactSubmission === true && formContent?.status?.is_available !== false;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !enabled) return;
    const form = event.currentTarget; const fields = new FormData(form);
    setBusy(true); setMessage(""); setError("");
    try {
      await storeRequest("contact/messages", { method: "POST", body: Object.fromEntries(["name", "email", "subject", "message"].map((key) => [key, String(fields.get(key) || "").trim()])) });
      form.reset(); setMessage(formContent?.status?.success_message || "Your message was sent. Thank you for contacting us.");
    } catch (error) { setError(error instanceof Error ? error.message : formContent?.status?.error_message || "Unable to send your message."); }
    finally { setBusy(false); }
  }
  return <><PageBanner />{loading && !content && <Skeleton variant="form" label="Loading contact details" />}{content && <section className="contact-content section"><div className="contact-methods"><p className="eyebrow">{content.eyebrow}</p><h2>{content.title}</h2><p>{content.description}</p>{content.contact_methods?.map((item, index) => <a key={index} className="contact-method" href={contentHref(item.link)} {...(item.link.startsWith("https:") ? { target: "_blank", rel: "noopener noreferrer" } : {})}><ContentIcon name={item.icon} /><span><strong>{item.title}</strong><span>{item.value}</span><small>{item.description}</small></span><span aria-hidden="true">→</span></a>)}{content.social_media && <div className="contact-socials"><h3>{content.social_media.title}</h3><SocialLinks links={content.social_media.links} showHandles /></div>}</div>{formContent && <div className="contact-form-panel"><h2>{formContent.title}</h2><p>{formContent.description}</p><form className="contact-email-form" onSubmit={sendMessage}>{error && <FormError>{error}</FormError>}<fieldset disabled={busy || !enabled} style={{ border: 0, padding: 0, margin: 0 }}>{Object.entries(formContent.fields || {}).map(([key, field]) => <label key={key}>{field.label}{field.type === "textarea" ? <textarea name={key} required={field.required} rows={5} maxLength={3000} placeholder={field.placeholder} /> : field.type === "select" ? <select name={key} required={field.required} defaultValue=""><option value="" disabled>{field.placeholder || "Select"}</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input name={key} type={field.type === "email" ? "email" : "text"} autoComplete={key === "email" ? "email" : key === "name" ? "name" : undefined} required={field.required} maxLength={key === "email" ? 254 : 100} placeholder={field.placeholder} />}</label>)}<p className="contact-form-note" id="contact-send-note">{!enabled && (formContent.status?.unavailable_message || "Online messages are currently unavailable.")}</p><button className="button primary" type="submit" disabled={busy || !enabled} aria-describedby="contact-send-note">{busy ? "Sending..." : formContent.submit_button?.text || "Send message"}<span aria-hidden="true">→</span></button></fieldset></form>{message && <p role="status">{message}</p>}</div>}</section>}</>;
}