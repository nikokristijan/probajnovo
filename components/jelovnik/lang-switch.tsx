"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Lang } from "./lang";
import { readSavedLang, saveLang, subscribeLang } from "./lang-store";

/**
 * Prekidač HR / EN. Jezik se mijenja atributom data-lang na najbližem .jl-menu (CSS skriva drugi jezik), pa nema
 * novog zahtjeva ni treperenja. Spremljeni izbor gosta (localStorage) ima prednost pred zadanim jezikom prvog prikaza.
 */
export function LangSwitch({ initial }: { initial: Lang }) {
  const saved = useSyncExternalStore(subscribeLang, readSavedLang, () => null);
  const lang: Lang = saved ?? initial;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.closest(".jl-menu")?.setAttribute("data-lang", lang);
  }, [lang]);

  return (
    <div ref={ref} className="jl-lang" role="group" aria-label="Jezik / Language">
      {(["hr", "en"] as const).map((l) => (
        <button key={l} type="button" className="jl-lang-btn" aria-pressed={lang === l} lang={l} onClick={() => saveLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
