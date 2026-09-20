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

  /* Kontrast oboda oko slova ovisi o PODLOZI, ne o odabranoj boji slova —
     tako tekst ostaje čitljiv na crnoj podlozi čak i kad korisnik izabere
     tamnu boju slova. Sam offset "duh" iza teksta uvijek je plav (NOVO
     --accent, jedna dosljedna spot-boja, kao print s pomaknutim registrom,
     a ne gradijent/sjaj) — namjerno ne narančast, jer je narančasta ujedno
     i zadana boja slova pa bi se duh izgubio čim se boje poklope. */
  const strokeColor = backdropId === "black" ? "#f4f4f1" : "#0a0a1a";
  const textStyle = useMemo(() => {
    return {
      fontFamily: `var(${selectedFont.cssVar})`,
      fontSize: `clamp(1.7rem, ${selectedSize.previewRem}rem + 1.4vw, ${selectedSize.previewRem * 1.7}rem)`,
    } as React.CSSProperties;
  }, [selectedFont, selectedSize]);
  const offsetPx = Math.max(4, Math.round(selectedSize.previewRem * 3));

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

            <span className="slova-render-stack">
              <span
                className="slova-render-offset"
                aria-hidden="true"
                style={{ ...textStyle, transform: `translate(${offsetPx}px, ${offsetPx}px)` }}
              >
                {displayText}
              </span>
              <span
                className="slova-render-main"
                style={{ ...textStyle, color: selectedColor.hex, WebkitTextStroke: `1px ${strokeColor}` }}
              >
                {displayText}
              </span>
            </span>

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
