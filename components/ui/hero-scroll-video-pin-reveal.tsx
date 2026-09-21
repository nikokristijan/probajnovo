"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

/**
 * Adaptirano iz 21st.dev "hero-scroll-video-pin-reveal" community komponente
 * (poslani demo je bio "quiet peaks" planinarski hero s dron videom). NOVO
 * nema takav video pa smo ovo prilagodili:
 *  - Boje/fontovi: umjesto zeleno-bež "priroda" palete i genericnih fontova,
 *    koristi iste NOVO tokene kao ostatak /proizvodi stranica (--font-space-
 *    grotesk za naslove, --font-karla za tijelo, --font-jetbrains-mono za
 *    kicker/tagove) i brand trojku navy/orange/purple (ista kao owner-dash
 *    .owner-stat-card-* akcenti).
 *  - Video je OPCIONALAN (`videoSrc?`) — kad nije zadan (još nema pravog
 *    snimka), prikazuje se jasno označena placeholder ploča umjesto slomljenog
 *    <video> elementa, da se lako zamijeni pravim materijalom kasnije.
 *  - Maknuti vanjski cdn.21st.dev badge/play ikone (tuđi CDN, mogu nestati) —
 *    play ikona je sad inline SVG, rotirajući "badge" je uklonjen (bio je
 *    specifičan za "quiet peaks" temu demoa).
 *  - Maknut opcionalni Lenis smooth-scroll dynamic import iz demoa: paket
 *    (@studio-freight/lenis) nije instaliran u ovom projektu, a dynamic
 *    import nepostojećeg paketa zna srušiti build kod bundlanja — pin/reveal
 *    efekt radi identično i na native scrollu.
 *  - Dodan prefers-reduced-motion bypass (demo ga nije imao): korisnici koji
 *    su tražili manje animacija dobiju sadržaj odmah vidljiv, bez scroll-
 *    jacking pina.
 */

gsap.registerPlugin(ScrollTrigger, SplitText);

export interface TagItem {
  id?: string;
  text: string;
  background: string;
  color?: string;
}

export interface HeroScrollVideoRevealProps {
  topText?: React.ReactNode;
  headingText?: React.ReactNode;
  tags?: TagItem[];
  subText?: string;
  videoSrc?: string;
  posterSrc?: string;
  bottomText?: React.ReactNode;
  className?: string;
}

const NOVO_NAVY = "#0000c3";
const NOVO_ORANGE = "#ff7f00";
const NOVO_PURPLE = "#6a21b0";
const NOVO_INK = "#0a0a1a";

const DEFAULT_TAGS: TagItem[] = [
  { text: "Dodirni i spoji se na WiFi", background: NOVO_NAVY, color: "#ffffff" },
  { text: "Bez lozinke, bez traženja routera", background: NOVO_ORANGE, color: "#1a1200" },
  { text: "Google recenzija jednim dodirom", background: NOVO_PURPLE, color: "#ffffff" },
  { text: "Prostorna slova po mjeri", background: "#f3f3fb", color: NOVO_INK },
];

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v13.72c0 .8.87 1.29 1.57.87l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

/** Placeholder ploča kad videoSrc još nije zadan — vidljivo označena kao
    privremena (za developera/adminа), ali i dalje na brandu tako da stranica
    ne izgleda slomljeno prije nego što stigne pravi materijal. */
function VideoPlaceholder({ posterSrc }: { posterSrc?: string }) {
  return (
    <div
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      style={{
        background: posterSrc
          ? undefined
          : `radial-gradient(120% 140% at 15% 15%, ${NOVO_ORANGE}33, transparent 55%), radial-gradient(110% 130% at 85% 85%, ${NOVO_PURPLE}33, transparent 55%), ${NOVO_INK}`,
      }}
    >
      {posterSrc && (
        // eslint-disable-next-line @next/next/no-img-element -- poster iz baze (products.images), dinamički URL
        <img src={posterSrc} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
      )}
      <div className="relative z-10 flex flex-col items-center gap-3 text-center px-6">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/25 flex items-center justify-center">
          <PlayIcon className="w-6 h-6 text-white/80 translate-x-[1px]" />
        </div>
        <span
          className="text-[11px] tracking-[0.16em] uppercase text-white/55"
          style={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}
        >
          Video uskoro
        </span>
      </div>
    </div>
  );
}

export const HeroScrollVideoReveal: React.FC<HeroScrollVideoRevealProps> = ({
  topText,
  headingText,
  tags = DEFAULT_TAGS,
  subText,
  videoSrc,
  posterSrc,
  bottomText,
  className = "",
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const benefitRef = useRef<HTMLDivElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  const videoBoxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const paraRef = useRef<HTMLParagraphElement>(null);
  const tagRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (videoRef.current && videoSrc) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      // Korisnik je tražio manje animacija — pokaži sve odmah, bez scroll-
      // jacking pina/kinetičkog teksta.
      gsap.set(paraRef.current?.querySelectorAll(".reveal-word") ?? [], { opacity: 1, rotate: 0, yPercent: 0 });
      tagRefs.current.forEach((el) => el && gsap.set(el, { opacity: 1, clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)" }));
      gsap.set(videoBoxRef.current, { clipPath: "circle(150% at 50% 50%)" });
      return;
    }

    let split: SplitText | null = null;
    let words: Element[] = [];
    const ctx = gsap.context(() => {
      try {
        split = new SplitText(paraRef.current, {
          type: "words",
          wordsClass: "reveal-word inline-block origin-left mr-[0.25em] will-change-transform",
        });
        words = split.words;
      } catch {
        words = paraRef.current ? Array.from(paraRef.current.querySelectorAll(".reveal-word")) : [];
      }

      if (words.length > 0) {
        gsap.set(words, { opacity: 0, rotate: 8, yPercent: 30 });
      }

      const revealTl = gsap.timeline({
        scrollTrigger: {
          trigger: benefitRef.current,
          start: "top 70%",
          end: "top -10%",
          scrub: 1.5,
        },
      });

      if (words.length > 0) {
        revealTl.to(words, { stagger: 0.2, opacity: 1, rotate: 0, yPercent: 0, ease: "power1.inOut" });
      }

      tagRefs.current.forEach((tagEl) => {
        if (tagEl) {
          revealTl.to(
            tagEl,
            { duration: 1, opacity: 1, clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)", ease: "circ.out" },
            ">-0.4"
          );
        }
      });

      const mm = gsap.matchMedia();

      mm.add("(max-width: 639.9px)", () => {
        gsap.set(videoBoxRef.current, { clipPath: "circle(18% at 50% 50%)" });
        gsap.timeline({
          scrollTrigger: {
            trigger: videoWrapperRef.current,
            start: "top top",
            end: "+=1200",
            scrub: 1.2,
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,
          },
        }).fromTo(
          videoBoxRef.current,
          { clipPath: "circle(18% at 50% 50%)" },
          { clipPath: "circle(150% at 50% 50%)", ease: "none" }
        );
      });

      mm.add("(min-width: 640px) and (max-width: 1023.9px)", () => {
        gsap.set(videoBoxRef.current, { clipPath: "circle(12% at 50% 50%)" });
        gsap.timeline({
          scrollTrigger: {
            trigger: videoWrapperRef.current,
            start: "top top",
            end: "+=1700",
            scrub: 1.3,
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,
          },
        }).fromTo(
          videoBoxRef.current,
          { clipPath: "circle(12% at 50% 50%)" },
          { clipPath: "circle(150% at 50% 50%)", ease: "none" }
        );
      });

      mm.add("(min-width: 1024px)", () => {
        gsap.set(videoBoxRef.current, { clipPath: "circle(8% at 50% 50%)" });
        gsap.timeline({
          scrollTrigger: {
            trigger: videoWrapperRef.current,
            start: "top top",
            end: "+=2200",
            scrub: 1.5,
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,
          },
        }).fromTo(
          videoBoxRef.current,
          { clipPath: "circle(8% at 50% 50%)" },
          { clipPath: "circle(150% at 50% 50%)", ease: "none" }
        );
      });

      return () => mm.revert();
    }, rootRef);

    return () => {
      if (split) (split as SplitText).revert();
      ctx.revert();
    };
  }, [videoSrc]);

  return (
    <div
      ref={rootRef}
      className={`w-full text-white overflow-x-hidden ${className}`}
      style={{ backgroundColor: NOVO_INK, fontFamily: "var(--font-karla), sans-serif" }}
    >
      {topText && (
        <section
          className="w-full min-h-[60vh] sm:min-h-[70vh] flex items-center justify-center text-center px-4 sm:px-8 py-16"
          style={{ backgroundColor: NOVO_INK }}
        >
          <p
            className="text-[clamp(1.5rem,3.6vw,3rem)] font-semibold tracking-tight leading-tight text-white/90"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
          >
            {topText}
          </p>
        </section>
      )}

      <section ref={benefitRef} className="relative w-full min-h-[130vh] md:min-h-[150vh] pb-16 md:pb-20" style={{ backgroundColor: NOVO_INK }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 md:py-24 flex flex-col items-center text-center relative z-10">
          <div className="w-full mb-8 sm:mb-12 md:mb-14">
            <p
              ref={paraRef}
              className="text-[clamp(1.9rem,4.6vw,4.6rem)] font-bold tracking-tight leading-tight text-white overflow-visible"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              {headingText}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3.5 max-w-4xl mx-auto my-4 sm:my-6 mb-8 sm:mb-14">
            {tags.map((tag, idx) => (
              <div
                key={tag.id || `tag-${idx}`}
                ref={(el) => {
                  tagRefs.current[idx] = el;
                }}
                className="px-4 sm:px-6 py-2 sm:py-3 rounded-full text-[clamp(0.85rem,1.7vw,1.15rem)] font-semibold tracking-tight opacity-0 shadow-xl will-change-[clip-path,opacity]"
                style={{
                  backgroundColor: tag.background,
                  color: tag.color || "#ffffff",
                  clipPath: "polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)",
                  fontFamily: "var(--font-karla), sans-serif",
                }}
              >
                {tag.text}
              </div>
            ))}
          </div>

          {subText && (
            <p className="text-[clamp(0.95rem,1.4vw,1.2rem)] text-white/50 font-normal max-w-xl mt-2 sm:mt-4 px-4">
              {subText}
            </p>
          )}
        </div>

        <div className="relative w-full" style={{ backgroundColor: NOVO_INK }}>
          <div
            ref={videoWrapperRef}
            className="w-full h-screen flex justify-center items-center relative overflow-hidden"
            style={{ backgroundColor: NOVO_INK }}
          >
            <div className="absolute inset-0 w-full h-full pointer-events-none" style={{ backgroundColor: NOVO_INK, zIndex: 1 }} />

            <div
              ref={videoBoxRef}
              className="relative w-full h-full overflow-hidden flex justify-center items-center will-change-[clip-path]"
              style={{ backgroundColor: NOVO_INK, zIndex: 2 }}
            >
              {videoSrc ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  poster={posterSrc}
                  className="w-full h-full object-cover"
                  style={{ backgroundColor: NOVO_INK }}
                >
                  <source src={videoSrc} type="video/mp4" />
                </video>
              ) : (
                <VideoPlaceholder posterSrc={posterSrc} />
              )}
            </div>
          </div>
        </div>
      </section>

      {bottomText && (
        <section
          className="w-full min-h-[60vh] sm:min-h-[70vh] flex items-center justify-center text-center px-4 sm:px-8 py-16"
          style={{ backgroundColor: NOVO_INK }}
        >
          <p
            className="text-[clamp(1.5rem,3.6vw,3rem)] font-semibold tracking-tight leading-tight text-white/90"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
          >
            {bottomText}
          </p>
        </section>
      )}
    </div>
  );
};

export default HeroScrollVideoReveal;
