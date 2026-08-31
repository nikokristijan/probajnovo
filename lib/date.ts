/**
 * Vercel serveri rade u UTC, ne u hrvatskom vremenu — golo `new Date()` +
 * .getFullYear()/.getMonth()/.getDate() oko ponoći (CEST = UTC+2, CET =
 * UTC+1) zna pokazati JUČERAŠNJI datum po hrvatskom vremenu (npr. 22:45 UTC
 * je već 00:45 sljedećeg dana u Zagrebu). Svugdje gdje treba "danas" ili
 * "ovaj mjesec" iz perspektive hrvatskog korisnika (vlasnika vikendice)
 * koristi ove helpere umjesto golog `new Date()`.
 */

/** "YYYY-MM-DD" za danas u Europe/Zagreb — isti format kao checkIn/checkOut/
    date kolone u bazi, pogodno za izravnu usporedbu stringova. */
export function todayDateStringZagreb(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zagreb",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** { year, month } (mjesec 1-12) za danas u Europe/Zagreb — za zadane
    vrijednosti "ovaj mjesec" filtera/navigacije (npr. zarada, kalendar). */
export function currentYearMonthZagreb(): { year: number; month: number } {
  const [y, m] = todayDateStringZagreb().split("-");
  return { year: Number(y), month: Number(m) };
}

/** "YYYY-MM-DD" pomaknut za `days` dana (može biti negativan) od danas u
    Europe/Zagreb — za cron poslove ("sutra", "prije 2 dana"). Računa preko
    UTC podneva istog kalendarskog dana (izbjegava DST pomake pri dodavanju
    24h u lokalnoj zoni). */
export function dateStringOffsetFromTodayZagreb(days: number): string {
  const today = todayDateStringZagreb();
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
