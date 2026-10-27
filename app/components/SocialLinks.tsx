export default function SocialLinks({ showHandles = false }: { showHandles?: boolean }) {
  return <div className={`social-links ${showHandles ? "social-links-footer" : ""}`} aria-label="Follow ElizKloset">
    {!showHandles && <span>Follow us</span>}
    <a href="https://www.tiktok.com/@Elizkloset" target="_blank" rel="noopener noreferrer" aria-label="ElizKloset on TikTok, @Elizkloset (opens in a new tab)">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 2h-3v13.2a3 3 0 1 1-2.5-3V9a6.1 6.1 0 1 0 5.5 6.1V8a8.4 8.4 0 0 0 5 1.6V6.5A5.5 5.5 0 0 1 16 2Z" /></svg>
      {showHandles && <span>@Elizkloset</span>}
    </a>
    <a href="https://www.instagram.com/_elizkloset/" target="_blank" rel="noopener noreferrer" aria-label="ElizKloset on Instagram, @_elizkloset (opens in a new tab)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
      {showHandles && <span>@_elizkloset</span>}
    </a>
  </div>;
}
