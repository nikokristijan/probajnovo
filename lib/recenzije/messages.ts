export type MessageContext = {
  firstName: string;
  lastName?: string | null;
  businessName: string;
  service?: string | null;
  technician?: string | null;
  serviceDate?: Date | null;
  reviewLink?: string | null;
};

/**
 * Ime koje nosi klijent s digitalnog jelovnika: gost nikad ne upiše ime, a nr_clients.first_name je obavezno.
 * Predlošci ga tretiraju kao da imena nema ("Bok {first_name}!" postaje "Bok!").
 */
export const ANONYMOUS_FIRST_NAME = "Gost";

/** True kad ime nije poznato: prazno ili oznaka gosta s jelovnika. */
export function isAnonymousName(firstName: string | null | undefined): boolean {
  const f = (firstName ?? "").trim();
  return f === "" || f === ANONYMOUS_FIRST_NAME;
}

/** Privremena oznaka mjesta s kojeg je ime izostavljeno (nikad se ne pojavljuje u običnom tekstu). */
const GAP = "\u0002";

/** Zatvara rupe koje je ostavilo izostavljeno ime: "Bok !" -> "Bok!", "od X, :" -> "od X:", "Hvala  na" -> "Hvala na". */
function closeNameGaps(text: string): string {
  if (!text.includes(GAP)) return text;
  return (
    text
      // Ime i prezime oba izostavljeni: jedna rupa.
      .replace(new RegExp(`${GAP}(?:[ \\t]*${GAP})+`, "g"), GAP)
      // Početak poruke ili retka: "{first_name}, hvala" -> "Hvala".
      .replace(new RegExp(`(^|\\n)${GAP}[ \\t]*[,:;][ \\t]*(\\S)`, "g"), (_m, nl: string, ch: string) => nl + ch.toLocaleUpperCase("hr"))
      // Zarez koji je samo uvodio ime: "od X, {first_name}: link" -> "od X: link".
      .replace(new RegExp(`,[ \\t]*${GAP}[ \\t]*(?=[:;.!?,]|\\n|$)`, "g"), "")
      // Razmak ispred oznake: "Bok {first_name}!" -> "Bok!", "Bok {first_name}, ..." -> "Bok, ...".
      .replace(new RegExp(`[ \\t]*${GAP}(?=[ \\t]*[,:;.!?])`, "g"), "")
      // Usred rečenice: "Hvala {first_name} na posjetu" -> "Hvala na posjetu".
      .replace(new RegExp(`[ \\t]*${GAP}[ \\t]*`, "g"), " ")
  );
}

/**
 * Popunjava {varijable}. Nepoznate varijable ostaju kakve jesu da ih korisnik primijeti. Kad ime nije poznato
 * (gost s jelovnika), {first_name} i {last_name} se izostavljaju zajedno s razmakom i zarezom koji su ga uvodili.
 */
export function renderTemplate(template: string, ctx: MessageContext): string {
  const date = ctx.serviceDate ? `${ctx.serviceDate.getDate()}.${ctx.serviceDate.getMonth() + 1}.` : "";
  const firstMissing = isAnonymousName(ctx.firstName);
  const values: Record<string, string> = {
    first_name: firstMissing ? GAP : ctx.firstName,
    last_name: firstMissing || !ctx.lastName ? GAP : ctx.lastName,
    business_name: ctx.businessName,
    service: ctx.service || "uslugu",
    technician: ctx.technician || "nas tim",
    service_date: date,
    review_link: ctx.reviewLink || "{review_link}",
  };
  const filled = template.replace(/\{(\w+)\}/g, (m, k: string, offset: number, src: string) => {
    if (!(k in values)) return m;
    // "Klima d.o.o." + "." u predlošku ne smije dati "d.o.o.."
    const v = values[k];
    return v.endsWith(".") && src[offset + m.length] === "." ? v.slice(0, -1) : v;
  });
  return closeNameGaps(filled).replace(/\s+\n/g, "\n").trim();
}

/**
 * GSM-7 (osnovna tablica + proširenja). Znakovi proširenja (^ { } [ ] ~ | € i obrnuta kosa crta) zauzimaju dva mjesta.
 * Sve izvan toga (č, ć, š, ž, đ, emoji, navodnici ...) prebacuje poruku u Unicode (UCS-2).
 */
const GSM_BASIC = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
);
const GSM_EXTENDED = new Set("^{}\\[~]|€");

/** Broj mjesta u GSM-7, ili null kad tekst nije moguće poslati u GSM-7. */
function gsmLength(text: string): number | null {
  let n = 0;
  for (const ch of text) {
    if (GSM_BASIC.has(ch)) n += 1;
    else if (GSM_EXTENDED.has(ch)) n += 2;
    else return null;
  }
  return n;
}

/** GSM-7: 160 znakova u jednoj poruci (153 kad je spojena); UCS-2 (emoji, č, ć ...): 70 / 67. */
export function smsSegments(text: string) {
  const gsm = gsmLength(text);
  if (gsm !== null) {
    return { encoding: "GSM-7" as const, segments: gsm <= 160 ? 1 : Math.ceil(gsm / 153), length: gsm };
  }
  const length = text.length;
  return { encoding: "Unicode" as const, segments: length <= 70 ? 1 : Math.ceil(length / 67), length };
}

/** Bez dijakritika i velikih slova, da "Žabac d.o.o." i "zabac d.o.o." budu isto. */
function plain(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
}

/**
 * Sve poruke svih klijenata odlaze s istog NOVO pošiljatelja, pa primatelj samo iz teksta zna tko mu piše.
 * Predlošci imenuju tvrtku ({business_name}); ako poruka koju je netko ručno napisao ne sadrži naziv
 * tvrtke, dodaje se na početak.
 */
export function withBusinessName(body: string, businessName: string) {
  const name = businessName.trim();
  if (!name || plain(body).includes(plain(name))) return body;
  return `${name}: ${body}`;
}

/** Zamjenjuje hrvatske dijakritike da SMS ostane GSM-7 (160 znakova po poruci). */
export function stripDiacritics(text: string) {
  const map: Record<string, string> = { č: "c", ć: "c", š: "s", ž: "z", đ: "dj", Č: "C", Ć: "C", Š: "S", Ž: "Z", Đ: "Dj" };
  return text
    .replace(/[čćšžđČĆŠŽĐ]/g, (c) => map[c])
    .replace(/[„“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ");
}
