"use client";

import { useMemo, useState, useActionState } from "react";
import "@/app/slova/slova.css";
import { createInquiryAction, type ActionState } from "@/lib/actions";
import {
  SLOVA_FONTS,
  SLOVA_SIZES,
  SLOVA_COLORS,
  SLOVA_BACKDROPS,
  SLOVA_MIN_ORDER_EUR,
} from "@/lib/slovaFonts";

function formatEUR(n: number): string {
  return `${n} €`;
}

/** Posvijetli (percent > 0) ili potamni (percent < 0) hex boju za ~percent%. */
function shadeHex(hex: string, percent: number): string {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Linearna interpolacija između dvije hex boje, t u [0, 1]. */
function mixHex(hexA: string, hexB: string, t: number): string {
  const a = parseInt(hexA.replace("#", ""), 16);
  const b = parseInt(hexB.replace("#", ""), 16);
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

/** Percipirana svjetlina hex boje, 0 (crna) – 1 (bijela). */
function hexLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Približna svjetlina svake podloge iz SLOVA_BACKDROPS, za odluku treba li
 * slovima kontrastni rub (bez toga bi npr. bijela slova na bijeloj podlozi
 * bila nečitljiva). */
const BACKDROP_LUMINANCE: Record<string, number> = {
  white: 0.95,
  black: 0.05,
  concrete: 0.78,
  raster: 0.95,
};

/* Sjaj na gornjem rubu slova (kao odsjaj na plastici/metalu) — isti za sve
 * boje, dovoljno suptilan da radi i na svijetlim i na tamnim slovima preko
 * mix-blend-mode: overlay. */
const GLOSS_GRADIENT =
  "linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.22) 32%, rgba(255,255,255,0) 55%)";
/* Dijagonalna metalna zraka za "Zlatna" — kao odsjaj na poliranom metalu. */
const GOLD_SHINE_GRADIENT =
  "linear-gradient(115deg, rgba(255,255,255,0) 32%, rgba(255,255,255,0.9) 47%, rgba(255,255,255,0) 62%)";
/* Fine dijagonalne linije za "Drvo efekt". */
const WOOD_GRAIN_GRADIENT =
  "repeating-linear-gradient(94deg, rgba(35,18,5,0.4) 0px, rgba(35,18,5,0.4) 1px, transparent 1px, transparent 5px)";

export default function SlovaCustomizer() {
  const [text, setText] = useState("DOBRODOŠLI");
  const [fontId, setFontId] = useState("bebas");
  const [sizeId, setSizeId] = useState("m");
  const [colorId, setColorId] = useState("orange");
  const [backdropId, setBackdropId] = useState("white");
  const [note, setNote] = useState("");

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createInquiryAction,
    undefined
  );

  const selectedFont = SLOVA_FONTS.find((f) => f.id === fontId) ?? SLOVA_FONTS[0]!;
  const selectedSize = SLOVA_SIZES.find((s) => s.id === sizeId) ?? SLOVA_SIZES[1]!;
  const selectedColor = SLOVA_COLORS.find((c) => c.id === colorId) ?? SLOVA_COLORS[0]!;
  const selectedBackdrop = SLOVA_BACKDROPS.find((b) => b.id === backdropId) ?? SLOVA_BACKDROPS[0]!;
  const backdropIndex = SLOVA_BACKDROPS.findIndex((b) => b.id === backdropId);

  const charCount = text.replace(/\s/g, "").length;
  const rawEstimate = charCount * selectedSize.pricePerLetter;
  const estimate = charCount > 0 ? Math.max(rawEstimate, SLOVA_MIN_ORDER_EUR) : 0;

  const displayText = text.trim().length > 0 ? text : "VAŠ TEKST";

  const textStyle = useMemo(() => {
    return {
      fontFamily: `var(${selectedFont.cssVar})`,
      fontSize: `clamp(1.7rem, ${selectedSize.previewRem}rem + 1.4vw, ${selectedSize.previewRem * 1.7}rem)`,
    } as React.CSSProperties;
  }, [selectedFont, selectedSize]);

  /* Broj "koraka" bočne ekstruzije slova — veća slova, deblja (vidljivija)
     dubina, ali s gornjom i donjom granicom da ostane čitljivo. */
  const extrusionSteps = useMemo(() => {
    const raw = Math.round(selectedSize.previewRem * 3);
    return Math.max(6, Math.min(16, raw));
  }, [selectedSize]);

  /* Ako su boja slova i podloga slične svjetline (npr. bijela slova na
     bijeloj podlozi), dodaje se tanki kontrastni rub oko slova — inače bi
     se slovo vizualno "izgubilo" i ostala bi vidljiva samo sjena. */
  const needsRim = useMemo(() => {
    const letterLum = hexLuminance(selectedColor.hex);
    const backdropLum = BACKDROP_LUMINANCE[backdropId] ?? 0.9;
    return Math.abs(letterLum - backdropLum) < 0.22;
  }, [selectedColor, backdropId]);
  const rimColor = (BACKDROP_LUMINANCE[backdropId] ?? 0.9) > 0.5 ? "#0a0a1a" : "#f4f4f1";

  /* Prava ekstruzija (bočna dubina) umjesto plošnog grafičkog efekta: svaki
     piksel pomaka je jedan "korak" u tamnijoj nijansi boje slova (svjetlije
     bliže prednjoj plohi, tamnije dalje — kao da bočna stjenka slova prima
     manje svjetla), plus mekana raspršena sjena na kraju za kontakt s
     podlogom. Računa se ovdje (ne u CSS-u) jer ovisi o odabranoj boji i
     veličini. */
  const extrusionShadow = useMemo(() => {
    const depthNear = shadeHex(selectedColor.hex, -18);
    const depthFar = shadeHex(selectedColor.hex, -58);
    const rimLayers = needsRim
      ? [
          `-1px 0 0 ${rimColor}`,
          `1px 0 0 ${rimColor}`,
          `0 -1px 0 ${rimColor}`,
          `0 1px 0 ${rimColor}`,
          `-1px -1px 0 ${rimColor}`,
          `1px -1px 0 ${rimColor}`,
          `-1px 1px 0 ${rimColor}`,
          `1px 1px 0 ${rimColor}`,
        ]
      : [];
    const depthLayers = Array.from({ length: extrusionSteps }, (_, idx) => {
      const t = extrusionSteps > 1 ? idx / (extrusionSteps - 1) : 0;
      const stepColor = mixHex(depthNear, depthFar, t);
      return `${idx + 1}px ${idx + 1}px 0 ${stepColor}`;
    });
    const ambient = `${extrusionSteps + 5}px ${extrusionSteps + 8}px ${Math.round(
      extrusionSteps * 1.6
    )}px rgba(10, 10, 26, 0.4)`;
    return [...rimLayers, ...depthLayers, ambient].join(", ");
  }, [selectedColor, needsRim, rimColor, extrusionSteps]);

  const composedMessage = useMemo(() => {
    const lines = [
      "Upit iz konfiguratora prostornih slova (/slova).",
      "",
      `Tekst: "${text.trim() || "(nije upisan)"}"`,
      `Font: ${selectedFont.label}`,
      `Veličina: ${selectedSize.label} (${selectedSize.range})`,
      `Boja: ${selectedColor.label}`,
      `Okvirna cijena: ${charCount > 0 ? formatEUR(estimate) : "—"} (${charCount} slova × ${selectedSize.pricePerLetter} €, minimalna narudžba ${formatEUR(SLOVA_MIN_ORDER_EUR)})`,
    ];
    if (note.trim()) {
      lines.push("", "Dodatna napomena:", note.trim());
    }
    return lines.join("\n");
  }, [text, selectedFont, selectedSize, selectedColor, charCount, estimate, note]);

  return (
    <div className="novo-product-wrap">
      <section className="slova-hero">
        <div className="slova-kicker">NOVO — PROSTORNA SLOVA PO MJERI</div>
        <h1>Vaš tekst, u prostoru, prije nego ga naručite.</h1>
        <p className="slova-hero-lede">
          Upišite tekst, odaberite font, veličinu i boju, pogledajte odmah kako izgledaju i pošaljite
          upit u dva klika.
        </p>
        <div className="slova-hero-chips">
          <span>Font po izboru</span>
          <span>Boja po izboru</span>
          <span>Cijena pada s brojem slova</span>
        </div>
      </section>

      <section className="slova-builder">
        <div className="slova-controls">
          <div className="slova-field">
            <label htmlFor="slova-text" className="slova-field-label">
              Vaš tekst
            </label>
            <input
              id="slova-text"
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value.toUpperCase().slice(0, 24))}
              placeholder="npr. DOBRODOŠLI"
              autoComplete="off"
            />
            <span className="slova-hint">{charCount} slova · razmaci se ne broje u cijenu</span>
          </div>

          <div className="slova-field">
            <span className="slova-field-label">Font</span>
            <div className="slova-font-grid">
              {SLOVA_FONTS.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  className={`slova-font-btn${fontId === f.id ? " active" : ""}`}
                  onClick={() => setFontId(f.id)}
                  aria-pressed={fontId === f.id}
                >
                  <span className="slova-font-sample" style={{ fontFamily: `var(${f.cssVar})` }}>
                    Aa
                  </span>
                  <span className="slova-font-name">{f.label}</span>
                  <span className="slova-font-vibe">{f.vibe}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="slova-field">
            <span className="slova-field-label">Veličina</span>
            <div className="slova-size-grid">
              {SLOVA_SIZES.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={`slova-size-btn${sizeId === s.id ? " active" : ""}`}
                  onClick={() => setSizeId(s.id)}
                  aria-pressed={sizeId === s.id}
                >
                  <span className="slova-size-name">{s.label}</span>
                  <span className="slova-size-range">{s.range}</span>
                  <span className="slova-size-price">od {s.pricePerLetter} €/slovo</span>
                </button>
              ))}
            </div>
          </div>

          <div className="slova-field">
            <span className="slova-field-label">Boja</span>
            <div className="slova-color-row">
              {SLOVA_COLORS.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={`slova-color-item${colorId === c.id ? " active" : ""}`}
                  onClick={() => setColorId(c.id)}
                  aria-pressed={colorId === c.id}
                >
                  <span className="slova-color-swatch" style={{ background: c.hex }} />
                  <span className="slova-color-item-label">{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="slova-preview">
          <div className="slova-backdrop-row">
            {SLOVA_BACKDROPS.map((b) => (
              <button
                type="button"
                key={b.id}
                className={`slova-backdrop-tab${backdropId === b.id ? " active" : ""}`}
                onClick={() => setBackdropId(b.id)}
                aria-pressed={backdropId === b.id}
              >
                <span className={`slova-backdrop-dot${b.id === "raster" ? " slova-backdrop-dot--raster" : ""}`} style={b.id === "raster" ? undefined : { background: b.swatch }} />
                {b.label}
              </button>
            ))}
          </div>

          <div className={`slova-render slova-render--${backdropId}`}>
            <span className="slova-reg-mark slova-reg-mark--tl">+</span>
            <span className="slova-reg-mark slova-reg-mark--tr">+</span>
            <span className="slova-reg-mark slova-reg-mark--bl">+</span>
            <span className="slova-reg-mark slova-reg-mark--br">+</span>

            <div className="slova-render-stage">
              <span className="slova-render-ground" aria-hidden="true" />
              <span
                className="slova-render-main"
                style={{ ...textStyle, color: selectedColor.hex, textShadow: extrusionShadow }}
              >
                {displayText}
              </span>
              <span
                className="slova-render-gloss"
                aria-hidden="true"
                style={{ ...textStyle, backgroundImage: GLOSS_GRADIENT }}
              >
                {displayText}
              </span>
              {colorId === "gold" && (
                <span
                  className="slova-render-shine"
                  aria-hidden="true"
                  style={{ ...textStyle, backgroundImage: GOLD_SHINE_GRADIENT }}
                >
                  {displayText}
                </span>
              )}
              {colorId === "wood" && (
                <span
                  className="slova-render-grain"
                  aria-hidden="true"
                  style={{ ...textStyle, backgroundImage: WOOD_GRAIN_GRADIENT }}
                >
                  {displayText}
                </span>
              )}
            </div>

            <span className="slova-render-caption">
              {String(backdropIndex + 1).padStart(2, "0")} / {selectedBackdrop.label.toUpperCase()}
            </span>
          </div>

          <div className="slova-price-readout">
            <span className="slova-price-label">Okvirna cijena</span>
            <span className="slova-price-value">{charCount > 0 ? formatEUR(estimate) : "—"}</span>
            <span className="slova-price-note">
              {charCount} slova × {selectedSize.pricePerLetter} €, minimalna narudžba{" "}
              {formatEUR(SLOVA_MIN_ORDER_EUR)}. Konačna ponuda nakon upita.
            </span>
          </div>
        </div>
      </section>

      <section className="slova-includes-section">
        <div className="slova-kicker">ŠTO DOBIJETE</div>
        <div className="slova-includes-grid">
          <div className="slova-include-card">
            <span className="slova-include-title">Slova po mjeri</span>
            <p>Svako slovo izrađeno posebno, u fontu, veličini i boji koju ste odabrali, ne univerzalni kalup.</p>
          </div>
          <div className="slova-include-card">
            <span className="slova-include-title">Čvrst, lagan materijal</span>
            <p>Matirana površina, otporna na svakodnevno rukovanje i unutarnje uvjete, jednostavna za čišćenje.</p>
          </div>
          <div className="slova-include-card">
            <span className="slova-include-title">Spremno za montažu</span>
            <p>Dolazi pripremljeno za lijepljenje ili vijčanje na zid, izlog ili pult, bez dodatne obrade s vaše strane.</p>
          </div>
          <div className="slova-include-card">
            <span className="slova-include-title">Dogovor oko dizajna</span>
            <p>Želite drugačiji font, boju ili raspored slova od ponuđenog? Javite nam u upitu, radimo i po skici.</p>
          </div>
        </div>
      </section>

      <section className="novo-product-inquiry">
        <h2>Pošaljite upit</h2>
        {state?.success ? (
          <div className="stay-inquiry-done" role="status">
            Hvala! Upit je poslan, javljamo se uskoro s ponudom i rokom izrade.
          </div>
        ) : (
          <>
            <p>Javljamo se s konačnom ponudom i rokom izrade, obično isti ili sljedeći radni dan.</p>
            <form action={formAction} className="stay-inquiry-form">
              <input type="hidden" name="source" value="product" />
              <input type="hidden" name="sourceName" value="Prostorna slova (konfigurator)" />
              <input type="hidden" name="message" value={composedMessage} readOnly />

              <div className="stay-inquiry-hp" aria-hidden="true">
                <label>
                  Ne popunjavaj ovo polje
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>

              <div className="stay-inquiry-row">
                <label className="stay-inquiry-field">
                  <span>Ime i prezime</span>
                  <input type="text" name="name" required maxLength={200} autoComplete="name" />
                </label>
                <label className="stay-inquiry-field">
                  <span>Email</span>
                  <input type="email" name="email" required maxLength={200} autoComplete="email" />
                </label>
              </div>

              <label className="stay-inquiry-field">
                <span>Telefon (opcionalno)</span>
                <input type="tel" name="phone" maxLength={40} autoComplete="tel" />
              </label>

              <label className="stay-inquiry-field">
                <span>Dodatna napomena (opcionalno)</span>
                <textarea
                  rows={3}
                  maxLength={800}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Npr. željeni rok, mjesto montaže, poseban raspored slova…"
                />
              </label>

              <div className="slova-inquiry-summary">
                Šaljete: &ldquo;{text.trim() || "—"}&rdquo; · {selectedFont.label} · {selectedSize.label} ·{" "}
                {selectedColor.label}
              </div>

              {state?.error && <p className="stay-inquiry-error">{state.error}</p>}

              <button type="submit" className="stay-inquiry-submit" disabled={pending}>
                {pending ? "Šalje se…" : "Pošalji upit"}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
