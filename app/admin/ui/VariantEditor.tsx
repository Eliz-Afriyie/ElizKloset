"use client";
import FormError from "../../components/FormError";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import Photo from "../../components/DesignPhoto";
import Icon from "../../components/Icon";
import type { ColorVariant } from "./AdminCatalog";

export type VariantDraft = ColorVariant & { reading?: boolean; imageError?: string };
export function blankVariant(): VariantDraft { return { id: crypto.randomUUID(), color: "", hex: "#750d27", image: "", sizes: [{ size: "", stock: 0 }] }; }

export default function VariantEditor({ variants, setVariants }: { variants: VariantDraft[]; setVariants: Dispatch<SetStateAction<VariantDraft[]>> }) {
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? "");
  const selected = variants.some((variant) => variant.id === selectedId) ? selectedId : variants[0]?.id;
  const active = useRef(true);
  const uploads = useRef<Record<string, number>>({});
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  function update(id: string, change: Partial<VariantDraft>) { setVariants((previous) => previous.map((variant) => variant.id === id ? { ...variant, ...change } : variant)); }
  function upload(id: string, file?: File) {
    if (!file) return;
    const token = (uploads.current[id] ?? 0) + 1; uploads.current[id] = token;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { update(id, { imageError: "Choose a JPG, PNG or WebP under 5 MB.", reading: false }); return; }
    update(id, { imageError: "", reading: true }); const reader = new FileReader();
    reader.onload = () => { if (active.current && uploads.current[id] === token) update(id, { image: String(reader.result), reading: false }); };
    reader.onerror = () => { if (active.current && uploads.current[id] === token) update(id, { imageError: "Could not read this image.", reading: false }); }; reader.readAsDataURL(file);
  }
  return <section className="admin-variants" aria-labelledby="variants-heading"><div className="admin-variant-heading"><div><h3 id="variants-heading">Colours & variants</h3><p>Add a photo for each colour and track quantities by size.</p></div><button className="admin-button secondary" type="button" onClick={() => { const next = blankVariant(); setVariants((previous) => [...previous, next]); setSelectedId(next.id); }}><Icon name="plus" />Add colour variant</button></div>
    <div className="admin-variant-tabs" role="group" aria-label="Choose a colour variant">{variants.map((variant, index) => <button key={variant.id} type="button" aria-pressed={selected === variant.id} onClick={() => setSelectedId(variant.id)}><span style={{ background: variant.hex }} />{variant.color || `Colour ${index + 1}`}</button>)}</div>
    {variants.map((variant, index) => <fieldset hidden={variant.id !== selected} className="admin-variant-card" key={variant.id}><legend>Colour variant {index + 1}</legend><div className="admin-variant-top"><div className="admin-form-columns"><label>Colour name<input required maxLength={60} aria-label={`Variant ${index + 1} colour name`} value={variant.color} placeholder="e.g. Champagne" onChange={(event) => update(variant.id, { color: event.target.value })} /></label><label>Colour swatch<input type="color" aria-label={`Variant ${index + 1} swatch`} value={variant.hex} onChange={(event) => update(variant.id, { hex: event.target.value })} /></label></div><button className="admin-variant-remove" type="button" disabled={variants.length === 1} aria-label={`Remove colour variant ${index + 1}`} onClick={() => { uploads.current[variant.id] = (uploads.current[variant.id] ?? 0) + 1; setVariants((previous) => previous.filter((item) => item.id !== variant.id)); }}><Icon name="close" /></button></div>
      <div className="admin-variant-image">{variant.image ? <Photo src={variant.image} alt={`${variant.color || "Colour"} variant preview`} /> : <span className="admin-variant-no-image"><Icon name="bag" />No colour photo</span>}<div><label>Photo for {variant.color || `colour ${index + 1}`}<input type="file" aria-label={`Variant ${index + 1} image`} accept="image/jpeg,image/png,image/webp" onChange={(event) => upload(variant.id, event.target.files?.[0])} /></label><p>JPG, PNG or WebP · up to 5 MB. Missing photos stay clearly unassigned.</p>{variant.image && <button type="button" className="admin-text-button" onClick={() => { uploads.current[variant.id] = (uploads.current[variant.id] ?? 0) + 1; update(variant.id, { image: "", imageError: "", reading: false }); }}>Remove colour photo</button>}{variant.reading && <p role="status">Reading image…</p>}{variant.imageError && <FormError  className="admin-form-error">{variant.imageError}</FormError>}</div></div>
      <div className="admin-variant-size-heading"><strong>Sizes & physical stock</strong><span>{variant.sizes.reduce((sum, item) => sum + (Number.isFinite(item.stock) ? item.stock : 0), 0)} units</span></div><div className="admin-variant-sizes">{variant.sizes.map((item, sizeIndex) => <div className="admin-variant-size" key={sizeIndex}><label>Size<input aria-label={`Variant ${index + 1} size ${sizeIndex + 1}`} required maxLength={15} value={item.size} onChange={(event) => update(variant.id, { sizes: variant.sizes.map((size, i) => i === sizeIndex ? { ...size, size: event.target.value } : size) })} /></label><label>Quantity<input type="number" aria-label={`Variant ${index + 1} quantity ${sizeIndex + 1}`} required min="0" max="1000000" step="1" value={Number.isNaN(item.stock) ? "" : item.stock} onChange={(event) => update(variant.id, { sizes: variant.sizes.map((size, i) => i === sizeIndex ? { ...size, stock: event.target.value === "" ? NaN : Number(event.target.value) } : size) })} /></label><button type="button" disabled={variant.sizes.length === 1} aria-label={`Remove variant ${index + 1} size ${sizeIndex + 1}`} onClick={() => update(variant.id, { sizes: variant.sizes.filter((_, i) => i !== sizeIndex) })}><Icon name="close" /></button></div>)}</div><button className="admin-text-button" type="button" onClick={() => update(variant.id, { sizes: [...variant.sizes, { size: "", stock: 0 }] })}><Icon name="plus" />Add size</button>
    </fieldset>)}
  </section>;
}
