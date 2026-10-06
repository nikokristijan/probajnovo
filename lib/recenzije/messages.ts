export type MessageContext = {
  firstName: string;
  lastName?: string | null;
  businessName: string;
  service?: string | null;
  technician?: string | null;
  serviceDate?: Date | null;
  reviewLink?: string | null;
};

/** Popunjava {varijable}. Nepoznate varijable ostaju kakve jesu da ih korisnik primijeti. */
export function renderTemplate(template: string, ctx: MessageContext): string {
  const date = ctx.serviceDate ? `${ctx.serviceDate.getDate()}.${ctx.serviceDate.getMonth() + 1}.` : "";
  const values: Record<string, string> = {
    first_name: ctx.firstName,
    last_name: ctx.lastName || "",
    business_name: ctx.businessName,
    service: ctx.service || "uslugu",
    technician: ctx.technician || "nas tim",
    service_date: date,
    review_link: ctx.reviewLink || "{review_link}",
  };
  return template
    .replace(/\{(\w+)\}/g, (m, k: string, offset: number, src: string) => {
      if (!(k in values)) return m;
      // "Klima d.o.o." + "." u predlošku ne smije dati "d.o.o.."
      const v = values[k];
      return v.endsWith(".") && src[offset + m.length] === "." ? v.slice(0, -1) : v;
    })
    .replace(/\s+\n/g, "\n")
    .trim();
}

/** GSM-7 segments are 160 chars (153 when concatenated); UCS-2 (emoji, č, ć…) 70 / 67. */
export function smsSegments(text: string) {
  const gsm = /^[\x20-\x7E\n\r£¥èéùìòÇØøÅå_ÆæßÉ¡ÄÖÑÜ§¿äöñüà€]*$/.test(text);
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  const segments = text.length <= single ? 1 : Math.ceil(text.length / multi);
  return { encoding: gsm ? "GSM-7" : "Unicode", segments, length: text.length };
}

/** Zamjenjuje hrvatske dijakritike da SMS ostane GSM-7 (160 znakova po poruci). */
export function stripDiacritics(text: string) {
  const map: Record<string, string> = { č: "c", ć: "c", š: "s", ž: "z", đ: "dj", Č: "C", Ć: "C", Š: "S", Ž: "Z", Đ: "Dj" };
  return text.replace(/[čćšžđČĆŠŽĐ]/g, (c) => map[c]).replace(/[„“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-");
}
