"use client";
import Image from "next/image";
import Link from "next/link";
import { contentHref, imageSource, imageAlt } from "../lib/store-content";
import { useStoreCatalog } from "./StoreCatalog";
import Skeleton from "./Skeleton";

export default function PageBanner({ about = false }: { about?: boolean }) {
  const { page, loading } = useStoreCatalog();
  const slide = page?.hero_section?.slides.find((item) => item.is_active !== false);
  if (!slide) return loading ? <Skeleton variant="detail" label="Loading page banner" /> : null;
  const src = imageSource(slide.image);
  if (about) return <section className="about-editorial-hero" aria-labelledby="about-title"><div className="about-hero-portrait"><Image src={src} alt={imageAlt(slide.image)} fill sizes="(max-width:650px) 100vw,60vw" unoptimized={/^https?:/.test(src)} preload /></div><div className="about-hero-shade" aria-hidden="true" /><div className="about-hero-copy"><p className="about-kicker">{slide.eyebrow}</p><h1 id="about-title">{slide.title}</h1><p>{slide.description}</p>{slide.button_text && <Link className="button about-hero-button" href={contentHref(slide.button_link)}>{slide.button_text}</Link>}</div></section>;
  return <section className="shop-banner editorial-shop-banner"><div className="shop-banner-photo"><Image src={src} alt={imageAlt(slide.image)} fill sizes="50vw" unoptimized={/^https?:/.test(src)} /></div><div className="shop-banner-copy"><p className="shop-banner-eyebrow">{slide.eyebrow}</p><h1>{slide.title}</h1><p>{slide.description}</p>{slide.button_text && <Link className="button primary" href={contentHref(slide.button_link)}>{slide.button_text}</Link>}</div></section>;
}
