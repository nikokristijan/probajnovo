import { smsSegments, stripDiacritics } from "./messages";

/**
 * Oblik SMS-a po pružatelju i procjena troška. Čisto (bez baze i bez server-only), pa isti kod
 * složi tekst koji se stvarno šalje (services/messaging.ts) i pregled u pisaču poruka.
 */

export type SmsProviderName = "gateway" | "novo" | "twilio";

/**
 * Twilio: približna cijena odlaznog SMS-a u Hrvatsku po segmentu (GSM-7: 160 znakova, UCS-2: 70).
 * Jedino mjesto s ovom brojkom; prikazuje se uvijek kao PROCJENA, stvarni trošak je na Twilio računu.
 */
export const TWILIO_HR_USD_PER_SEGMENT = 0.138;

export const estimateTwilioCostUsd = (segments: number) => Math.round(Math.max(0, segments) * TWILIO_HR_USD_PER_SEGMENT * 100) / 100;

export const formatUsd = (amount: number) =>
  `${amount.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;

// --- Poveznica za odjavu ---

export const OPT_OUT_LABEL = "Odjava:";
const TOKEN = "[A-Za-z0-9]{6,32}";

/** Već ugrađena poveznica za odjavu ("Odjava: https://host/o/token"), npr. kad se poruka šalje ponovno. */
const EXISTING_LINK = new RegExp(`Odjava:[ \\t]*\\S*/o/${TOKEN}\\S*`, "gi");

/**
 * Fraze koje traže odgovor STOP; kod pružatelja bez odgovora (Twilio u Hrvatskoj) zamjenjuju se
 * poveznicom. Prvi pogodak se zamjenjuje, a uz njega nestaje i završna točka.
 */
const STOP_PHRASES: RegExp[] = [
  /(?:odjava\s*[:-]\s*)?(?:za\s+odjavu\s+)?(?:odgovorite|odgovori|odgovor|pošaljite|posaljite|napišite|napisite|reply|text)\s+(?:s\s+|sa\s+|with\s+)?["„“”']?stop\b["”“']?(?:\s+(?:za\s+(?:odjavu|prekid)|na\s+ovaj\s+broj|na\s+ovu\s+poruku|to\s+(?:opt\s*out|unsubscribe)))*[.!]?/i,
  /(?:odjava|za\s+odjavu)\s*[:-]?\s*["„“”']?stop\b["”“']?[.!]?/i,
  /["„“”']?stop\b["”“']?\s+za\s+(?:odjavu|prekid)[.!]?/i,
];

/** Koliko poveznica za odjavu ima u tekstu (mora biti točno jedna u poruci koja ide preko Twilija). */
export const countOptOutLinks = (body: string) => (body.match(new RegExp(`/o/${TOKEN}`, "g")) ?? []).length;

/**
 * Stavlja poveznicu za odjavu u tekst, uvijek točno jednom:
 * 1. ako poruka već ima "Odjava: .../o/<token>" (ponovno slanje), zamijeni je trenutnom,
 * 2. inače zamijeni frazu "Za odjavu odgovorite STOP" poveznicom,
 * 3. inače dodaje novi redak "Odjava: <adresa>/o/<token>" na kraj.
 */
export function withOptOutLine(body: string, optOutUrl: string): string {
  const line = `${OPT_OUT_LABEL} ${optOutUrl}`;

  let seen = 0;
  const swapped = body.replace(EXISTING_LINK, () => (seen++ === 0 ? line : ""));
  if (seen > 0) return seen > 1 ? swapped.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trimEnd() : swapped;

  for (const re of STOP_PHRASES) {
    if (re.test(body)) return body.replace(re, () => line);
  }
  return `${body.replace(/\s+$/, "")}\n${line}`;
}

export type ComposedSms = {
  /** Točan tekst koji se šalje (i sprema u poruku). */
  body: string;
  segments: number;
  /** Duljina u znakovima koji se broje za segmente (GSM-7 mjesta ili UCS-2 jedinice). */
  length: number;
  encoding: "GSM-7" | "Unicode";
  /** Poveznica za odjavu u poruci; null kad je pružatelj ne treba. */
  optOutUrl: string | null;
  /** Adresa (glavna ili kratka) koja je ušla u poruku. */
  base: string;
  /** Koliko je SMS-ova poruka dobila zbog poveznice za odjavu (0 kad je nije bilo ili stane u isti broj). */
  extraSegments: number;
};

/**
 * Slaže konačan tekst poruke za pružatelja. Preko Twilija odgovori u Hrvatskoj ne dolaze do nas, pa se
 * dodaje poveznica za odjavu. Ako zbog nje poruka pređe u više SMS-ova, a postoji kraća javna adresa
 * (NR_SHORT_URL), poveznice u poruci koriste nju, ali samo ako time stvarno ostaje manje SMS-ova.
 *
 * `render` slaže tekst za zadanu adresu (poveznica za recenziju ovisi o njoj).
 *
 * Twilio naplaćuje svaki segment, a jedno č, š ili ž (npr. ime "Željko" ili tvrtka "Čistoća") prebacuje cijelu poruku u
 * Unicode (70 znakova po segmentu umjesto 160), pa bi ta poruka koštala 2 do 3 puta više. Zato se preko Twilija tekst
 * uvijek šalje bez kvačica (kao i zadani predlošci); isti tekst vidi pregled u pisaču poruka.
 */
export function composeSms(opts: {
  provider: SmsProviderName | null;
  render: (base: string) => string;
  /** Isti token kao u /r/<token> poveznici klijenta. */
  optOutToken: string | null;
  appUrl: string;
  shortUrl?: string | null;
}): ComposedSms {
  const { provider, optOutToken, appUrl, shortUrl } = opts;
  const render = provider === "twilio" ? (base: string) => stripDiacritics(opts.render(base)) : opts.render;
  const plainText = render(appUrl);
  const plainSeg = smsSegments(plainText);

  if (provider !== "twilio" || !optOutToken) {
    return { body: plainText, segments: plainSeg.segments, length: plainSeg.length, encoding: plainSeg.encoding, optOutUrl: null, base: appUrl, extraSegments: 0 };
  }

  const build = (base: string) => {
    const optOutUrl = `${base}/o/${optOutToken}`;
    const body = withOptOutLine(render(base), optOutUrl);
    return { body, optOutUrl, base, seg: smsSegments(body) };
  };

  let best = build(appUrl);
  if (best.seg.segments > 1 && shortUrl && shortUrl.length < appUrl.length) {
    const short = build(shortUrl);
    if (short.seg.segments < best.seg.segments) best = short;
  }
  return {
    body: best.body,
    segments: best.seg.segments,
    length: best.seg.length,
    encoding: best.seg.encoding,
    optOutUrl: best.optOutUrl,
    base: best.base,
    extraSegments: Math.max(0, best.seg.segments - plainSeg.segments),
  };
}
