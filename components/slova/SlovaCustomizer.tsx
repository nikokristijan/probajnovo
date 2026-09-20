"use client";

import { useMemo, useState, useActionState } from "react";
import "@/app/slova/slova.css";
import { createInquiryAction, type ActionState } from "@/lib/actions";
import {
  SLOVA_FONTS,
  SLOVA_SIZES,
  SLOVA_COLORS,
  SLOVA_ENVS,
  SLOVA_MIN_ORDER_EUR,
} from "@/lib/slovaFonts";

/** Zatamni hex boju za postotak `percent` (0..1) — koristi se za "sjenu"
    ekstruzije slova u pregledu, tako da slovo izgleda kao fizički objekt s
    debljinom umjesto ravne boje teksta. */
function shadeHex(hex: string, percent: number): string {
  const f = parseInt(hex.slice(1), 16);
  const t = percent < 0 ? 0 : 255;
  const p = percent < 0 ? percent * -1 : percent;
  const R = f >> 16;
  const G = (f >> 8) & 0x00ff;
  const B = f & 0x0000ff;
  return (
    "#" +
    (
      0x1000000 +
      (Math.round((t - R) * p) + R) * 0x10000 +
      (Math.round((t - G) * p) + G) * 0x100 +
      (Math.round((t - B) * p) + B)
    )
      .toString(16)
      .slice(1)
  );
}

/** Slaže niz text-shadow slojeva pomaknutih dijagonalno da tekst na ekranu
    djeluje "debelo"/reljefno, kao da ima stvarnu dubinu — isti trik kao
    ekstrudirana plastična/drvena slova u stvarnosti. */
function buildExtrusionShadow(hex: string, depth: number): string {
  const dark = shadeHex(hex, -0.45);
  const layers: string[] = ["0 0 1px rgba(0,0,0,0.25)"];
  for (let i = 1; i <= depth; i++) {
    layers.push(`${i}px ${i}px 0 ${dark}`);
  }
  return layers.join(", ");
}

function formatEUR(n: number): string {
  return `${n} €`;
}

export default function SlovaCustomizer() {
  const [text, setText] = useState("DOBRODOŠLI");
  const [fontId, setFontId] = useState("bebas");
  const [sizeId, setSizeId] = useState("m");
  const [colorId, setColorId] = useState("orange");
  const [envId, setEnvId] = useState("office");
  const [note, setNote] = useState("");

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createInquiryAction,
    undefined
  );

  const selectedFont = SLOVA_FONTS.find((f) => f.id === fontId) ?? SLOVA_FONTS[0]!;
  const selectedSize = SLOVA_SIZES.find((s) => s.id === sizeId) ?? SLOVA_SIZES[1]!;
  const selectedColor = SLOVA_COLORS.find((c) => c.id === colorId) ?? SLOVA_COLORS[0]!;

  const charCount = text.replace(/\s/g, "").length;
  const rawEstimate = charCount * selectedSize.pricePerLetter;
  const estimate = charCount > 0 ? Math.max(rawEstimate, SLOVA_MIN_ORDER_EUR) : 0;

  const letterStyle = useMemo(() => {
    const depth = Math.max(3, Math.round(selectedSize.previewRem * 1.8));
    return {
      fontFamily: `var(${selectedFont.cssVar})`,
      fontSize: `clamp(1.6rem, ${selectedSize.previewRem}rem + 1vw, ${selectedSize.previewRem * 1.6}rem)`,
      color: selectedColor.hex,
      textShadow: buildExtrusionShadow(selectedColor.hex, depth),
      filter: "drop-shadow(8px 14px 18px rgba(0,0,0,0.45)) drop-shadow(0 0 24px rgba(139,92,246,0.25))",
    } as React.CSSProperties;
  }, [selectedFont, selectedSize, selectedColor]);

  const displayText = text.trim().length > 0 ? text : "VAŠ TEKST";

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
    <>
      <section className="slova-hero">
        <div className="slova-hero-glow" aria-hidden="true" />
        <span className="slova-kicker">NOVO — PROSTORNA SLOVA PO MJERI</span>
        <h1>Vaš tekst, u prostoru, prije nego ga naručite.</h1>
        <p className="slova-hero-lede">
          Upišite tekst, odaberite font, veličinu i boju, pogledajte odmah kako izgledaju na zidu i
          pošaljite upit u dva klika.
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
            <label htmlFor="slova-text">Vaš tekst</label>
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
                  className={`slova-color-swatch${colorId === c.id ? " active" : ""}`}
                  style={{ background: c.hex }}
                  onClick={() => setColorId(c.id)}
                  aria-pressed={colorId === c.id}
                  title={c.label}
                >
                  <span className="slova-color-label">{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="slova-preview">
          <div className="slova-preview-tabs">
            {SLOVA_ENVS.map((e) => (
              <button
                type="button"
                key={e.id}
                className={`slova-env-tab${envId === e.id ? " active" : ""}`}
                onClick={() => setEnvId(e.id)}
                aria-pressed={envId === e.id}
              >
                {e.label}
              </button>
            ))}
          </div>
          <div className={`slova-wall slova-env-${envId}`}>
            <span className="slova-wall-text" style={letterStyle}>
              {displayText}
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

      <section className="slova-includes">
        <h2>Što dobijete</h2>
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

      <section className="slova-inquiry">
        <h2>Pošaljite upit</h2>
        {state?.success ? (
          <div className="slova-inquiry-done" role="status">
            Hvala! Upit je poslan, javljamo se uskoro s ponudom i rokom izrade.
          </div>
        ) : (
          <>
            <p>Javljamo se s konačnom ponudom i rokom izrade, obično isti ili sljedeći radni dan.</p>
            <form action={formAction} className="slova-inquiry-form">
              <input type="hidden" name="source" value="product" />
              <input type="hidden" name="sourceName" value="Prostorna slova (konfigurator)" />
              <input type="hidden" name="message" value={composedMessage} readOnly />

              <div className="slova-inquiry-hp" aria-hidden="true">
                <label>
                  Ne popunjavaj ovo polje
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>

              <div className="slova-inquiry-row">
                <label className="slova-inquiry-field">
                  <span>Ime i prezime</span>
                  <input type="text" name="name" required maxLength={200} autoComplete="name" />
                </label>
                <label className="slova-inquiry-field">
                  <span>Email</span>
                  <input type="email" name="email" required maxLength={200} autoComplete="email" />
                </label>
              </div>

              <label className="slova-inquiry-field">
                <span>Telefon (opcionalno)</span>
                <input type="tel" name="phone" maxLength={40} autoComplete="tel" />
              </label>

              <label className="slova-inquiry-field">
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

              {state?.error && <p className="slova-inquiry-error">{state.error}</p>}

              <button type="submit" className="slova-inquiry-submit" disabled={pending}>
                {pending ? "Šalje se…" : "Pošalji upit"}
              </button>
            </form>
          </>
        )}
      </section>

      <footer className="slova-footer">
        <span>NOVO studio</span>
        <a href="mailto:hello@probajnovo.com">hello@probajnovo.com</a>
      </footer>
    </>
  );
}
