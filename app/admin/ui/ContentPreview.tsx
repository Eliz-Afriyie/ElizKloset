"use client";

import { useState } from "react";
import Image from "next/image";
import { isObject, type ContentObject, type ContentValue } from "../lib/resources";
import "./content-preview.css";

const label = (name: string) => name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
const text = (value: ContentValue | undefined) => typeof value === "string" ? value : "";

function PreviewValue({ name, value, assets }: { name: string; value: ContentValue; assets: Record<string, string> }) {
  if (value === null || value === "") return null;
  if (typeof value === "string" && /^(image|image_url|logo|portrait)$/.test(name) && /^(https?:\/\/|\/[^/])/.test(value)) return <Image className="content-preview-image" src={value} alt="Draft image" width={400} height={260} unoptimized />;
  if (/Ids$/.test(name)) return <p className="content-preview-note">{label(name.replace(/Ids$/, ""))}: {Array.isArray(value) ? value.length : 0} selected</p>;
  if (Array.isArray(value)) return <section className="content-preview-section"><div className="content-preview-label">{label(name)}</div>{value.length ? value.map((item, index) => <PreviewValue key={index} name={`${name} ${index + 1}`} value={item} assets={assets} />) : <p className="content-preview-note">No items selected</p>}</section>;
  if (isObject(value)) {
    if ("assetId" in value || "url" in value && /image|portrait/i.test(name)) {
      const src = text(value.url) || assets[text(value.assetId)];
      // Uploaded assets are remote URLs returned by the admin API.
      // eslint-disable-next-line @next/next/no-img-element
      return src && /^(https?:\/\/|\/[^/])/.test(src) ? <img className="content-preview-image" src={src} alt={text(value.alt)} /> : <div className="content-preview-image-placeholder">{value.assetId ? "Selected image" : "Choose an image"}{value.alt ? <small>{text(value.alt)}</small> : null}</div>;
    }
    if ("label" in value && "href" in value) return <span className="content-preview-action">{text(value.label) || "Button label"}</span>;
    const banner = "eyebrow" in value || "title" in value || "heading" in value;
    return <section className={banner ? "content-preview-banner" : "content-preview-section"}>
      {value.image && <PreviewValue name="image" value={value.image} assets={assets} />}
      <div className="content-preview-copy">
        {value.eyebrow && <p className="content-preview-eyebrow">{text(value.eyebrow)}</p>}
        {(value.title || value.heading) && <h3>{text(value.title) || text(value.heading)}</h3>}
        {Object.entries(value).filter(([key]) => !["id", "image", "eyebrow", "title", "heading"].includes(key)).map(([key, item]) => <PreviewValue key={key} name={key} value={item} assets={assets} />)}
      </div>
    </section>;
  }
  if (typeof value === "boolean") return <p className="content-preview-note">{label(name)}: {value ? "Enabled" : "Disabled"}</p>;
  return <p className="content-preview-text">{String(value)}</p>;
}

export default function ContentPreview({ content, assets }: { content: ContentObject; assets: Record<string, string> }) {
  const [mobile, setMobile] = useState(false);
  return <aside className="content-preview" aria-label="Draft content preview">
    <div className="content-preview-toolbar"><div><strong>Live preview</strong><small>Unsaved draft · updates as you type</small></div><button type="button" className="admin-text-button" aria-pressed={mobile} onClick={() => setMobile(!mobile)}>{mobile ? "Desktop view" : "Mobile view"}</button></div>
    <p className="content-preview-note">Draft content preview. Changes appear on the storefront after publishing; layout may differ.</p>
    <div className={`content-preview-canvas${mobile ? " is-mobile" : ""}`}><div className="content-preview-brand">{text(content.name) || "ElizKloset"}</div><PreviewValue name="page" value={content} assets={assets} /></div>
  </aside>;
}
