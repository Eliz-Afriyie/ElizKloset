import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import Icon from "../../components/Icon";

export default function AdminAuthLayout({ step, title, introduction, children }: { step: 1 | 2; title: string; introduction: string; children: ReactNode }) {
  return <main className="admin-login"><section className="admin-login-brand"><Image className="admin-login-photo" src="/images/hero-burgundy.png" alt="" fill sizes="(max-width: 620px) 100vw, 46vw" preload /><div className="admin-login-shade" aria-hidden="true" /><Link href="/" className="admin-wordmark">Eliz<span>Kloset</span><small>DRESS CORPORATE WITH LIZ</small></Link><div className="admin-login-story"><span className="admin-small-label">THE BUSINESS BEHIND THE STYLE</span><h1>A beautiful store.<br />{" "}An organised<br />{" "}<em>business.</em></h1><p>Your collections, customers and everyday operations. All in one thoughtful workspace.</p><div className="admin-brand-features"><span><Icon name="bag" />Curate your collections</span><span><Icon name="truck" />Keep orders moving</span><span><Icon name="heart" />Care for your customers</span></div></div><p className="admin-login-footnote">ElizKloset · Management workspace</p></section>
    <section className="admin-login-main"><Link className="admin-back" href="/"><Icon name="arrow-left" />Back to storefront</Link><div className="admin-login-card"><span className="admin-login-lock"><Icon name="lock" /></span><p className="admin-small-label">STAFF PORTAL · STEP {step} OF 2</p><h2>{title}</h2><p className="admin-login-intro">{introduction}</p><ol className="admin-auth-steps" aria-label="Staff sign-in progress"><li className={step === 1 ? "current" : "complete"} aria-current={step === 1 ? "step" : undefined}><span>1</span>Sign in</li><li className={step === 2 ? "current" : ""} aria-current={step === 2 ? "step" : undefined}><span>2</span>Verify OTP</li></ol>{children}</div><p className="admin-login-bottom">Made for the next chapter of ElizKloset.</p></section>
  </main>;
}

