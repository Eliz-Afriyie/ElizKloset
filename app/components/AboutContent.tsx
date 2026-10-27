import Image from "next/image";
import Link from "next/link";
import Icon from "./Icon";

export default function AboutContent() {
  return <>
    <section className="about-editorial-hero" aria-labelledby="about-title">
      <div className="about-hero-portrait"><Image src="/images/ceo/CEO-2.png" alt="Ms. Elizabeth Afriyie, CEO of ElizKloset" fill sizes="(max-width: 650px) 100vw, 60vw" quality={90} preload /></div>
      <div className="about-hero-shade" aria-hidden="true" />
      <div className="about-hero-copy"><p className="about-kicker">THE ELIZKLOSET STORY</p><h1 id="about-title">Style for<br /><em>your next</em><br />chapter.</h1><p>Thoughtfully selected fashion.<br />The confidence to make it your own.</p><a className="button about-hero-button" href="#meet-liz">Meet the woman behind the style<Icon name="arrow" /></a></div>
      <div className="about-brand-seal" aria-hidden="true"><span>ELIZKLOSET</span><span className="about-seal-star">✧</span><span>DRESS WITH CONFIDENCE</span></div>
      <svg className="about-hero-curve" viewBox="0 0 1440 160" preserveAspectRatio="none" aria-hidden="true"><path fill="#c9a773" d="M0 0 Q720 220 1440 0 V160 H0Z" /><path fill="#fff9f3" d="M0 25 Q720 245 1440 25 V160 H0Z" /></svg>
    </section>
    <section className="about-founder section" id="meet-liz" aria-labelledby="about-founder-title">
      <figure className="about-founder-portrait"><div className="about-founder-frame"><Image src="/images/ceo/CEO-1.png" alt="Elizabeth Afriyie wearing burgundy corporate fashion" fill sizes="(max-width: 650px) 80vw, 34vw" quality={90} /></div><figcaption><span className="about-founder-signature">Elizabeth Afriyie</span><span>CEO, ELIZKLOSET</span></figcaption></figure>
      <div className="about-founder-copy"><p className="about-kicker">A NOTE FROM OUR FOUNDER</p><h2 id="about-founder-title">A love for style.<br /><em>A purpose beyond it.</em></h2><p className="about-founder-lead">Welcome to ElizKloset. A place for polished looks, everyday favourites, and a little more confidence in your wardrobe.</p><p>Led by Ms. Elizabeth Afriyie, ElizKloset is a Ghanaian fashion business bringing together elegant corporate dresses and two-piece outfits for women who want to feel confident and put together.</p><p>From ladies’ bags and shoes to men’s shirts, boxers, and singlets, our collections bring workwear and everyday essentials into one thoughtful wardrobe.</p><p className="about-founder-motto">Dress Corporate with Liz.</p><Link className="button primary" href="/shop">Find your next favourite<Icon name="arrow" /></Link><Link className="about-founder-contact" href="/contact">Let’s talk style <Icon name="arrow" /></Link></div>
    </section>
    <section className="about-promises section" aria-label="What matters to us"><article><span>01</span><h3>Thoughtfully selected</h3><p>Pieces chosen with style and everyday wear in mind.</p></article><article><span>02</span><h3>Confidence in your style</h3><p>Fashion that helps you show up feeling like yourself.</p></article><article><span>03</span><h3>Something for every day</h3><p>Corporate looks and essentials for women and men.</p></article></section>
  </>;
}





