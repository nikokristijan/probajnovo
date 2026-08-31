"use client";

import { useState } from "react";

const MONTH_NAMES: Record<"hr" | "en", string[]> = {
  hr: ["Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj", "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const WEEKDAY_LABELS: Record<"hr" | "en", string[]> = {
  hr: ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};
/** Prvi redak poruke koji ova komponenta sama upiše (vidi applySelection) —
    koristi se da prepozna i zamijeni SVOJ prijašnji redak umjesto da ih gomila
    ako gost promijeni odabir više puta, a ostatak poruke koju je gost sam
    upisao ostaje netaknut. */
const MARKER: Record<"hr" | "en", string> = {
  hr: "Željeni termin:",
  en: "Desired dates:",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Ponedjeljkom počinje tjedan — JS getDay() vraća 0 za nedjelju, vidi isti
    obrazac u app/admin/kalendar/page.tsx (interna, uređivačka verzija). */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function formatDate(dateStr: string, lang: "hr" | "en"): string {
  const [y, m, d] = dateStr.split("-");
  return lang === "en" ? `${m}/${d}/${y}` : `${d}.${m}.${y}.`;
}

/**
 * Upiše/ažurira "Željeni termin: …" redak na VRHU poruke u obrascu za upit
 * (textarea name="message" u components/InquiryForm.tsx) izravno preko DOM-a
 * — namjerno bez Reacta/contexta jer su kalendar i obrazac odvojena stabla
 * (kalendar je u sekciji rezervacije pri vrhu, obrazac je sekcija 12 pri dnu
 * stranice), a textarea je nekontrolirana (nema value/onChange), pa izravno
 * postavljanje .value ne sudara se s Reactom. Ako gost već ima svoj tekst
 * ispod prijašnjeg "Željeni termin" retka, taj tekst ostaje — samo se prvi
 * redak zamijeni novim datumima.
 */
function applySelection(startStr: string, endStr: string, lang: "hr" | "en") {
  const line = `${MARKER[lang]} ${formatDate(startStr, lang)} – ${formatDate(endStr, lang)}`;
  const textarea = document.querySelector('textarea[name="message"]');
  if (!(textarea instanceof HTMLTextAreaElement)) return;

  const existingLines = textarea.value.split("\n");
  if (existingLines[0]?.startsWith(MARKER[lang])) {
    existingLines.shift();
    if (existingLines[0] === "") existingLines.shift();
  }
  const rest = existingLines.join("\n").trim();
  textarea.value = rest.length > 0 ? `${line}\n\n${rest}` : line;
  textarea.scrollIntoView({ behavior: "smooth", block: "center" });
  textarea.focus();
}

/** Interaktivan kalendar dostupnosti za gosta — zamjenjuje stari vanjski
    "Provjeri dostupnost" gumb (property.availabilityUrl). Prikazuje tekući i
    sljedeći mjesec; crveno/puno = zauzeto (ručno ili automatski iz
    Booking.com/Airbnb iCal-a, vidi lib/ical.ts), prazno = slobodno. Gost
    klikne datum dolaska pa datum odlaska — datumi se automatski upišu u
    poruku obrasca za upit ispod (vidi applySelection), gost i dalje šalje
    stvarni upit ručno. */
export default function AvailabilityCalendar({
  blockedDates,
  lang,
}: {
  blockedDates: { date: string }[];
  lang: "hr" | "en";
}) {
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);

  const blocked = new Set(blockedDates.map((b) => b.date));
  const now = new Date();
  // Datumska aritmetika ide isključivo preko Date objekata (ne ručnim
  // zbrajanjem godine/mjeseca) da prijelaz iz prosinca u siječanj sljedeće
  // godine ispadne točan i za prikazani naslov i za dateStr niže.
  const months = [0, 1].map((offset) => {
    const firstOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset, 1));
    const year = firstOfMonth.getUTCFullYear();
    const month0 = firstOfMonth.getUTCMonth(); // uvijek 0-11, već "normaliziran" prijelazom gore
    const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
    const leadingBlanks = mondayIndex(firstOfMonth);
    const cells: (number | null)[] = [
      ...Array.from({ length: leadingBlanks }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    return { year, month0, cells };
  });

  function handleDayClick(dateStr: string) {
    if (!rangeStart || rangeEnd) {
      setRangeStart(dateStr);
      setRangeEnd(null);
      return;
    }
    if (dateStr <= rangeStart) {
      // Klik na dan prije (ili isti kao) početka — postaje novi početak
      // jednodnevnog odabira dok gost ne klikne drugi datum.
      setRangeStart(dateStr);
      setRangeEnd(null);
      return;
    }
    setRangeEnd(dateStr);
    applySelection(rangeStart, dateStr, lang);
  }

  function clearSelection() {
    setRangeStart(null);
    setRangeEnd(null);
  }

  return (
    <div className="stay-avail-cal">
      {months.map(({ year, month0, cells }) => (
        <div className="stay-avail-month" key={`${year}-${month0}`}>
          <div className="stay-avail-month-title">
            {MONTH_NAMES[lang][month0]} {year}
          </div>
          <div className="stay-avail-grid">
            {WEEKDAY_LABELS[lang].map((w) => (
              <span className="stay-avail-weekday" key={w}>
                {w}
              </span>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <span key={`b-${i}`} />;
              const dateStr = `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
              const isBlocked = blocked.has(dateStr);
              const isStart = dateStr === rangeStart;
              const isEnd = dateStr === rangeEnd;
              const inRange =
                !!rangeStart && !!rangeEnd && dateStr > rangeStart && dateStr < rangeEnd;

              if (isBlocked) {
                return (
                  <span key={dateStr} className="stay-avail-day stay-avail-blocked">
                    {day}
                  </span>
                );
              }

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => handleDayClick(dateStr)}
                  aria-pressed={isStart || isEnd}
                  title={
                    lang === "en"
                      ? "Click to pick your arrival/departure date"
                      : "Klikni za odabir datuma dolaska/odlaska"
                  }
                  className={
                    "stay-avail-day stay-avail-day-pick" +
                    (isStart || isEnd ? " stay-avail-day-selected" : "") +
                    (inRange ? " stay-avail-day-inrange" : "")
                  }
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="stay-avail-legend">
        <span>
          <i className="stay-avail-dot" />
          {lang === "en" ? "Available" : "Slobodno"}
        </span>
        <span>
          <i className="stay-avail-dot stay-avail-dot-blocked" />
          {lang === "en" ? "Booked" : "Zauzeto"}
        </span>
      </div>
      <p className="stay-avail-hint">
        {rangeStart && !rangeEnd
          ? lang === "en"
            ? "Now click your departure date."
            : "Sad klikni datum odlaska."
          : lang === "en"
            ? "Click your arrival date, then departure — we'll add it to your message below."
            : "Klikni datum dolaska pa datum odlaska — dodat ćemo ih u poruku upita ispod."}
        {(rangeStart || rangeEnd) && (
          <button type="button" onClick={clearSelection} className="stay-avail-clear">
            {lang === "en" ? "Clear" : "Poništi"}
          </button>
        )}
      </p>
    </div>
  );
}
