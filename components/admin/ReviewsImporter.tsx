"use client";

import { useState } from "react";
import type { Testimonial } from "@/lib/db/schema";

type Candidate = {
  author: string;
  text: string;
  rating: number;
  uncertainRating: boolean;
  include: boolean;
};

/* ------------------------------------------------------------------ */
/* Heuristički parser — bez API-ja, bez troška. Radi na osnovu toga da */
/* je "prije X mjeseci" / "X months ago" red najpouzdaniji signal kad  */
/* jedna recenzija završava, a druga počinje (Google zvjezdice se kod  */
/* copy-paste ponekad uopće ne prenesu jer su slika, ne tekst).        */
/* ------------------------------------------------------------------ */

const DATE_LINE_PATTERNS: RegExp[] = [
  /^prije\s+\d+\s+(sat\w*|minut\w*|dan\w*|tjed\w*|mjesec\w*|godin\w*)\.?$/i,
  /^prije\s+(godinu|mjesec|tjedan)\s+dana$/i,
  /^\d+\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i,
  /^an?\s+(second|minute|hour|day|week|month|year)\s+ago$/i,
];

function isDateLine(line: string): boolean {
  if (!line || line.length > 40) return false;
  return DATE_LINE_PATTERNS.some((re) => re.test(line));
}

const META_LINE = /(local\s*guide|recenzij|review|fotografij|photo)/i;
const STAR_LINE = /^[★⭐]{1,5}[☆]{0,4}$/;
const RATING_FRACTION = /^(\d(?:[.,]\d)?)\s*\/\s*5$/;
const RATED_OUT_OF = /rated\s+(\d(?:[.,]\d)?)\s+out of\s*5/i;
const TRAILING_UI = /^(like|share|helpful|more|new|odgovor vlasnika|response from the owner)$/i;

function ratingFromStars(s: string): number {
  const filled = (s.match(/[★⭐]/g) || []).length;
  return Math.min(5, Math.max(1, filled));
}

export function parseGoogleReviews(raw: string): Candidate[] {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""));

  const dateIdx: number[] = [];
  lines.forEach((l, i) => {
    if (isDateLine(l)) dateIdx.push(i);
  });

  // Prvi prolaz: za svaki datumski red nađi ocjenu i ime, zapamti od kojeg
  // retka počinje "zaglavlje" te recenzije (za odsijecanje teksta prošle/sljedeće).
  const headers = dateIdx.map((di) => {
    let rating = 5;
    let uncertainRating = true;
    let ratingLineIdx = -1;
    for (let j = di - 1, steps = 0; j >= 0 && steps < 3; j--, steps++) {
      const l = lines[j];
      if (!l) continue;
      if (STAR_LINE.test(l)) {
        rating = ratingFromStars(l);
        uncertainRating = false;
        ratingLineIdx = j;
        break;
      }
      const frac = l.match(RATING_FRACTION) || l.match(RATED_OUT_OF);
      if (frac) {
        rating = Math.round(parseFloat(frac[1].replace(",", ".")));
        uncertainRating = false;
        ratingLineIdx = j;
        break;
      }
      if (META_LINE.test(l)) continue;
      break;
    }

    let author = "";
    let authorLineIdx = -1;
    const startBack = ratingLineIdx !== -1 ? ratingLineIdx - 1 : di - 1;
    for (let j = startBack, steps = 0; j >= 0 && steps < 4; j--, steps++) {
      const l = lines[j];
      if (!l) continue;
      if (META_LINE.test(l)) continue;
      author = l;
      authorLineIdx = j;
      break;
    }

    const headerStart = authorLineIdx !== -1 ? authorLineIdx : ratingLineIdx !== -1 ? ratingLineIdx : di;
    return { di, author, rating, uncertainRating, headerStart };
  });

  const results: Candidate[] = [];
  headers.forEach((h, k) => {
    const textEnd = k + 1 < headers.length ? headers[k + 1].headerStart : lines.length;
    const textLines: string[] = [];
    for (let j = h.di + 1; j < textEnd; j++) {
      const l = lines[j];
      if (!l || TRAILING_UI.test(l)) continue;
      textLines.push(l);
    }
    const text = textLines.join(" ").trim();
    if (h.author && text) {
      results.push({
        author: h.author,
        text,
        rating: h.rating,
        uncertainRating: h.uncertainRating,
        include: true,
      });
    }
  });

  return results;
}

export default function ReviewsImporter({
  onImport,
}: {
  onImport: (parsed: Testimonial[]) => void;
}) {
  const [pasteText, setPasteText] = useState("");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);

  function recognize() {
    setCandidates(parseGoogleReviews(pasteText));
  }

  function updateCandidate(i: number, patch: Partial<Candidate>) {
    setCandidates((cur) => (cur ? cur.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) : cur));
  }

  function addSelected() {
    if (!candidates) return;
    const chosen = candidates
      .filter((c) => c.include)
      .map((c) => ({ author: c.author, text: c.text, rating: c.rating }));
    if (chosen.length === 0) return;
    onImport(chosen);
    setCandidates(null);
    setPasteText("");
  }

  return (
    <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-3 bg-black/[0.02]">
      <span className="text-sm font-semibold">Uvoz Google recenzija (opcionalno)</span>
      <span className="text-xs text-black/50">
        Zalijepi kopiran tekst recenzija s Google profila (Maps/Business). Sustav pokuša
        prepoznati ime, ocjenu i tekst svake recenzije — uvijek provjeri prije dodavanja, jer
        Google ponekad ne prenese zvjezdice u tekstualnom obliku pri kopiranju.
      </span>
      <textarea
        className="admin-input"
        rows={6}
        placeholder={"Zalijepi ovdje tekst kopiran s Google recenzija…"}
        value={pasteText}
        onChange={(e) => setPasteText(e.target.value)}
      />
      <button
        type="button"
        onClick={recognize}
        disabled={!pasteText.trim()}
        className="self-start rounded-full bg-black text-white text-xs font-semibold px-4 py-2 disabled:opacity-40"
      >
        Prepoznaj recenzije →
      </button>

      {candidates && candidates.length === 0 && (
        <p className="text-xs text-red-600">
          Nismo prepoznali nijednu recenziju u zalijepljenom tekstu — provjeri format ili ih dodaj
          ručno ispod.
        </p>
      )}

      {candidates && candidates.length > 0 && (
        <div className="flex flex-col gap-3 pt-1">
          {candidates.map((c, i) => (
            <div key={i} className="admin-repeat-row">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={c.include}
                  onChange={(e) => updateCandidate(i, { include: e.target.checked })}
                  className="mt-2.5"
                />
                <div className="grid grid-cols-[1fr_auto] gap-2 flex-1">
                  <input
                    className="admin-input"
                    placeholder="Ime gosta"
                    value={c.author}
                    onChange={(e) => updateCandidate(i, { author: e.target.value })}
                  />
                  <select
                    className="admin-input"
                    value={c.rating}
                    onChange={(e) =>
                      updateCandidate(i, { rating: Number(e.target.value), uncertainRating: false })
                    }
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {"★".repeat(n)}
                        {"☆".repeat(5 - n)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <textarea
                className="admin-input"
                rows={2}
                value={c.text}
                onChange={(e) => updateCandidate(i, { text: e.target.value })}
              />
              {c.uncertainRating && (
                <span className="text-xs text-orange-600">⚠ provjeri ocjenu — nismo je sigurno prepoznali</span>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addSelected}
            className="admin-repeat-add"
          >
            + Dodaj odabrane u recenzije
          </button>
          <span className="text-xs text-black/40">
            Postojeće ručno dodane recenzije ostaju netaknute — ovo samo dodaje nove.
          </span>
        </div>
      )}
    </div>
  );
}
