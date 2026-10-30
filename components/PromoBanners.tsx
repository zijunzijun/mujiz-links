import React, { useEffect, useRef, useState } from 'react';
import { PromoBanner } from '../types';
import { Language } from '../i18n';
import './PromoBanners.css';

const INTERVAL_MS = 5000;

// Reset when the configured slides change, including while a transition is running.
export default function PromoBanners({ banners, language = 'zh' }: { banners: PromoBanner[]; language?: Language }) {
  const active = banners.filter(banner => banner.isActive && banner.imageUrl.trim());
  if (!active.length) return null;
  return <Carousel key={active.map(banner => banner.id).join('|')} banners={active} language={language} />;
}

function Carousel({ banners, language }: { banners: PromoBanner[]; language: Language }) {
  const count = banners.length;
  const [slot, setSlot] = useState(1);
  const [animate, setAnimate] = useState(true);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hidden, setHidden] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number; dx: number; horizontal: boolean } | null>(null);
  const suppressClick = useRef(false);
  const moving = useRef(false);
  const current = (slot - 1 + count) % count;
  const slides = count > 1 ? [banners[count - 1], ...banners, banners[0]] : banners;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(media.matches);
    const updateVisibility = () => setHidden(document.hidden);
    updateMotion(); updateVisibility();
    media.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      media.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  // Reposition the duplicate end slide invisibly, then restore transitions.
  useEffect(() => {
    if (animate) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => { setAnimate(true); moving.current = false; });
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [animate]);

  const settle = () => {
    moving.current = false;
    if (slot === 0 || slot === count + 1) {
      setAnimate(false);
      setSlot(slot === 0 ? count : 1);
    }
  };

  // Fallback also handles reduced motion, which has no transitionend event.
  useEffect(() => {
    if (!moving.current || dragging) return;
    const timer = window.setTimeout(settle, reducedMotion ? 0 : 550);
    return () => window.clearTimeout(timer);
  }, [slot, dragging, reducedMotion]);

  const moveTo = (target: number) => {
    if (count < 2 || moving.current || !animate) return;
    moving.current = true;
    setSlot(target);
  };

  useEffect(() => {
    if (count < 2 || hovered || focused || dragging || reducedMotion || hidden || !animate) return;
    // The next image enters from the left and the current image exits right.
    const timer = window.setInterval(() => moveTo(slot - 1), INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [count, slot, hovered, focused, dragging, reducedMotion, hidden, animate]);

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    gesture.current = null;
    setDragging(false);
    setDrag(0);
    const width = viewport.current?.clientWidth || 1;
    const threshold = Math.min(70, width * .18);
    if (!cancelled && start.horizontal && Math.abs(start.dx) >= threshold) {
      moveTo(slot + (start.dx < 0 ? 1 : -1));
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <section className="promo-banners" aria-label={language === 'en' ? 'Featured links' : '精選推廣'} aria-roledescription={count > 1 ? (language === 'en' ? 'carousel' : '輪播') : undefined}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}
      onKeyDown={event => {
        if (count < 2) return;
        if (event.key === 'ArrowLeft') { event.preventDefault(); moveTo(slot - 1); }
        if (event.key === 'ArrowRight') { event.preventDefault(); moveTo(slot + 1); }
      }}>
      <div ref={viewport} className={`promo-viewport${count > 1 ? ' promo-draggable' : ''}${dragging ? ' is-dragging' : ''}`}
        onDragStart={event => event.preventDefault()}
        onPointerDown={event => {
          suppressClick.current = false;
          if (count < 2 || !event.isPrimary || event.button !== 0 || moving.current || !animate) return;
          gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, horizontal: false };
          setDragging(true);
        }}
        onPointerMove={event => {
          const start = gesture.current;
          if (!start || start.id !== event.pointerId) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (!start.horizontal) {
            if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { finishDrag(event, true); return; }
            if (Math.abs(dx) < 8) return;
            start.horizontal = true;
            suppressClick.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          start.dx = dx;
          const width = viewport.current?.clientWidth || 1;
          setDrag(Math.max(-width, Math.min(width, dx)));
        }}
        onPointerUp={event => finishDrag(event)}
        onPointerCancel={event => finishDrag(event, true)}
        onLostPointerCapture={event => finishDrag(event, true)}
        onPointerLeave={event => { if (gesture.current && !gesture.current.horizontal) finishDrag(event, true); }}
        onClickCapture={event => {
          if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
        }}>
        <div className="promo-track" style={{
          transform: `translate3d(calc(-${count > 1 ? slot * 100 : 0}% + ${drag}px), 0, 0)`,
          transition: animate && !dragging && !reducedMotion ? undefined : 'none',
        }} onTransitionEnd={event => { if (event.target === event.currentTarget && event.propertyName === 'transform') settle(); }}>
          {slides.map((banner, slideIndex) => {
            const originalIndex = count > 1 ? slideIndex - 1 : 0;
            const active = originalIndex === current;
            return (
              <a key={`${slideIndex}-${banner.id}`} href={banner.url} target="_blank" rel="noopener noreferrer"
                className="promo-slide" tabIndex={active ? 0 : -1} aria-hidden={!active}
                aria-label={banner.imageAlt || (language === 'en' ? 'View featured link' : '查看推廣連結')} draggable={false}>
                <img src={banner.imageUrl} alt={banner.imageAlt} draggable={false} className="promo-banner-image" />
              </a>
            );
          })}
        </div>
      </div>
      {count > 1 && (
        <div className="promo-dots" aria-label={language === 'en' ? 'Choose banner' : '選擇推廣圖片'}>
          {banners.map((banner, slideIndex) => (
            <button type="button" key={banner.id} className="promo-dot"
              aria-label={language === 'en' ? `Slide ${slideIndex + 1}: ${banner.imageAlt}` : `第 ${slideIndex + 1} 張：${banner.imageAlt}`} 
              aria-current={slideIndex === current ? 'true' : undefined}
              onClick={() => { if (slideIndex !== current) moveTo(slideIndex + 1); }}><span /></button>
          ))}
        </div>
      )}
    </section>
  );
}
