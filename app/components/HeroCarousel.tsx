"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

import { useStoreCatalog } from "./StoreCatalog";
import { contentHref, imageSource, imageAlt } from "../lib/store-content";
import ContentIcon from "./ContentIcon";
import Skeleton from "./Skeleton";

export default function HeroCarousel() {
  const { page, loading } = useStoreCatalog();
  const hero = page?.hero_section;
  const slides = hero?.slides.filter((slide) => slide.is_active !== false) || [];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const touchStart = useRef<number | null>(null);
  const move = (direction: number) => setIndex((previous) => (previous + direction + slides.length) % slides.length);

  useEffect(() => {
    if (paused || hovered || focused || hero?.autoplay === false || slides.length < 2) return;
    const timer = window.setInterval(() => {
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && !document.hidden) {
        setIndex((previous) => (previous + 1) % slides.length);
      }
    }, Math.max(2000, hero?.autoplay_interval || 6500));
    return () => window.clearInterval(timer);
  }, [paused, hovered, focused, index, slides.length, hero?.autoplay, hero?.autoplay_interval]);

  if (!slides.length) return loading ? <Skeleton variant="detail" label="Loading featured collections" /> : null;
  const activeIndex = index % slides.length;
  return (
    <section className="hero hero-carousel" role="region" aria-roledescription="carousel" aria-label="Featured collections"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }}
      onTouchEnd={(event) => { if (touchStart.current !== null) { const distance = touchStart.current - event.changedTouches[0].clientX; if (Math.abs(distance) > 60) move(distance > 0 ? 1 : -1); } touchStart.current = null; }}>
      {slides.map((slide, position) => {
        const active = position === activeIndex;
        const Heading = position === 0 ? "h1" : "h2";
        return <div key={slide.id} className={`carousel-slide ${active ? "is-active" : ""}`} inert={!active} aria-hidden={!active} role="group" aria-roledescription="slide" aria-label={`${position + 1} of ${slides.length}`}>
          <div className="carousel-photo">
            <div className="hero-portrait"><Image src={imageSource(slide.image)} alt={imageAlt(slide.image)} unoptimized={/^https?:/.test(imageSource(slide.image))} fill sizes="(max-width: 560px) 55vw, 56vw" quality={90} preload={position === 0} /></div>
          </div>
          <div className="hero-content">
            <p className="eyebrow">{slide.eyebrow}</p>
            <Heading className="hero-heading">{slide.title}</Heading>
            <p className="hero-description">{slide.description}</p>
            <div className="hero-buttons">{slide.button_text && <a className="button primary" href={contentHref(slide.button_link)}>{slide.button_text}<Icon name="arrow" /></a>}</div>
            <div className="hero-benefits">{(slide.highlights || []).map((benefit) => <span key={benefit.text}><ContentIcon name={benefit.icon} /><span>{benefit.text}</span></span>)}</div>
          </div>
        </div>;
      })}
      {slides.length > 1 && hero?.show_navigation !== false && <><button className="carousel-arrow previous" aria-label="Previous slide" onClick={() => move(-1)}><Icon name="arrow" /></button>
      <button className="carousel-arrow next" aria-label="Next slide" onClick={() => move(1)}><Icon name="arrow" /></button></>}
      {slides.length > 1 && <div className="carousel-controls">{hero?.show_indicators !== false && <div className="carousel-dots" aria-label="Choose a slide">{slides.map((item, position) => <button key={item.id} aria-label={`Show slide ${position + 1}: ${item.eyebrow}`} aria-current={position === activeIndex ? "true" : undefined} className={position === activeIndex ? "current" : ""} onClick={() => setIndex(position)} />)}</div>}<button className="carousel-pause" aria-label={paused ? "Resume slideshow" : "Pause slideshow"} onClick={() => setPaused(!paused)}>{paused ? "Play" : "Pause"}</button></div>}
    </section>
  );
}





