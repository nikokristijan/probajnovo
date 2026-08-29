"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Omata sekciju i dodaje "reveal-visible" klasu čim uđe u viewport
 * (IntersectionObserver). Koristi se na /[slug] stranicama vikendica da ne
 * izgleda kao statični članak nego kao stranica koja živi dok se skrola.
 */
export default function RevealSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={`${className} reveal${visible ? " reveal-visible" : ""}`}>
      {children}
    </div>
  );
}
