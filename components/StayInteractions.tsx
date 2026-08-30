"use client";

import { useEffect, useRef } from "react";

/**
 * Sitne "designer portfolio" interakcije za stranicu vikendice:
 * — tanka traka napretka skrolanja na vrhu (živi osjećaj toka stranice)
 * — magnetski hover na CTA gumbima označenim s data-magnetic
 * Odvojeno od RevealSection jer ovo nije vezano za jedan element nego
 * za cijelu stranicu (scroll) i više elemenata odjednom (querySelectorAll).
 */
export default function StayInteractions() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onScroll() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const pct = scrollable > 0 ? (doc.scrollTop / scrollable) * 100 : 0;
      if (barRef.current) barRef.current.style.width = `${pct}%`;
    }
    onScroll();
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
