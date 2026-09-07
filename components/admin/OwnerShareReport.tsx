"use client";

import { useState } from "react";

type ShareStats = {
  monthLabel: string;
  subtitle: string | null;
  netEur: number;
  currentDays: number;
  goalDays: number;
  deltaPct: number | null;
  streak: number;
};

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Suptilan šum preko cijele slike — isti duh kao .owner-glass-grain::after
    u globals.css (fractal noise preko SVG-a). Bez ovoga export izgleda
    kao gladak "AI" gradient; sa šumom izgleda kao stvarna optika/tisak. */
function addGrain(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const tile = document.createElement("canvas");
  tile.width = 120;
  tile.height = 120;
  const tctx = tile.getContext("2d")!;
  const img = tctx.createImageData(120, 120);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  const pattern = ctx.createPattern(tile, "repeat")!;
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Iscrtava brendirani 1080×1080 PNG sažetak mjeseca na <canvas>-u, u
    memoriji (bez servera, bez novih npm paketa) — vidi handleShare niže.
    Isti dizajn-jezik kao .owner-hero u globals.css nakon "gradient izgleda
    AI" ispravke: čvrsta navy podloga koja dominira slikom + dva mala
    lokalizirana sjaja u kutovima, umjesto glatkog dijagonalnog sweepa kroz
    sve tri boje (taj sweep je bio točno ono na što se odnosila feedback
    poruka — ista slika se dijeli van dashboarda pa mora nositi isti,
    ispravljeni izgled, ne stari). */
function drawReportCanvas(stats: ShareStats): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d")!;

  // Navy podloga — dominira, brend ostaje prepoznatljiv.
  ctx.fillStyle = "#0000c3";
  ctx.fillRect(0, 0, 1080, 1080);

  // Narančasti sjaj, donji lijevi kut (izvan platna, samo gornji luk vidljiv).
  const orangeGlow = ctx.createRadialGradient(20, 1150, 20, 20, 1150, 820);
  orangeGlow.addColorStop(0, "rgba(255,148,40,0.6)");
  orangeGlow.addColorStop(1, "rgba(255,148,40,0)");
  ctx.fillStyle = orangeGlow;
  ctx.fillRect(0, 0, 1080, 1080);

  // Ljubičasti sjaj, donji desni kut — suprotan kut, manji i suptilniji.
  const purpleGlow = ctx.createRadialGradient(1150, 980, 20, 1150, 980, 700);
  purpleGlow.addColorStop(0, "rgba(134,52,205,0.4)");
  purpleGlow.addColorStop(1, "rgba(134,52,205,0)");
  ctx.fillStyle = purpleGlow;
  ctx.fillRect(0, 0, 1080, 1080);

  // Stakleni sjaj gore desno, daleko od teksta gore lijevo (isti razlog kao
  // .owner-hero pozadina u globals.css — sjaj preko teksta guta čitljivost).
  const glow = ctx.createRadialGradient(980, 40, 20, 980, 40, 680);
  glow.addColorStop(0, "rgba(255,255,255,0.22)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1080, 1080);

  addGrain(ctx, 1080, 1080);

  // Sitan "logo" lockup gore lijevo — krug s N + wordmark, umjesto gole
  // rečenice teksta (djeluje kao pravi brand-report, ne generička poruka).
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.beginPath();
  ctx.arc(90, 88, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 26px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", 90, 90);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "600 26px system-ui, -apple-system, sans-serif";
  ctx.fillText("NOVO — mjesečni izvještaj", 132, 82);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "500 22px system-ui, -apple-system, sans-serif";
  ctx.fillText(stats.subtitle ? stats.subtitle : "probajnovo.com", 132, 110);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 40px system-ui, -apple-system, sans-serif";
  ctx.fillText(stats.monthLabel, 72, 210);

  // Glavna brojka — neto zarada, s mekom sjenom za dubinu (ne za čitljivost
  // — kontrast već garantira navy podloga, sjena samo daje "print" osjećaj).
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "600 26px system-ui, -apple-system, sans-serif";
  ctx.fillText("NETO ZARADA", 72, 300);
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 128px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${stats.netEur} €`, 68, 420);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  if (stats.deltaPct !== null) {
    ctx.fillStyle = stats.deltaPct >= 0 ? "rgba(216,255,224,0.95)" : "rgba(255,224,216,0.95)";
    ctx.font = "600 28px system-ui, -apple-system, sans-serif";
    ctx.fillText(
      `${stats.deltaPct >= 0 ? "▲" : "▼"} ${Math.abs(stats.deltaPct)}% vs prošli mjesec`,
      72,
      468
    );
  }

  // Staklene "kartice" sa sitnim statistikama pri dnu — sad s rubom,
  // sjenom i obojenom trakom na vrhu (isti duh kao .owner-stat-card u
  // globals.css: svaka kartica dobiva vlastiti identitet umjesto da su
  // dvije identične prozirne pločice).
  const cardY = 620;
  const cardH = 210;
  const gap = 24;
  const cardW = (1080 - 72 * 2 - gap) / 2;
  const accentColors = ["#ff9428", "#ffffff"];

  [72, 72 + cardW + gap].forEach((cardX, i) => {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 14;
    ctx.fillStyle = "rgba(255,255,255,0.13)";
    roundedRect(ctx, cardX, cardY, cardW, cardH, 28);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1.5;
    roundedRect(ctx, cardX, cardY, cardW, cardH, 28);
    ctx.stroke();

    // Obojena traka na vrhu kartice.
    ctx.save();
    roundedRect(ctx, cardX, cardY, cardW, cardH, 28);
    ctx.clip();
    ctx.fillStyle = accentColors[i];
    ctx.globalAlpha = 0.85;
    ctx.fillRect(cardX, cardY, cardW, 4);
    ctx.restore();
  });

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "600 22px system-ui, -apple-system, sans-serif";
  ctx.fillText("DANA ZAUZETO", 72 + 32, cardY + 56);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 54px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${stats.currentDays}/${stats.goalDays}`, 72 + 32, cardY + 122);
  // Mini traka napretka prema cilju — isti vizualni jezik kao owner-goal-track.
  const goalPct = stats.goalDays > 0 ? Math.min(1, stats.currentDays / stats.goalDays) : 0;
  const trackX = 72 + 32;
  const trackY = cardY + 150;
  const trackW = cardW - 64;
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  roundedRect(ctx, trackX, trackY, trackW, 10, 5);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  roundedRect(ctx, trackX, trackY, Math.max(10, trackW * goalPct), 10, 5);
  ctx.fill();

  const streakCardX = 72 + cardW + gap;
  // Mala kružna "chip" ikona za plamen — isti duh kao owner-badge-icon.
  ctx.fillStyle = "rgba(255,148,40,0.9)";
  ctx.beginPath();
  ctx.arc(streakCardX + 32 + 18, cardY + 42, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "22px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🔥", streakCardX + 32 + 18, cardY + 43);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "600 22px system-ui, -apple-system, sans-serif";
  ctx.fillText("NIZ DANA", streakCardX + 32 + 46, cardY + 49);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 54px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    `${stats.streak} ${stats.streak === 1 ? "dan" : "dana"}`,
    streakCardX + 32,
    cardY + 122
  );

  // Suptilna razdjelnica + footer wordmark.
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(72, 970);
  ctx.lineTo(1080 - 72, 970);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 22px system-ui, -apple-system, sans-serif";
  ctx.fillText("probajnovo.com", 72, 1010);

  return canvas;
}

/**
 * Gumb za dijeljenje mjesečnog izvještaja kao slike — iscrtava brendirani
 * PNG na <canvas>-u u memoriji (drawReportCanvas gore) i nudi ga preko Web
 * Share API-ja (mobitel — izravno u poruke/društvene mreže), s padom na
 * obično preuzimanje datoteke ako Web Share nije podržan (desktop). Bez
 * novih npm paketa, bez slanja bilo čega na server. */
export default function OwnerShareReport({ stats }: { stats: ShareStats }) {
  const [busy, setBusy] = useState(false);

  async function handleShare() {
    setBusy(true);
    try {
      const canvas = drawReportCanvas(stats);
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;
      const fileName = `novo-izvjestaj-${stats.monthLabel.replace(/\s+/g, "-").toLowerCase()}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: "NOVO — mjesečni izvještaj", text: stats.monthLabel });
          return;
        } catch {
          // Korisnik je otkazao dijeljenje ili je share odbio — padamo na
          // preuzimanje niže umjesto tihog neuspjeha.
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={busy}
      className="owner-glass owner-glass-interactive rounded-full px-4 py-2 text-xs font-semibold flex items-center gap-2 disabled:opacity-60"
      style={{ color: "var(--od-ink)" }}
    >
      {busy ? "Priprema…" : "↗ Podijeli izvještaj"}
    </button>
  );
}
