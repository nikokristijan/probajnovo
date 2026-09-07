"use client";

import { useState, useTransition } from "react";
import { updateOwnerThemeAction } from "@/lib/actions";

type Theme = "light" | "dark" | "system";

/**
 * Prekidač svijetle/tamne/sustavne teme za vlasnički dashboard. Početno
 * stanje (`initialTheme`) dolazi iz admin.themePreference (čisto čitanje,
 * postavljeno u app/admin/page.tsx na .owner-dash omotaču preko
 * data-theme atributa tijekom SSR-a) — isti razlog kao initialStreak u
 * OwnerHero.tsx: server-render mora biti deterministički čitanje, a
 * stvarna promjena se događa isključivo ovdje, u klik-handleru, nikad u
 * render putu Server Komponente. Klik odmah mijenja DOM atribut (trenutna
 * vizualna promjena) i usput sprema izbor preko servera akcije da se
 * pamti po adminu (ne po pregledniku/uređaju). */
export default function OwnerThemeToggle({ initialTheme }: { initialTheme: Theme }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [, startTransition] = useTransition();

  function choose(next: Theme) {
    setTheme(next);
    const root = document.querySelector<HTMLElement>(".owner-dash");
    if (root) root.setAttribute("data-theme", next);
    // SEDMI krug feedbacka ("navbar ostaje svijetao dok se ne odeš na drugu
    // stranicu") — .owner-dash gore je SAMO dashboard sadržaj unutar <main>;
    // header (i .admin-shell pozadina iza njega, vidi .owner-page-bg u
    // globals.css) je poseban, viši omotač postavljen u app/admin/layout.tsx
    // koji ovaj klik dosad uopće nije dirao, pa se stvarno mijenjao tek na
    // sljedećoj punoj server-render navigaciji (kad admin.themePreference iz
    // baze već bude spremljen). Postavljanjem data-theme i ovdje, header
    // reagira ISTOG trena, bez čekanja na navigaciju.
    const shellRoot = document.querySelector<HTMLElement>(".admin-shell");
    if (shellRoot) shellRoot.setAttribute("data-theme", next);
    startTransition(() => {
      updateOwnerThemeAction(next).catch(() => {
        // Best-effort — izbor ostaje primijenjen lokalno i za ovaj posjet
        // čak i ako spremanje na server ne uspije.
      });
    });
  }

  const options: { value: Theme; icon: string; label: string }[] = [
    { value: "light", icon: "☀️", label: "Svijetlo" },
    { value: "system", icon: "🖥️", label: "Sustav" },
    { value: "dark", icon: "🌙", label: "Tamno" },
  ];

  return (
    <div className="owner-theme-switch owner-glass" role="group" aria-label="Izbor teme">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => choose(o.value)}
          aria-pressed={theme === o.value}
          aria-label={o.label}
          title={o.label}
          className={theme === o.value ? "owner-theme-switch-active" : ""}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
