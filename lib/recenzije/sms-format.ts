import { smsSegments, stripDiacritics } from "./messages";

/**
 * Oblik SMS-a po pružatelju i procjena troška. Čisto (bez baze i bez server-only), pa isti kod
 * složi tekst koji se stvarno šalje (services/messaging.ts) i pregled u pisaču poruka.
 */

export type SmsProviderName = "gateway" | "novo" | "textbee" | "twilio";

/**
 * Treba li poruka poveznicu za odjavu (/o/<token>): da kad primatelj ne može (pouzdano) odgovoriti STOP.
 * Twilio u Hrvatskoj ne podržava odgovore. TextBee prima odgovore samo kad je postavljen webhook
 * (TEXTBEE_WEBHOOK_SECRET, `textbeeReplies`); bez njega se ponaša kao Twilio, da poruka nikad ne ode bez ikakve odjave.
 */
export function needsOptOutLink(provider: SmsProviderName | null, opts: { textbeeReplies?: boolean } = {}): boolean {
  return provider === "twilio" || (provider === "textbee" && !opts.textbeeReplies);
}

/**
 * Twilio: približna cijena odlaznog SMS-a u Hrvatsku po segmentu (GSM-7: 160 znakova, UCS-2: 70).
 * Jedino mjesto s ovom brojkom; prikazuje se uvijek kao PROCJENA, stvarni trošak je na Twilio računu.
 */
export const TWILIO_HR_USD_PER_SEGMENT = 0.138;

export const estimateTwilioCostUsd = (segments: number) => Math.round(Math.max(0, segments) * TWILIO_HR_USD_PER_SEGMENT * 100) / 100;

export const formatUsd = (amount: number) =>
  `${amount.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;

// --- Odjava u tekstu poruke ---
//
// Svaka poruka nosi TOČNO JEDAN način odjave, uvijek kao zadnji redak:
// - gdje odgovori rade (Android mobitel tvrtke, zajednički NOVO mobitel, TextBee s webhookom): uputa "Za odjavu napišite STOP.",
// - gdje ne mogu stići do nas (Twilio u Hrvatskoj, TextBee bez webhooka): redak "Odjava: <adresa>/o/<token>".
// Jedina ključna riječ koju primatelj vidi je STOP (ostale riječi koje inbound.ts tiho prihvaća ovdje se ne spominju).

export const OPT_OUT_LABEL = "Odjava:";

/** Uputa za odjavu odgovorom. Kad je ostatak poruke GSM-7, koristi se varijanta bez kvačica da poruka ne pređe u Unicode. */
export const REPLY_OPT_OUT = "Za odjavu napišite STOP.";
export const REPLY_OPT_OUT_ASCII = "Za odjavu napisite STOP.";

const TOKEN = "[A-Za-z0-9]{6,32}";

/** Već ugrađena poveznica za odjavu ("Odjava: https://host/o/token"), npr. kad se poruka šalje ponovno. */
const EXISTING_LINK = new RegExp(`Odjava:[ \\t]*\\S*/o/${TOKEN}\\S*`, "gi");

/**
 * Fraze koje traže odgovor STOP: i stari oblici ("Za odjavu odgovorite STOP.") i novi ("Za odjavu napišite STOP.", s kvačicama
 * ili bez). Prepoznaju se da bi se poruka mogla složiti s jednom uputom, a ne s dvije: kod pružatelja s odgovorima
 * normaliziraju se na novi oblik, kod pružatelja bez odgovora zamjenjuju poveznicom. Fraza se uzima cijela, zajedno s
 * završnom točkom i uobičajenim nastavcima ("za odjavu", "na ovaj broj" ...), da u poruci ne ostanu usamljene riječi.
 */
const STOP_PHRASES: RegExp[] = [
  /(?:odjava\s*[:-]\s*)?(?:za\s+odjavu\s+)?(?:odgovorite|odgovori|odgovor|pošaljite|posaljite|napišite|napisite|reply|text)\s+(?:s\s+|sa\s+|with\s+)?["„“”']?stop\b["”“']?(?:\s+(?:za\s+(?:odjavu|prekid)|na\s+ovaj\s+broj|na\s+ovu\s+poruku|to\s+(?:opt\s*out|unsubscribe)))*[.!]?/i,
  /(?:odjava|za\s+odjavu)(?:\s*[:-])?\s*["„“”']?stop\b["”“']?[.!]?/i,
  /["„“”']?stop\b["”“']?\s+za\s+(?:odjavu|prekid)[.!]?/i,
];
const STOP_PHRASES_ALL = STOP_PHRASES.map((re) => new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`));

/** Privremena oznaka mjesta s kojeg je uputa skinuta (nikad se ne pojavljuje u običnom tekstu). */
const MARK = "\u0001";

/** Koliko poveznica za odjavu ima u tekstu (mora biti točno jedna u poruci koja ide preko Twilija). */
export const countOptOutLinks = (body: string) => (body.match(new RegExp(`/o/${TOKEN}`, "g")) ?? []).length;

/** Koliko uputa "odgovorite/napišite STOP" ima u tekstu (mora biti točno jedna u poruci koja ide gdje odgovori rade). */
export function countStopInstructions(body: string): number {
  let n = 0;
  let rest = body;
  for (const re of STOP_PHRASES_ALL) {
    rest = rest.replace(re, () => {
      n += 1;
      return MARK;
    });
  }
  return n;
}

/**
 * Skida iz teksta svaku uputu za odjavu, ma gdje bila: staru ili novu frazu "odgovorite/napišite STOP" i već ugrađenu
 * poveznicu "Odjava: .../o/<token>". Ostatak teksta ostaje isti (bez praznine i usamljenih riječi tamo gdje je uputa bila).
 */
export function stripOptOuts(body: string): string {
  let out = body.replace(EXISTING_LINK, MARK);
  for (const re of STOP_PHRASES_ALL) out = out.replace(re, MARK);
  if (!out.includes(MARK)) return body;
  out = out.replace(/[ \t]*(?:\u0001[ \t]*)+(\n?)/g, (m, nl: string, offset: number, src: string) => {
    const atStart = offset === 0 || src[offset - 1] === "\n";
    const atEnd = nl !== "" || offset + m.length >= src.length;
    if (atStart) return ""; // uputa je počinjala redak (i cijeli redak, ako je ona bila sve u njemu): redak nestaje
    return atEnd ? nl : " "; // na kraju retka ostaje samo prijelom, a usred retka jedna praznina
  });
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Stavlja poveznicu za odjavu u tekst, uvijek točno jednom i kao zadnji redak "Odjava: <adresa>/o/<token>":
 * fraza "Za odjavu odgovorite/napišite STOP" i već ugrađena poveznica (ponovno slanje) skidaju se s mjesta na kojem jesu,
 * pa iza poveznice nikad ne ostaju zalutale riječi.
 */
export function withOptOutLine(body: string, optOutUrl: string): string {
  const line = `${OPT_OUT_LABEL} ${optOutUrl}`;
  const rest = stripOptOuts(body);
  return rest ? `${rest}\n${line}` : line;
}

/**
 * Stavlja uputu za odjavu odgovorom u tekst, uvijek točno jednom i kao zadnji redak: stara ili nova fraza u predlošku
 * normalizira se na "Za odjavu napišite STOP.", a ako je nema, dodaje se na kraj u novom retku. Druga primjena na isti tekst
 * ne mijenja ništa (ponovno slanje, podsjetnici). Ako je ostatak poruke GSM-7, uputa je bez kvačica ("napisite"), da dodavanje ne
 * prebaci poruku u Unicode (70 znakova po SMS-u umjesto 160); inače ide s kvačicama.
 */
export function withReplyOptOut(body: string): string {
  const rest = stripOptOuts(body);
  const line = smsSegments(rest).encoding === "GSM-7" ? REPLY_OPT_OUT_ASCII : REPLY_OPT_OUT;
  return rest ? `${rest}\n${line}` : line;
}

export type ComposedSms = {
  /** Točan tekst koji se šalje (i sprema u poruku). */
  body: string;
  segments: number;
  /** Duljina u znakovima koji se broje za segmente (GSM-7 mjesta ili UCS-2 jedinice). */
  length: number;
  encoding: "GSM-7" | "Unicode";
  /** Kako se primatelj odjavljuje: odgovorom STOP ("reply"), poveznicom ("link") ili nema uputu (nema pružatelja). */
  optOut: "reply" | "link" | null;
  /** Poveznica za odjavu u poruci; null kad je pružatelj ne treba. */
  optOutUrl: string | null;
  /** Adresa (glavna ili kratka) koja je ušla u poruku. */
  base: string;
  /** Koliko je SMS-ova poruka dobila zbog odjave (0 kad je nije bilo ili stane u isti broj). */
  extraSegments: number;
};

/**
 * Slaže konačan tekst poruke za pružatelja; isti tekst se šalje i prikazuje u pregledu, a segmenti se uvijek broje na njemu.
 *
 * Odjava, točno jedan način po poruci (vidi i needsOptOutLink):
 * - Android mobitel tvrtke, zajednički NOVO mobitel i TextBee s webhookom (pozivatelj ne šalje optOutToken): odgovori stižu do nas,
 *   pa poruka završava uputom "Za odjavu napišite STOP." (withReplyOptOut),
 * - Twilio i TextBee bez webhooka (pozivatelj šalje optOutToken): odgovori ne stižu, pa poruka završava retkom
 *   "Odjava: <adresa>/o/<token>" (withOptOutLine).
 * Ako zbog toga poruka pređe u više SMS-ova, a postoji kraća javna adresa (NR_SHORT_URL), poveznice u poruci koriste nju, ali samo ako time stvarno ostaje manje SMS-ova.
 * Bez pružatelja (null) tekst se ne mijenja jer se ionako ne šalje.
 *
 * `render` slaže tekst za zadanu adresu (poveznica za recenziju ovisi o njoj).
 *
 * Twilio naplaćuje svaki segment, a jedno č, š ili ž (npr. ime "Željko" ili tvrtka "Čistoća") prebacuje cijelu poruku u
 * Unicode (70 znakova po segmentu umjesto 160), pa bi ta poruka koštala 2 do 3 puta više. Zato se preko Twilija tekst
 * uvijek šalje bez kvačica (kao i zadani predlošci); isti tekst vidi pregled u pisaču poruka. Preko Android mobitela i TextBeea
 * tekst se ne mijenja (kvačice ostaju), a segmenti se svejedno računaju točno za pregled; trošak ide po tarifi SIM-a.
 */
export function composeSms(opts: {
  provider: SmsProviderName | null;
  render: (base: string) => string;
  /** Isti token kao u /r/<token> poveznici klijenta; null kad poruka ne treba poveznicu za odjavu (needsOptOutLink). */
  optOutToken: string | null;
  appUrl: string;
  shortUrl?: string | null;
}): ComposedSms {
  const { provider, optOutToken, appUrl, shortUrl } = opts;
  const render = provider === "twilio" ? (base: string) => stripDiacritics(opts.render(base)) : opts.render;

  // Twilio i TextBee: poveznica ide samo kad je pozivatelj poslao token (needsOptOutLink). Gdje odgovori rade, token se ne koristi.
  const mode: "reply" | "link" | null =
    (provider === "twilio" || provider === "textbee") && optOutToken
      ? "link"
      : provider === "gateway" || provider === "novo" || provider === "textbee"
        ? "reply"
        : null;

  const plainText = render(appUrl);
  const plainSeg = smsSegments(plainText);
  if (mode === null) {
    return { body: plainText, segments: plainSeg.segments, length: plainSeg.length, encoding: plainSeg.encoding, optOut: null, optOutUrl: null, base: appUrl, extraSegments: 0 };
  }

  const build = (base: string) => {
    const optOutUrl = mode === "link" ? `${base}/o/${optOutToken}` : null;
    const body = optOutUrl ? withOptOutLine(render(base), optOutUrl) : withReplyOptOut(render(base));
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
    optOut: mode,
    optOutUrl: best.optOutUrl,
    base: best.base,
    extraSegments: Math.max(0, best.seg.segments - plainSeg.segments),
  };
}
