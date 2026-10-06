"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { checkDiscountCodeAction, createInquiryAction, type ActionState } from "@/lib/actions";
import { QTY_EVENT } from "@/components/novo/QtyQuickPick";
import { track } from "@/lib/track";
import type { QuantityDiscount } from "@/lib/db/schema";
import { discountFor, eur, lineTotal } from "@/lib/pricing";
import NfcPageOption, { nfcTargetLabel, useNfcTarget } from "@/components/novo/NfcPageOption";

export type InquiryAddon = { id: number; name: string; priceEur: number | null };

const APEX_HOST = process.env.NEXT_PUBLIC_APEX_HOST || "";
const PRIVACY_POLICY_URL = APEX_HOST ? `https://${APEX_HOST}/privatnost` : "/privatnost";
const ATTR_KEY = "novo-attribution";
const CODE_KEY = "novo-discount-code";

type AdWindow = Window & { dataLayer?: unknown[] };

/**
 * Odakle je posjetitelj došao (utm_* parametri oglasa, gclid/fbclid,
 * referrer). Pamti se PRVI dolazak u ovoj sesiji preglednika, pa i ako
 * gost s oglasa prvo pogleda druge stranice, upit i dalje nosi izvor
 * oglasa. Spaja se uz poruku upita (vidi createInquiryAction).
 */
function readAttribution(): string {
  try {
    const saved = sessionStorage.getItem(ATTR_KEY);
    if (saved) return saved;
  } catch {}
  const q = new URLSearchParams(window.location.search);
  const parts: string[] = [];
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const v = q.get(k);
    if (v) parts.push(`${k.replace("utm_", "")}=${v}`);
  }
  if (q.get("fbclid")) parts.push("fbclid");
  if (q.get("gclid")) parts.push("gclid");
  let ref = "";
  try {
    if (document.referrer && new URL(document.referrer).host !== window.location.host) {
      ref = new URL(document.referrer).host;
    }
  } catch {}
  if (ref) parts.push(`ref=${ref}`);
  const value = parts.length ? `${parts.join(" · ")} · ${window.location.pathname}` : "";
  try {
    if (value) sessionStorage.setItem(ATTR_KEY, value);
  } catch {}
  return value;
}

/**
 * Upit za proizvod u NOVO stilu: količina s okvirnim izračunom, naziv
 * objekta i poruka se slažu u jednu poruku za /admin/inquiries.
 */
export default function ProductInquiryNovo({
  productId,
  productName,
  priceEur,
  ctaLabel,
  discounts = [],
  addons = [],
  addonDiscountPercent = 0,
  nfcMonthlyEur = null,
}: {
  productId: number;
  productName: string;
  priceEur: number | null;
  ctaLabel?: string | null;
  discounts?: QuantityDiscount[];
  /** Proizvodi koje kupac može dodati u isti upit (paket). */
  addons?: InquiryAddon[];
  /** Popust na dodatke kad se uzmu uz ovaj proizvod. */
  addonDiscountPercent?: number;
  /** NFC pločica: mjesečno održavanje naše stranice — uz to kupac bira i "vlastitu stranicu". Null = bez izbora. */
  nfcMonthlyEur?: number | null;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createInquiryAction, undefined);
  const [qty, setQty] = useState(1);
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [attribution, setAttribution] = useState("");
  const [showMore, setShowMore] = useState(false);
  // Dodaci: id → količina (0 = nije odabran). Odabrani dodatak prati glavnu količinu dok ga kupac ne promijeni.
  const [addonQty, setAddonQty] = useState<Record<number, number>>({});
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ code: string; percent: number } | null>(null);
  const [checking, startCheck] = useTransition();
  const [pageUrl, setPageUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [nfcTarget] = useNfcTarget();

  const applyCode = (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    setCodeError(null);
    startCheck(async () => {
      const res = await checkDiscountCodeAction(code);
      if ("error" in res) {
        setApplied(null);
        setCodeError(res.error);
        setCodeOpen(true);
        return;
      }
      setApplied(res);
      setCodeInput(res.code);
      try {
        sessionStorage.setItem(CODE_KEY, res.code);
      } catch {}
    });
  };

  const pct = discountFor(qty, discounts);
  const mainTotal = priceEur != null ? lineTotal(priceEur, qty, pct) : null;
  const chosen = addons.filter((a) => (addonQty[a.id] ?? 0) > 0);
  const addonsTotal = chosen.reduce(
    (sum, a) => sum + (a.priceEur != null ? lineTotal(a.priceEur, addonQty[a.id], addonDiscountPercent) : 0),
    0
  );
  const subtotal = mainTotal != null ? Math.round((mainTotal + addonsTotal) * 100) / 100 : null;
  const total = subtotal != null && applied ? lineTotal(subtotal, 1, applied.percent) : subtotal;
  const fullPrice =
    priceEur != null
      ? qty * priceEur + chosen.reduce((sum, a) => sum + (a.priceEur ?? 0) * addonQty[a.id], 0)
      : null;
  const saved = total != null && fullPrice != null ? Math.round((fullPrice - total) * 100) / 100 : 0;

  // Količina odabrana gore uz cijenu (QtyQuickPick) dolazi ovamo.
  useEffect(() => {
    const onQty = (e: Event) => {
      const n = Number((e as CustomEvent<number>).detail);
      if (n > 0) setQty(Math.min(999, Math.round(n)));
      setTimeout(() => document.getElementById("pq-name")?.focus({ preventScroll: true }), 450);
    };
    window.addEventListener(QTY_EVENT, onQty);
    return () => window.removeEventListener(QTY_EVENT, onQty);
  }, []);

  useEffect(() => {
    // sessionStorage/URL postoje tek u pregledniku.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAttribution(readAttribution());
    setPageUrl(window.location.origin + window.location.pathname);
    // Kod iz linka (?kod=...) ili ranije primijenjen u ovoj sesiji.
    let initial = new URLSearchParams(window.location.search).get("kod") || "";
    if (!initial) {
      try {
        initial = sessionStorage.getItem(CODE_KEY) || "";
      } catch {}
    }
    if (initial) applyCode(initial);
  }, []);

  // Konverzija za oglase (Meta Pixel / Google, samo uz pristanak — vidi lib/track).
  useEffect(() => {
    if (!state?.success) return;
    track("Lead", {
      content_name: productName,
      num_items: qty,
      ...(total != null ? { value: total, currency: "EUR" } : {}),
    });
    (window as AdWindow).dataLayer?.push({ event: "product_inquiry", product: productName, quantity: qty });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success]);

  if (state?.success) {
    const refCode = state.referralCode;
    const shareLink = refCode && pageUrl ? `${pageUrl}?kod=${encodeURIComponent(refCode)}` : "";
    const shareText = refCode
      ? `Pozdrav! Za goste koristim ${productName} od NOVO-a. S mojim kodom ${refCode} dobivaš −${state.referralPercent} %: ${shareLink}`
      : "";
    return (
      <div className="pq-done" role="status">
        <span className="novo-os-kicker mono">UPIT JE POSLAN</span>
        <p>
          Hvala! Javljamo se{email ? ` na ${email}` : ""} unutar 24 sata s točnom cijenom za {qty} kom
          {chosen.length > 0 ? " i odabrane dodatke" : ""}. Potvrdu smo poslali i mailom.
        </p>
        {refCode && (
          <div className="pq-ref">
            <span className="pq-label mono">VAŠ KOD ZA PREPORUKU</span>
            <span className="pq-ref-code mono">{refCode}</span>
            <p>
              Pošaljite ga kolegi iznajmljivaču: dobiva −{state.referralPercent} % na narudžbu, a kad ga iskoristi, i vi
              dobivate −{state.referralPercent} % na sljedeću.
            </p>
            <div className="pq-ref-actions">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noreferrer"
                className="novo-os-cta mono"
              >
                POŠALJI NA WHATSAPP
              </a>
              <button
                type="button"
                className="mono link link-btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareLink || refCode);
                    setCopied(true);
                  } catch {}
                }}
              >
                {copied ? "KOPIRANO ✓" : "KOPIRAJ LINK"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const message = [
    `Proizvod: ${productName}`,
    `Količina: ${qty}${pct > 0 ? ` (količinski popust −${pct} %)` : ""}`,
    ...chosen.map(
      (a) => `Dodatno: ${a.name} × ${addonQty[a.id]}${addonDiscountPercent > 0 ? ` (paket −${addonDiscountPercent} %)` : ""}`
    ),
    nfcMonthlyEur != null ? `Stranica: ${nfcTargetLabel(nfcTarget, nfcMonthlyEur)}` : null,
    total != null ? `Okvirni iznos: ${eur(total)}${saved > 0 ? ` (ušteda ${eur(saved)})` : ""}` : null,
    place.trim() ? `Objekt: ${place.trim()}` : null,
    note.trim() ? `\n${note.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const clampQty = (n: number) => Math.min(999, Math.max(1, Math.round(n) || 1));

  return (
    <form action={formAction} className="pq-form">
      <input type="hidden" name="source" value="product" />
      <input type="hidden" name="sourceId" value={productId} />
      <input type="hidden" name="sourceName" value={productName} />
      <input type="hidden" name="message" value={message} />
      <input type="hidden" name="attribution" value={attribution} />
      <input type="hidden" name="discountCode" value={applied?.code ?? ""} />
      <input type="hidden" name="pageUrl" value={pageUrl} />

      <div className="stay-inquiry-hp" aria-hidden="true">
        <label>
          Ne popunjavaj ovo polje
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="pq-qty-row">
        <div className="pq-field">
          <span className="pq-label mono" id="pq-qty-label">
            KOLIČINA
          </span>
          <div className="pq-stepper" role="group" aria-labelledby="pq-qty-label">
            <button type="button" onClick={() => setQty((q) => clampQty(q - 1))} aria-label="Manje" disabled={qty <= 1}>
              −
            </button>
            <input
              id="pq-qty"
              type="number"
              inputMode="numeric"
              min={1}
              max={999}
              value={qty}
              onChange={(e) => setQty(clampQty(Number(e.target.value)))}
              aria-labelledby="pq-qty-label"
            />
            <button type="button" onClick={() => setQty((q) => clampQty(q + 1))} aria-label="Više">
              +
            </button>
          </div>
        </div>
        {priceEur != null && total != null && (
          <div className="pq-estimate" aria-live="polite">
            <span className="pq-label mono">OKVIRNO</span>
            <span className="pq-estimate-sum">{eur(total)}</span>
            <span className="pq-estimate-calc mono">
              {saved > 0 ? `UŠTEDA ${eur(saved)}` : `${qty} × ${priceEur} €`}
            </span>
            {nfcMonthlyEur != null && nfcTarget === "novo" && (
              <span className="pq-estimate-calc mono">+ {nfcMonthlyEur} €/MJ ODRŽAVANJE</span>
            )}
          </div>
        )}
      </div>
      {priceEur != null && pct === 0 && discounts[0] && (
        <p className="pq-tip mono">
          OD {discounts[0].minQty} KOM −{discounts[0].percent} % NA SVAKI KOMAD
        </p>
      )}

      {addons.length > 0 && (
        <fieldset className="pq-addons">
          <legend className="pq-label mono">
            DODAJTE UZ NARUDŽBU{addonDiscountPercent > 0 ? ` · −${addonDiscountPercent} % U PAKETU` : ""}
          </legend>
          {addons.map((a) => {
            const n = addonQty[a.id] ?? 0;
            const on = n > 0;
            return (
              <div key={a.id} className={on ? "pq-addon is-on" : "pq-addon"}>
                <label className="pq-addon-main">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => setAddonQty((m) => ({ ...m, [a.id]: e.target.checked ? qty : 0 }))}
                  />
                  <span className="pq-addon-name">{a.name}</span>
                  {a.priceEur != null && (
                    <span className="pq-addon-price mono">
                      {addonDiscountPercent > 0 && <s>{eur(a.priceEur)}</s>}{" "}
                      {eur(lineTotal(a.priceEur, 1, addonDiscountPercent))} / KOM
                    </span>
                  )}
                </label>
                {on && (
                  <div className="pq-stepper pq-stepper--sm" role="group" aria-label={`Količina: ${a.name}`}>
                    <button
                      type="button"
                      onClick={() => setAddonQty((m) => ({ ...m, [a.id]: Math.max(0, n - 1) }))}
                      aria-label="Manje"
                    >
                      −
                    </button>
                    <span className="pq-stepper-val mono">{n}</span>
                    <button
                      type="button"
                      onClick={() => setAddonQty((m) => ({ ...m, [a.id]: Math.min(999, n + 1) }))}
                      aria-label="Više"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </fieldset>
      )}

      {nfcMonthlyEur != null && <NfcPageOption monthlyEur={nfcMonthlyEur} idPrefix="pq" />}

      {priceEur != null &&
        (applied ? (
          <p className="pq-code-on mono">
            KOD {applied.code} · −{applied.percent} % PRIMIJENJEN
            <button
              type="button"
              className="link-btn"
              aria-label="Ukloni kod"
              onClick={() => {
                setApplied(null);
                setCodeInput("");
                try {
                  sessionStorage.removeItem(CODE_KEY);
                } catch {}
              }}
            >
              ✕
            </button>
          </p>
        ) : codeOpen ? (
          <div className="pq-code">
            <input
              id="pq-code"
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyCode(codeInput);
                }
              }}
              placeholder="KOD ZA POPUST"
              aria-label="Kod za popust"
              maxLength={32}
              autoComplete="off"
            />
            <button type="button" className="mono" onClick={() => applyCode(codeInput)} disabled={checking}>
              {checking ? "…" : "PRIMIJENI"}
            </button>
            {codeError && (
              <span className="pq-code-err" role="alert">
                {codeError}
              </span>
            )}
          </div>
        ) : (
          <button type="button" className="mono link link-btn pq-more" onClick={() => setCodeOpen(true)}>
            IMATE KOD ZA POPUST?
          </button>
        ))}

      {priceEur != null && (
        <p className="pq-hint">Točan iznos potvrđujemo u odgovoru, prije bilo kakvog plaćanja.</p>
      )}

      <div className="pq-grid">
        <label className="pq-field">
          <span className="pq-label mono">IME I PREZIME *</span>
          <input id="pq-name" type="text" name="name" required maxLength={200} autoComplete="name" />
        </label>
        <label className="pq-field">
          <span className="pq-label mono">EMAIL *</span>
          <input
            id="pq-email"
            type="email"
            name="email"
            required
            maxLength={200}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="pq-field">
          <span className="pq-label mono">TELEFON</span>
          <input id="pq-phone" type="tel" name="phone" maxLength={40} autoComplete="tel" />
        </label>
      </div>

      {showMore ? (
        <div className="pq-grid">
          <label className="pq-field">
            <span className="pq-label mono">NAZIV OBJEKTA</span>
            <input
              id="pq-place"
              type="text"
              maxLength={120}
              placeholder="npr. Apartman Lozica"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
            />
          </label>
        </div>
      ) : (
        <button type="button" className="mono link link-btn pq-more" onClick={() => setShowMore(true)}>
          + DODAJ NAZIV OBJEKTA ILI PORUKU (NIJE OBAVEZNO)
        </button>
      )}
      {showMore && (
        <label className="pq-field">
          <span className="pq-label mono">PORUKA</span>
          <textarea
            id="pq-note"
            rows={3}
            maxLength={3000}
            placeholder="Boja, natpis, rok… sve što nam pomaže pripremiti ponudu."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      )}

      <label className="pq-consent">
        <input id="pq-consent" type="checkbox" name="consent" required />
        <span>
          Slažem se s{" "}
          <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">
            politikom privatnosti
          </a>{" "}
          i obradom podataka radi odgovora na upit.
        </span>
      </label>

      {state?.error && (
        <p className="pq-error" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="novo-os-cta mono pq-submit" disabled={pending}>
        {pending ? "ŠALJEM…" : (ctaLabel?.trim() || "Pošalji upit").toUpperCase() + " →"}
      </button>
    </form>
  );
}
