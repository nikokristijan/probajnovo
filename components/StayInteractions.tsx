"use client";

import { useEffect, useRef } from "react";

/**
 * Sitne "designer portfolio" interakcije za stranicu vikendice:
 * — tanka traka napretka skrolanja na vrhu (živi osjećaj toka stranice)
 * — magnetski hover na CTA gumbima označenim s data-magnetic
 * — blagi parallax na banner/hero slici označenoj s data-parallax
 * Odvojeno od RevealSection jer ovo nije vezano za jedan element nego
 * za cijelu stranicu (scroll) i više elemenata odjednom (querySelectorAll).
 */
export default function StayInteractions() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parallaxEls = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    function update() {
            const doc = document.documentElement;
            const scrollable = doc.scrollHeight - doc.clientHeight;
            const pct = scrollable > 0 ? (doc.scrollTop / scrollable) * 100 : 0;
            if (barRef.current) barRef.current.style.width = `${pct}%`;

            if (!reduceMotion) {
                      parallaxEls.forEach((el) => {
                                  const r = el.parentElement?.getBoundingClientRect();
                                  if (!r) return;
                                  const shift = Math.max(-90, Math.min(90, r.top * 0.22));
                                  const scale = 1.12 + Math.min(0.1, Math.abs(shift) * 0.0009);
                                  el.style.transform = `translateY(${shift}px) scale(${scale})`;
                      });
            }
    }
        let ticking = false;
        function onScroll() {
                if (ticking) return;
                ticking = true;
                requestAnimationFrame(() => {
                          update();
                          ticking = false;
                });
        }
        update();
        window.addEventListener("scroll", onScroll, { passive: true });

    const magnets = Array.from(document.querySelectorAll<HTMLElement>("[data-magnetic]"));
    const cleanups: Array<() => void> = [];
    magnets.forEach((el) => {
      function onMove(e: MouseEvent) {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * 0.22}px, ${dy * 0.28}px)`;
      }
      function onLeave() {
        el.style.transform = "translate(0, 0)";
      }
      el.addEventListener("mousemove", onMove);
      el.addEventListener("mouseleave", onLeave);
      cleanups.push(() => {
        el.removeEventListener("mousemove", onMove);
        el.removeEventListener("mouseleave", onLeave);
      });
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return (
    <div className="stay-progress-track" aria-hidden="true">
      <div className="stay-progress-bar" ref={barRef} />
    </div>
  );
}
