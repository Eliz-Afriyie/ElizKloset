"use client";
import Link from "next/link";
import Image from "next/image";
import { useStoreCatalog } from "./StoreCatalog";
import { contentHref, storeNavigation } from "../lib/store-content";
import ContentIcon from "./ContentIcon";
import SocialLinks from "./SocialLinks";

export function StoreBenefits() {
  const { site } = useStoreCatalog();
  const footer = site?.footer;
  if (!footer?.benefits?.length) return null;
  return <section className="service-strip" aria-label="Shopping benefits">{footer.benefits.map((item, index) => <div key={index}><ContentIcon name={item.icon} /><p><strong>{item.title}</strong><span>{item.description}</span></p></div>)}{footer.newsletter?.slogan && <p className="closing-line">{footer.newsletter.slogan.line_one}<br />{footer.newsletter.slogan.line_two}</p>}</section>;
}

export default function StoreFooter() {
  const { site } = useStoreCatalog();
  const footer = site?.footer;
  if (!footer) return null;
  const brand = footer.branding;
  return <footer className="footer boutique-footer"><div className="footer-brand"><Link href="/" aria-label={`${brand?.name || "ElizKloset"} home`}>{brand?.logo && <Image src={brand.logo} alt="" width={64} height={64} unoptimized style={{ objectFit: "contain" }} />}<strong>{brand?.name}</strong><small>{brand?.tagline}</small></Link></div><nav aria-label="Footer navigation">{storeNavigation(footer.navigation).map((item, index) => <Link key={index} href={contentHref(item.href)}>{item.label}</Link>)}</nav><SocialLinks links={footer.social_media || []} showHandles /><div className="footer-bottom"><span>{footer.bottom_bar?.copyright?.symbol} {new Date().getUTCFullYear()} {footer.bottom_bar?.copyright?.text}</span><span>{footer.bottom_bar?.closing_text}</span></div></footer>;
}
