"use client";

import { useState } from "react";
import { cn } from "@/lib/recenzije/utils";
import { MenuEditor } from "./menu-editor";
import { MenuGuests } from "./menu-guests";
import { MenuImport } from "./menu-import";
import { MenuSettingsForm } from "./menu-settings-form";
import { MenuStatus } from "./menu-status";
import {
  MENU_TABS,
  type CategoryDTO,
  type GuestSummaryDTO,
  type GuestView,
  type MenuSettingsDTO,
  type MenuTab,
} from "./menu-types";

export type MenuWorkspaceProps = {
  readOnly: boolean;
  /** Apsolutna javna adresa jelovnika (bez ?stol). */
  publicUrl: string;
  host: string;
  settings: MenuSettingsDTO;
  categories: CategoryDTO[];
  hasReviewUrl: boolean;
  summary: GuestSummaryDTO;
  guests: GuestView[];
  guestsHasMore: boolean;
  initialTab: MenuTab;
};

/** Stranica jelovnika: stanje + adresa na vrhu, ispod kartice Stavke / Uvoz / Postavke / Gosti (sve ostaje montirano, pa tekst u uvozu ne nestaje pri prebacivanju). */
export function MenuWorkspace(p: MenuWorkspaceProps) {
  const [tab, setTab] = useState<MenuTab>(p.initialTab);
  const items = p.categories.reduce((n, c) => n + c.items.length, 0);

  function select(next: MenuTab) {
    setTab(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      window.history.replaceState(null, "", url);
    } catch {
      /* adresa se samo ne ažurira */
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const i = MENU_TABS.findIndex((t) => t.id === tab);
    const next = MENU_TABS[(i + dir + MENU_TABS.length) % MENU_TABS.length];
    select(next.id);
    requestAnimationFrame(() => document.getElementById(`menu-tab-${next.id}`)?.focus());
  }

  return (
    <div className="space-y-6">
      <MenuStatus
        publicUrl={p.publicUrl}
        enabled={p.settings.enabled}
        readOnly={p.readOnly}
        categories={p.categories.length}
        items={items}
        hasExternalUrl={Boolean(p.settings.externalUrl)}
        hasReviewUrl={p.hasReviewUrl}
        delayMinutes={p.settings.delayMinutes}
        summary={p.summary}
      />

      <div role="tablist" aria-label="Odjeljci jelovnika" className="grid grid-cols-4 border border-foreground">
        {MENU_TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              id={`menu-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`menu-panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => select(t.id)}
              onKeyDown={onKey}
              className={cn(
                "label min-h-11 cursor-pointer truncate px-1 transition-colors sm:px-3",
                on ? "bg-foreground text-white" : "bg-white text-foreground hover:bg-surface-2"
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div id="menu-panel-stavke" role="tabpanel" aria-labelledby="menu-tab-stavke" hidden={tab !== "stavke"}>
        <MenuEditor categories={p.categories} readOnly={p.readOnly} hasExternalUrl={Boolean(p.settings.externalUrl)} onGoImport={() => select("uvoz")} />
      </div>
      <div id="menu-panel-uvoz" role="tabpanel" aria-labelledby="menu-tab-uvoz" hidden={tab !== "uvoz"}>
        <MenuImport readOnly={p.readOnly} onSaved={() => select("stavke")} />
      </div>
      <div id="menu-panel-postavke" role="tabpanel" aria-labelledby="menu-tab-postavke" hidden={tab !== "postavke"}>
        <MenuSettingsForm settings={p.settings} host={p.host} readOnly={p.readOnly} />
      </div>
      <div id="menu-panel-gosti" role="tabpanel" aria-labelledby="menu-tab-gosti" hidden={tab !== "gosti"}>
        <MenuGuests summary={p.summary} rows={p.guests} hasMore={p.guestsHasMore} delayMinutes={p.settings.delayMinutes} />
      </div>
    </div>
  );
}
