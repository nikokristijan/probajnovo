"use client";

import { useEffect } from "react";

/**
 * Nježno otkrivanje pri skrolanju: naslovi kategorija i stavke koji su ispod ruba ekrana blago se pojave (opacity + pomak
 * od nekoliko piksela) kad uđu u vidno polje, jedan za drugim. Sve što je već u vidnom polju pri učitavanju ostaje kakvo
 * jest (nema treperenja), a bez JavaScripta, bez IntersectionObservera i pri smanjenom kretanju ništa se ne sakriva.
 * Stanje je u atributu data-rv na elementima (0 = čeka, 1 = prikazan), pa React ne dira te elemente. Stilovi: jelovnik.css.
 */
export function Reveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.querySelector(".jl-menu");
    if (!root) return;
    const fold = window.innerHeight;
    const targets = Array.from(root.querySelectorAll<HTMLElement>(".jl-sec-h, .jl-item")).filter(
      (el) => el.getBoundingClientRect().top > fold - 24,
    );
    if (targets.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        // Elementi koji uđu zajedno (npr. nekoliko stavki odjednom) kreću s malim razmakom, odozgo prema dolje.
        const entering = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        entering.forEach((e, i) => {
          const el = e.target as HTMLElement;
          el.style.setProperty("--jl-rv-d", `${Math.min(i, 5) * 70}ms`);
          el.setAttribute("data-rv", "1");
          io.unobserve(el);
          // Nakon završetka prijelaza kašnjenje se uklanja (da kasnije promjene, npr. jezika, ne kasne).
          window.setTimeout(() => el.style.removeProperty("--jl-rv-d"), 1600);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );
    for (const el of targets) {
      el.setAttribute("data-rv", "0");
      io.observe(el);
    }
    return () => {
      io.disconnect();
      // Ako se komponenta ukloni dok nešto čeka, ništa ne smije ostati sakriveno.
      for (const el of targets) el.removeAttribute("data-rv");
    };
  }, []);
  return null;
}
