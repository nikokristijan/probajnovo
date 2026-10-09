import "server-only";
import { create } from "qrcode";
import { z } from "zod";

/**
 * QR kod za plakat (NOVO Recenzije). Generira se na serveru kao SVG podaci:
 * `size` je broj modula po stranici, `path` je jedan SVG path (crni moduli u
 * jediničnim kvadratima). Klijent ga samo crta, pa nema QR biblioteke u pregledniku.
 */
export type QrMatrix = { size: number; path: string };

/** Samo http(s), do 500 znakova (koliko dopušta i profil tvrtke) da QR ostane dovoljno rijedak za čitljiv ispis. */
const reviewUrlSchema = z.url({ protocol: /^https?$/ }).max(500);

/** Vraća ispravan http(s) link ili null (nikad ne baca). */
export function parseReviewUrl(raw: string | null | undefined): string | null {
  const parsed = reviewUrlSchema.safeParse((raw ?? "").trim());
  return parsed.success ? parsed.data : null;
}

/**
 * Izrađuje QR za zadani tekst. Razina ispravka "Q" (25 %) podnosi ogrebotine i
 * prljavštinu na stolu ili NFC kartici. Baca grešku ako tekst ne stane u QR.
 */
export function buildQrMatrix(text: string): QrMatrix {
  const qr = create(text, { errorCorrectionLevel: "Q" });
  const { size } = qr.modules;
  let path = "";
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (!qr.modules.get(y, x)) {
        x++;
        continue;
      }
      const start = x;
      while (x < size && qr.modules.get(y, x)) x++;
      const len = x - start;
      path += `M${start} ${y}h${len}v1h-${len}z`;
    }
  }
  return { size, path };
}
