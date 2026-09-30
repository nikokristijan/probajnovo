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

/** Broj kalendarskih dana od danas do `dateStr` (Europe/Zagreb) — pozitivno
    = u budućnosti, negativno = prošlost. Računa preko UTC podneva oba
    datuma (isti DST-siguran trik kao dateStringOffsetFromTodayZagreb) pa
    razlika ispada cijeli broj dana bez zaokruživanja greškom. */
function daysFromTodayZagreb(dateStr: string): number {
  const todayMs = new Date(`${todayDateStringZagreb()}T12:00:00Z`).getTime();
  const dateMs = new Date(`${dateStr}T12:00:00Z`).getTime();
  return Math.round((dateMs - todayMs) / 86_400_000);
}

/** "3. lis" stil kratki datum (hr-HR, bez godine) — koristio se dosad samo
    lokalno u TasksBoard.tsx kao formatDate(); izvučeno ovamo da ga mogu
    dijeliti i drugi prikazi roka (npr. buduća Portal home aktivnost). */
export function formatShortDateZagreb(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hr-HR", { timeZone: "UTC", day: "numeric", month: "short" });
}

export type DueDateTier = "overdue" | "today" | "soon" | "normal";

/** Ljudski čitljiv rok + razina hitnosti za zadatke (Portal, "Zadaci" tab)
    — poboljšanje prikaza roka (dosad samo goli "Rok 3. lis" ili crveni
    "Kasni 3. lis", bez ikakvog osjećaja "koliko brzo"). "soon" pokriva
    sutra/prekosutra (uskoro dolazi, vrijedi se požuriti); "today"/"overdue"
    imaju prednost. isDone=true za već završene zadatke uvijek vraća
    neutralan "normal" prikaz — dovršen zadatak više nije hitan bez obzira
    kad mu je bio rok. */
export function describeDueDateZagreb(dateStr: string, isDone: boolean): { label: string; tier: DueDateTier } {
  if (isDone) {
    return { label: `Rok ${formatShortDateZagreb(dateStr)}`, tier: "normal" };
  }
  const diff = daysFromTodayZagreb(dateStr);
  if (diff < 0) {
    const n = Math.abs(diff);
    return { label: `Kasni ${n} ${n === 1 ? "dan" : "dana"}`, tier: "overdue" };
  }
  if (diff === 0) return { label: "Rok danas", tier: "today" };
  if (diff === 1) return { label: "Rok sutra", tier: "soon" };
  if (diff === 2) return { label: "Rok za 2 dana", tier: "soon" };
  return { label: `Rok za ${diff} dana`, tier: "normal" };
}

/** Broj dana od danas (Europe/Zagreb) do SLJEDEĆEG nastupanja rođendana u
    "MM-DD" formatu (adminUsers.birthday, Task #24 "Rođendani" widget na
    Portal početnoj) — 0 = danas, uvijek nenegativno (ako je datum ove
    godine već prošao, računa se do iste "MM-DD" SLJEDEĆE godine). Godina
    rođenja se namjerno nigdje ne pamti/koristi (vidi komentar uz
    adminUsers.birthday u schema.ts), pa se ovdje uvijek radi s trenutnom
    (ili sljedećom) kalendarskom godinom. */
export function daysUntilNextBirthdayZagreb(mmdd: string): number | null {
  const match = /^(\d{2})-(\d{2})$/.exec(mmdd);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const todayStr = todayDateStringZagreb();
  const [todayYear] = todayStr.split("-").map(Number);
  const pad2 = (n: number) => String(n).padStart(2, "0");

  const thisYearStr = `${todayYear}-${pad2(month)}-${pad2(day)}`;
  const candidateStr = thisYearStr >= todayStr ? thisYearStr : `${todayYear + 1}-${pad2(month)}-${pad2(day)}`;

  const todayMs = new Date(`${todayStr}T12:00:00Z`).getTime();
  const candidateMs = new Date(`${candidateStr}T12:00:00Z`).getTime();
  return Math.round((candidateMs - todayMs) / 86_400_000);
}

/** "17. ožujka" stil (dan + mjesec u genitivu, BEZ godine) za "MM-DD" —
    isti par korišten uz daysUntilNextBirthdayZagreb za widget "Rođendani". */
export function formatBirthdayZagreb(mmdd: string): string {
  const match = /^(\d{2})-(\d{2})$/.exec(mmdd);
  if (!match) return mmdd;
  const month = Number(match[1]);
  const day = Number(match[2]);
  // Proizvoljna (neparna) godina samo da Date/Intl imaju s čim raditi —
  // godina se ne prikazuje (format ispod nema "year").
  const d = new Date(Date.UTC(2001, month - 1, day));
  return d.toLocaleDateString("hr-HR", { timeZone: "UTC", day: "numeric", month: "long" });
}

/** Pozdrav po dobu dana u Hrvatskoj (plan #41): "Dobro jutro" do 12 h,
    "Dobar dan" do 18 h, inače "Dobra večer". */
export function greetingZagreb(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zagreb", hour: "2-digit", hourCycle: "h23" }).format(new Date())
  );
  if (hour >= 5 && hour < 12) return "Dobro jutro";
  if (hour >= 12 && hour < 18) return "Dobar dan";
  return "Dobra večer";
}
