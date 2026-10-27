"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

const slides = [
  { eyebrow: "Elegant corporate fashion", first: "Dress", accent: "Corporate", last: "with Liz", description: "Elegant, stylish and professional outfits for every woman.", cta: "Shop New Arrivals", href: "/shop?collection=New%20Arrivals", image: "/images/hero-burgundy.png", alt: "Full-length fashion portrait in an elegant burgundy corporate dress" },
  { eyebrow: "Make an entrance", first: "Dress", accent: "Corporate", last: "with Liz", description: "Discover confident colours and effortless silhouettes for your work wardrobe.", cta: "Explore the Collection", href: "/shop", image: "/images/hero-blue.png", alt: "Full-length fashion portrait in a royal blue corporate dress" },
  { eyebrow: "From meetings to milestones", first: "Dress", accent: "Corporate", last: "with Liz", description: "Find polished office favourites for wherever your ambition takes you.", cta: "Find Your Favourite", href: "/shop", image: "/images/hero-champagne.png", alt: "Full-length fashion portrait in a tailored champagne office outfit" },
];

const benefits = [
  { icon: "diamond", first: "Quality", second: "Selection" },
  { icon: "truck", first: "Ghana-Wide", second: "Delivery" },
  { icon: "card", first: "Secure", second: "Payments" },
  { icon: "headset", first: "Trusted", second: "Service" },
] as const;

export default function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const touchStart = useRef<number | null>(null);
  const move = (direction: number) => setIndex((previous) => (previous + direction + slides.length) % slides.length);

  useEffect(() => {
    if (paused || hovered || focused) return;
    const timer = window.setInterval(() => {
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && !document.hidden) {
        setIndex((previous) => (previous + 1) % slides.length);
      }
    }, 6500);
    return () => window.clearInterval(timer);
  }, [paused, hovered, focused, index]);

  return (
    <section className="hero hero-carousel" role="region" aria-roledescription="carousel" aria-label="Featured collections"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }}
      onTouchEnd={(event) => { if (touchStart.current !== null) { const distance = touchStart.current - event.changedTouches[0].clientX; if (Math.abs(distance) > 60) move(distance > 0 ? 1 : -1); } touchStart.current = null; }}>
      {slides.map((slide, position) => {
        const active = position === index;
        const Heading = position === 0 ? "h1" : "h2";
        return <div key={slide.image} className={`carousel-slide ${active ? "is-active" : ""}`} inert={!active} aria-hidden={!active} role="group" aria-roledescription="slide" aria-label={`${position + 1} of ${slides.length}`}>
          <div className="carousel-photo">
            <div className="hero-portrait"><Image src={slide.image} alt={slide.alt} fill sizes="(max-width: 560px) 55vw, 56vw" quality={90} preload={position === 0} /></div>
          </div>
          <div className="hero-content">
            <p className="eyebrow">{slide.eyebrow}</p>
            <Heading className="hero-heading">{slide.first}<br /><span>{slide.accent}</span><br /><span className="hero-last-line">{slide.last}</span></Heading>
            <p className="hero-description">{slide.description}</p>
            <div className="hero-buttons"><a className="button primary" href={slide.href}>{slide.cta}<Icon name="arrow" /></a><a className="button outline" href="/shop">View Collections</a></div>
            <div className="hero-benefits">{benefits.map((benefit) => <span key={benefit.icon}><Icon name={benefit.icon} /><span>{benefit.first}<br />{benefit.second}</span></span>)}</div>
          </div>
        </div>;
      })}
      <button className="carousel-arrow previous" aria-label="Previous slide" onClick={() => move(-1)}><Icon name="arrow" /></button>
      <button className="carousel-arrow next" aria-label="Next slide" onClick={() => move(1)}><Icon name="arrow" /></button>
      <div className="carousel-controls"><div className="carousel-dots" aria-label="Choose a slide">{slides.map((item, position) => <button key={item.eyebrow} aria-label={`Show slide ${position + 1}: ${item.eyebrow}`} aria-current={position === index ? "true" : undefined} className={position === index ? "current" : ""} onClick={() => setIndex(position)} />)}</div><button className="carousel-pause" aria-label={paused ? "Resume slideshow" : "Pause slideshow"} onClick={() => setPaused(!paused)}>{paused ? "Play" : "Pause"}</button></div>
    </section>
  );
}





