import PageBanner from "./PageBanner";
import Image from "next/image";
import Link from "next/link";
import Icon from "./Icon";

export default function AboutContent() {
  return <>
    <PageBanner about />
    <section className="about-founder section" id="meet-liz" aria-labelledby="about-founder-title">
      <figure className="about-founder-portrait"><div className="about-founder-frame"><Image src="/images/ceo/CEO-1.png" alt="Elizabeth Afriyie wearing burgundy corporate fashion" fill sizes="(max-width: 650px) 80vw, 34vw" quality={90} /></div><figcaption><span className="about-founder-signature">Elizabeth Afriyie</span><span>CEO, ELIZKLOSET</span></figcaption></figure>
      <div className="about-founder-copy"><p className="about-kicker">A NOTE FROM OUR FOUNDER</p><h2 id="about-founder-title">A love for style.<br /><em>A purpose beyond it.</em></h2><p className="about-founder-lead">Welcome to ElizKloset. A place for polished looks, everyday favourites, and a little more confidence in your wardrobe.</p><p>Led by Ms. Elizabeth Afriyie, ElizKloset is a Ghanaian fashion business bringing together elegant corporate dresses and two-piece outfits for women who want to feel confident and put together.</p><p>From ladies’ bags and shoes to men’s shirts, boxers, and singlets, our collections bring workwear and everyday essentials into one thoughtful wardrobe.</p><p className="about-founder-motto">Dress Corporate with Liz.</p><Link className="button primary" href="/shop">Find your next favourite<Icon name="arrow" /></Link><Link className="about-founder-contact" href="/contact">Let’s talk style <Icon name="arrow" /></Link></div>
    </section>
    <section className="about-promises section" aria-label="What matters to us"><article><span>01</span><h3>Thoughtfully selected</h3><p>Pieces chosen with style and everyday wear in mind.</p></article><article><span>02</span><h3>Confidence in your style</h3><p>Fashion that helps you show up feeling like yourself.</p></article><article><span>03</span><h3>Something for every day</h3><p>Corporate looks and essentials for women and men.</p></article></section>
  </>;
}





