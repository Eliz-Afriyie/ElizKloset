"use client";
import { useStoreCatalog } from "./StoreCatalog";
import { contentHref, type Social } from "../lib/store-content";
export default function SocialLinks({ showHandles = false, links }: { showHandles?: boolean; links?: Social[] }) {
  const { site } = useStoreCatalog();
  const items = links || site?.footer?.social_media || site?.socials || [];
  return <div className={`social-links ${showHandles ? "social-links-footer" : ""}`} aria-label="Follow ElizKloset">
    {!showHandles && <span>Follow us</span>}
    {items.map((item, index) => <a key={index} href={contentHref(item.link || item.url)} target="_blank" rel="noopener noreferrer" aria-label={`ElizKloset on ${item.platform} (opens in a new tab)`}>{item.platform.toLowerCase() === "tiktok" ? <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 2h-3v13.2a3 3 0 1 1-2.5-3V9a6.1 6.1 0 1 0 5.5 6.1V8a8.4 8.4 0 0 0 5 1.6V6.5A5.5 5.5 0 0 1 16 2Z" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>}{showHandles && <span>{item.username || item.handle || item.platform}</span>}</a>)}  </div>;
}
