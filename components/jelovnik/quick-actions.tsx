"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { contactIsPhoneOnly, type PublicContact, type PublicMenuActions } from "@/lib/recenzije/menu-buttons";
import { T, UI } from "./bilingual";

type PanelId = "wifi" | "contact";

/**
 * Neobavezne brze tipke ispod zaglavlja jelovnika: "Ocijeni nas" (obična poveznica na Google recenziju, ista svima), "Wi-Fi" i
 * "Kontakt" (ploča ispod reda tipki, bez prozora). Prikazuje se samo ono što je lokal ispunjen; ako nema ničega, komponenta se ne
 * crta uopće (stranica ostaje kakva je bila). Ploče su uvijek u HTML-u (aria-controls), a otvara ih samo jedna odjednom.
 * Bez JavaScripta ploče su otvorene ispod reda (noscript stil), pa se lozinka i kontakt i dalje vide. Tekst je dvojezičan
 * (Bi): prekidač HR / EN na stranici ga prevodi bez novog zahtjeva.
 */
export function QuickActions({ actions }: { actions: PublicMenuActions }) {
  const uid = useId();
  const [open, setOpen] = useState<PanelId | null>(null);
  const wifiBtn = useRef<HTMLButtonElement>(null);
  const contactBtn = useRef<HTMLButtonElement>(null);
  const { reviewUrl, wifi, contact } = actions;
  const phoneOnly = contactIsPhoneOnly(contact);
  const count = (reviewUrl ? 1 : 0) + (wifi ? 1 : 0) + (contact ? 1 : 0);
  if (count === 0) return null;

  const ids = { wifi: `${uid}-wifi`, contact: `${uid}-contact`, wifiBtn: `${uid}-wifi-b`, contactBtn: `${uid}-contact-b` };
  const toggle = (id: PanelId) => setOpen((cur) => (cur === id ? null : id));

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Escape" || !open) return;
    e.stopPropagation();
    const btn = open === "wifi" ? wifiBtn : contactBtn;
    setOpen(null);
    btn.current?.focus();
  }

  return (
    <div className="jl-qa" onKeyDown={onKeyDown} data-count={count}>
      {(wifi || (contact && !phoneOnly)) && (
        <noscript>
          {/* Bez JavaScripta tipke za ploče ne rade, pa su ploče otvorene, a te tipke skrivene. */}
          <style>{`.jl-qa-bar li:has(.jl-qa-btn[aria-controls]){display:none}.jl-qa-panel{grid-template-rows:1fr;visibility:visible;transition:none}.jl-qa-ph{display:block}.jl-qa-copy{display:none}`}</style>
        </noscript>
      )}
      <ul className="jl-qa-bar">
        {reviewUrl && (
          <li>
            <a className="jl-qa-btn" href={reviewUrl} target="_blank" rel="noopener noreferrer">
              <Icon name="star" />
              <span className="jl-qa-txt">
                <T t={UI.rate} />
              </span>
            </a>
          </li>
        )}
        {wifi && (
          <li>
            <button
              ref={wifiBtn}
              id={ids.wifiBtn}
              type="button"
              className="jl-qa-btn"
              aria-expanded={open === "wifi"}
              aria-controls={ids.wifi}
              onClick={() => toggle("wifi")}
            >
              <Icon name="wifi" />
              <span className="jl-qa-txt">Wi-Fi</span>
            </button>
          </li>
        )}
        {contact && (
          <li>
            {phoneOnly && contact.phone ? (
              <a className="jl-qa-btn" href={contact.phone.href}>
                <Icon name="phone" />
                <span className="jl-qa-txt">
                  <T t={UI.call} />
                </span>
              </a>
            ) : (
              <button
                ref={contactBtn}
                id={ids.contactBtn}
                type="button"
                className="jl-qa-btn"
                aria-expanded={open === "contact"}
                aria-controls={ids.contact}
                onClick={() => toggle("contact")}
              >
                <Icon name="mail" />
                <span className="jl-qa-txt">
                  <T t={UI.contact} />
                </span>
              </button>
            )}
          </li>
        )}
      </ul>

      {wifi && (
        <Panel id={ids.wifi} labelledBy={ids.wifiBtn} open={open === "wifi"}>
          <p className="jl-qa-ph">Wi-Fi</p>
          <CopyLine label={<T t={UI.network} />} value={wifi.name} />
          {wifi.password && <CopyLine label={<T t={UI.password} />} value={wifi.password} />}
        </Panel>
      )}
      {contact && !phoneOnly && (
        <Panel id={ids.contact} labelledBy={ids.contactBtn} open={open === "contact"}>
          <p className="jl-qa-ph">
            <T t={UI.contact} />
          </p>
          <ContactLinks contact={contact} />
        </Panel>
      )}
    </div>
  );
}

/** Fine ikone (crta 1,25 px, boja iz teksta), samo ukras: aria-hidden, a natpis uz njih nosi značenje. */
function Icon({ name }: { name: "star" | "wifi" | "phone" | "mail" }) {
  return (
    <svg
      className="jl-qa-ico"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {name === "star" && <path d="M12 3.2l2.6 5.8 6.3.6-4.7 4.2 1.4 6.2L12 16.7 6.4 20l1.4-6.2L3.1 9.6l6.3-.6z" />}
      {name === "wifi" && (
        <>
          <path d="M3 9.2a13.2 13.2 0 0 1 18 0" />
          <path d="M6 12.6a8.8 8.8 0 0 1 12 0" />
          <path d="M9.1 16a4.4 4.4 0 0 1 5.8 0" />
          <circle cx="12" cy="19.4" r="0.9" fill="currentColor" stroke="none" />
        </>
      )}
      {name === "phone" && (
        <>
          <rect x="7" y="3" width="10" height="18" rx="2" />
          <path d="M10.6 18.2h2.8" />
        </>
      )}
      {name === "mail" && (
        <>
          <rect x="3" y="5.5" width="18" height="13" rx="1" />
          <path d="M3.4 6.8 12 13l8.6-6.2" />
        </>
      )}
    </svg>
  );
}

/** Ploča ispod reda tipki. Zatvorena je neaktivna (inert + visibility), pa se ne fokusira ni čita; visina se glatko otvara (grid 0fr / 1fr). */
function Panel({ id, labelledBy, open, children }: { id: string; labelledBy: string; open: boolean; children: React.ReactNode }) {
  return (
    <div id={id} className="jl-qa-panel" role="region" aria-labelledby={labelledBy} data-open={open ? "true" : "false"} inert={!open}>
      <div className="jl-qa-clip">
        <div className="jl-qa-in">{children}</div>
      </div>
    </div>
  );
}

function ContactLinks({ contact }: { contact: PublicContact }) {
  return (
    <ul className="jl-qa-links">
      {contact.phone && (
        <li>
          <a className="jl-qa-link" href={contact.phone.href}>
            <span className="jl-qa-act">
              <T t={UI.call} />
            </span>
            <span className="jl-qa-sub">{contact.phone.display}</span>
          </a>
        </li>
      )}
      {contact.email && (
        <li>
          <a className="jl-qa-link" href={contact.email.href}>
            <span className="jl-qa-act">
              <T t={UI.email} />
            </span>
            <span className="jl-qa-sub">{contact.email.address}</span>
          </a>
        </li>
      )}
      {contact.map && (
        <li>
          <a className="jl-qa-link" href={contact.map.href} target="_blank" rel="noopener noreferrer">
            <span className="jl-qa-act">
              <T t={UI.map} />
            </span>
            <span className="jl-qa-sub">{contact.map.address}</span>
          </a>
        </li>
      )}
      {contact.instagram && (
        <li>
          <a className="jl-qa-link" href={contact.instagram.href} target="_blank" rel="noopener noreferrer">
            <span className="jl-qa-act">Instagram</span>
            <span className="jl-qa-sub">@{contact.instagram.handle}</span>
          </a>
        </li>
      )}
    </ul>
  );
}

type CopyState = "idle" | "copied" | "selected";

/** Kopiranje: Clipboard API, zatim stari execCommand; ako ni to ne uspije, tekst se označi pa ga gost kopira ručno. */
async function copyText(text: string, shown: RefObject<HTMLElement | null>, back: HTMLElement | null): Promise<CopyState> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return "copied";
    }
  } catch {
    /* odbijeno ili nedostupno: pokušaj dalje */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const done = document.execCommand("copy");
    ta.remove();
    back?.focus({ preventScroll: true });
    if (done) return "copied";
  } catch {
    /* ništa */
  }
  try {
    const el = shown.current;
    const sel = window.getSelection();
    if (el && sel) {
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
      return "selected";
    }
  } catch {
    /* ništa */
  }
  return "idle";
}

/** Redak "naziv: vrijednost" s gumbom Kopiraj. Vrijednost je običan tekst koji se jednim dodirom cijeli označi. */
function CopyLine({ label, value }: { label: React.ReactNode; value: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const shown = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  async function onCopy(e: React.MouseEvent<HTMLButtonElement>) {
    const btn = e.currentTarget;
    const result = await copyText(value, shown, btn);
    setState(result);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2200);
  }

  return (
    <div className="jl-qa-line">
      <div className="jl-qa-field">
        <span className="jl-qa-k">{label}</span>
        <span ref={shown} className="jl-qa-v">
          {value}
        </span>
      </div>
      <button type="button" className="jl-qa-copy" onClick={onCopy} data-state={state}>
        {state === "copied" ? <T t={UI.copied} /> : state === "selected" ? <T t={UI.selected} /> : <T t={UI.copy} />}
      </button>
      <span className="jl-sr" role="status" aria-live="polite">
        {state === "copied" ? <T t={UI.copied} /> : state === "selected" ? <T t={UI.selectedManual} /> : ""}
      </span>
    </div>
  );
}
