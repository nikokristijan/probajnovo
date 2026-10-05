"use client";

import { useState } from "react";

const PLATFORMS = [
  { key: "meta", label: "Facebook / Instagram", source: "facebook", medium: "paid_social" },
  { key: "google", label: "Google oglasi", source: "google", medium: "cpc" },
  { key: "tiktok", label: "TikTok", source: "tiktok", medium: "paid_social" },
  { key: "email", label: "E-mail kampanja", source: "newsletter", medium: "email" },
] as const;

/**
 * Link za oglas: adresa proizvoda + utm parametri. Kad gost s tog oglasa
 * pošalje upit, u poruci upita piše "— Izvor: source=facebook · campaign=…",
 * pa se vidi koji oglas donosi upite.
 */
export default function ProductAdLinks({ url, slug }: { url: string; slug: string }) {
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]["key"]>("meta");
  const [campaign, setCampaign] = useState(slug);
  const [copied, setCopied] = useState<string | null>(null);

  const p = PLATFORMS.find((x) => x.key === platform) ?? PLATFORMS[0];
  const camp = campaign.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "") || slug;
  const adUrl = `${url}?utm_source=${p.source}&utm_medium=${p.medium}&utm_campaign=${encodeURIComponent(camp)}`;

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      window.prompt("Kopiraj:", value);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-black/60">Adresa proizvoda</span>
        <div className="flex flex-wrap items-center gap-2">
          <a href={url} target="_blank" rel="noreferrer" className="text-sm font-medium underline break-all">
            {url}
          </a>
          <button type="button" className="rounded-full border border-black/20 text-xs font-semibold px-3 py-1" onClick={() => copy(url, "url")}>
            {copied === "url" ? "Kopirano" : "Kopiraj"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-black/60">
          Gdje se oglas prikazuje
          <select
            id="ad-platform"
            className="admin-input text-sm font-normal text-black"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as typeof platform)}
          >
            {PLATFORMS.map((x) => (
              <option key={x.key} value={x.key}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-black/60">
          Naziv kampanje
          <input
            id="ad-campaign"
            className="admin-input text-sm font-normal text-black"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="npr. nfc-listopad"
          />
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-black/60">Link za oglas</span>
        <code className="text-xs bg-black/5 rounded-lg px-3 py-2 break-all">{adUrl}</code>
        <button
          type="button"
          className="self-start rounded-full bg-black text-white text-sm font-semibold px-4 py-2"
          onClick={() => copy(adUrl, "ad")}
        >
          {copied === "ad" ? "Kopirano ✓" : "Kopiraj link za oglas"}
        </button>
      </div>
    </div>
  );
}
