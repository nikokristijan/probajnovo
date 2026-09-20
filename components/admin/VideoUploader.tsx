"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

/**
 * Upload jednog video-fajla izravno iz preglednika u Vercel Blob (isti
 * pattern kao ImageUploader — mimo servera, pa nema limita veličine kao kod
 * Server Actiona). Koristi se za video proizvoda: admin uploada snimku
 * umjesto da lijepi YouTube/Vimeo poveznicu.
 */
export default function VideoUploader({
  label,
  helpText,
  value,
  onChange,
}: {
  label: string;
  helpText?: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
      });
      onChange(blob.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload videa nije uspio.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {helpText && <span className="text-xs text-black/50">{helpText}</span>}

      {value && (
        <div className="flex items-center gap-3">
          <video src={value} controls className="w-40 rounded-lg border border-black/10 bg-black" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-red-600 underline"
          >
            Ukloni video
          </button>
        </div>
      )}

      <label className="self-start rounded-full border border-black/20 px-4 py-2 text-sm cursor-pointer hover:border-black transition-colors">
        {busy ? "Uploadam…" : value ? "Zamijeni video" : "+ Dodaj video"}
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files)}
          disabled={busy}
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
