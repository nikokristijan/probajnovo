"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Lang } from "./lang";
import { readSavedLang, saveLang, subscribeLang } from "./lang-store";

const LABELS: Record<Lang, string> = { hr: "Hrvatski", en: "English", de: "Deutsch", it: "Italiano" };

/**
 * Prekidač jezika (HR i svaki prijevod koji jelovnik ima: EN, DE, IT). Jezik se mijenja atributom data-lang na najbližem .jl-menu
 * (CSS skriva ostale jezike), pa nema novog zahtjeva ni treperenja. Spremljeni izbor gosta (localStorage) ima prednost pred zadanim
 * jezikom prvog prikaza (kolačić, pa jezik preglednika, pa hrvatski), ali samo ako jelovnik taj jezik ima.
 */
export function LangSwitch({ initial, languages }: { initial: Lang; languages: readonly Lang[] }) {
  const saved = useSyncExternalStore(subscribeLang, readSavedLang, () => null);
  const lang: Lang = saved && languages.includes(saved) ? saved : initial;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.closest(".jl-menu")?.setAttribute("data-lang", lang);
  }, [lang]);

  return (
    <div ref={ref} className="jl-lang" role="group" aria-label="Jezik / Language / Sprache / Lingua">
      {languages.map((l) => (
        <button key={l} type="button" className="jl-lang-btn" aria-pressed={lang === l} lang={l} aria-label={LABELS[l]} title={LABELS[l]} onClick={() => saveLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
