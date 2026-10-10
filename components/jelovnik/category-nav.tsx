"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Bi } from "./bilingual";

export type NavCategory = { id: string; name: string; nameEn: string | null };

/** Visina trake s kategorijama (px) + malo zraka: ispod te crte se sekcija računa kao "trenutna". Isto kao --jl-nav-h u CSS-u. */
const LINE_OFFSET = 61 + 16;

const sectionId = (id: string) => `jl-c-${id}`;

const stamp = () => Date.now();

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Ljepljiva, vodoravno pomična traka kategorija. Bez JavaScripta su to obične sidrene poveznice (#kategorija);
 * uz JavaScript klik glatko skrola (osim kod smanjenog kretanja), a traka prati što gost trenutno čita (scroll-spy)
 * i drži aktivnu kategoriju u vidu.
 */
export function CategoryNav({ categories }: { categories: NavCategory[] }) {
  const [active, setActive] = useState(categories[0]?.id ?? "");
  const listRef = useRef<HTMLUListElement>(null);
  // Nakon klika scroll-spy ne smije prepisati odabir dok traje skrolanje do cilja.
  const lockUntil = useRef(0);

  useEffect(() => {
    const els = categories.map((c) => document.getElementById(sectionId(c.id))).filter((e): e is HTMLElement => Boolean(e));
    if (els.length === 0) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (stamp() < lockUntil.current) return;
      let current = els[0];
      for (const el of els) {
        if (el.getBoundingClientRect().top <= LINE_OFFSET) current = el;
        else break;
      }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) current = els[els.length - 1];
      const id = current.id.slice("jl-c-".length);
      setActive((prev) => (prev === id ? prev : id));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [categories]);

  // Aktivna kategorija ostaje vidljiva u traci (pomiče se samo traka, nikad stranica).
  useEffect(() => {
    const list = listRef.current;
    const chip = list?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!list || !chip) return;
    const left = chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2;
    list.scrollTo({ left: Math.max(0, left), behavior: reducedMotion() ? "auto" : "smooth" });
  }, [active]);

  function onClick(e: MouseEvent<HTMLAnchorElement>, id: string) {
    const target = document.getElementById(sectionId(id));
    if (!target) return;
    e.preventDefault();
    setActive(id);
    lockUntil.current = stamp() + 700;
    target.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    try {
      window.history.replaceState(null, "", `#${sectionId(id)}`);
    } catch {
      /* ignore */
    }
  }

  return (
    <nav className="jl-nav" aria-label="Kategorije jelovnika">
      <div className="jl-nav-in">
        <ul ref={listRef} className="jl-chips">
          {categories.map((c) => (
            <li key={c.id}>
              <a
                href={`#${sectionId(c.id)}`}
                className="jl-chip"
                aria-current={active === c.id ? "true" : undefined}
                onClick={(e) => onClick(e, c.id)}
              >
                <Bi hr={c.name} en={c.nameEn} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
