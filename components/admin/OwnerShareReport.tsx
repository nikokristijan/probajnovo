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

/** Iscrtava brendirani 1080×1080 PNG sažetak mjeseca na <canvas>-u, u
    memoriji (bez servera, bez novih npm paketa) — vidi handleShare niže. */
function drawReportCanvas(stats: ShareStats): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d")!;

  // Pozadina — isti gradient duh kao .owner-hero u globals.css.
  const bg = ctx.createLinearGradient(0, 0, 1080, 1080);
  bg.addColorStop(0, "#0000c3");
  bg.addColorStop(0.45, "#3a1aa0");
  bg.addColorStop(0.68, "#6a21b0");
  bg.addColorStop(1, "#ff7f00");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1080);

  // Meki sjaj gore lijevo, isti kao staklena kartica.
  const glow = ctx.createRadialGradient(140, 60, 20, 140, 60, 620);
  glow.addColorStop(0, "rgba(255,255,255,0.35)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1080, 1080);

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "600 30px system-ui, -apple-system, sans-serif";
  ctx.fillText("NOVO — mjesečni izvještaj", 72, 110);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 42px system-ui, -apple-system, sans-serif";
  ctx.fillText(stats.monthLabel, 72, 168);
  if (stats.subtitle) {
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "500 26px system-ui, -apple-system, sans-serif";
    ctx.fillText(stats.subtitle, 72, 204);
  }

  // Glavna brojka — neto zarada.
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "600 26px system-ui, -apple-system, sans-serif";
  ctx.fillText("NETO ZARADA", 72, 340);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 128px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${stats.netEur} €`, 68, 460);
  if (stats.deltaPct !== null) {
    ctx.fillStyle = stats.deltaPct >= 0 ? "#d8ffe0" : "#ffe0d8";
    ctx.font = "600 30px system-ui, -apple-system, sans-serif";
    ctx.fillText(
      `${stats.deltaPct >= 0 ? "▲" : "▼"} ${Math.abs(stats.deltaPct)}% vs prošli mjesec`,
      72,
      510
    );
  }

  // Staklene "kartice" sa sitnim statistikama pri dnu.
  const cardY = 700;
  const cardH = 190;
  const gap = 24;
  const cardW = (1080 - 72 * 2 - gap) / 2;

  ctx.fillStyle = "rgba(255,255,255,0.14)";
  roundedRect(ctx, 72, cardY, cardW, cardH, 28);
  ctx.fill();
  roundedRect(ctx, 72 + cardW + gap, cardY, cardW, cardH, 28);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "600 24px system-ui, -apple-system, sans-serif";
  ctx.fillText("DANA ZAUZETO", 72 + 28, cardY + 56);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 56px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${stats.currentDays}/${stats.goalDays}`, 72 + 28, cardY + 128);

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "600 24px system-ui, -apple-system, sans-serif";
  ctx.fillText("NIZ DANA", 72 + cardW + gap + 28, cardY + 56);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 56px system-ui, -apple-system, sans-serif";
  ctx.fillText(`🔥 ${stats.streak}`, 72 + cardW + gap + 28, cardY + 128);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 24px system-ui, -apple-system, sans-serif";
  ctx.fillText("probajnovo.com", 72, 1000);

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
