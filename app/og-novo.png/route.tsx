import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/**
 * Zadana slika za dijeljenje (Open Graph / Twitter), 1200×630 — prije se
 * dijelio logo 1474×497 koji Facebook, WhatsApp i LinkedIn režu po sredini.
 * Statična: generira se jednom pri buildu (vidi lib/seo.ts DEFAULT_OG_IMAGE).
 */
export const dynamic = "force-static";

const NAVY = "#0000C3";
const ORANGE = "#FF7F00";

/** Space Grotesk (NOVO font) s Google Fontsa; ako dohvat ne uspije, lokalni DejaVu Sans Bold. */
async function loadFont(): Promise<{ name: string; data: ArrayBuffer }> {
  try {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap",
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.30 (KHTML, like Gecko) Safari/534.30" } }
    ).then((r) => r.text());
    const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!src) throw new Error("font url not found");
    const data = await fetch(src).then((r) => r.arrayBuffer());
    return { name: "Space Grotesk", data };
  } catch {
    const buf = await readFile(path.join(process.cwd(), "public/fonts/DejaVuSans-Bold.ttf"));
    return { name: "DejaVu Sans", data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer };
  }
}

export async function GET() {
  const font = await loadFont();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: NAVY,
          padding: "72px 84px",
          fontFamily: font.name,
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, letterSpacing: 4, opacity: 0.85 }}>
          <div style={{ width: 14, height: 14, background: ORANGE }} />
          KREATIVNI STUDIO · SLAVONSKI BROD
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 210, lineHeight: 1, letterSpacing: -10 }}>NOVO</div>
          <div style={{ fontSize: 44, lineHeight: 1.2, marginTop: 18, maxWidth: 980 }}>
            Web stranice, brending, NFC pločice, digitalni jelovnik i Google recenzije.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 34, color: ORANGE }}>probajnovo.com</div>
      </div>
    ),
    { width: 1200, height: 630, fonts: [{ name: font.name, data: font.data, weight: 700, style: "normal" }] }
  );
}
