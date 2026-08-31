"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

/**
 * Izreže sliku na kvadrat (centrirano) i smanji je na `size` × `size`
 * piksela, izlaz kao PNG File. Koristi se za favicon: admini inače uploadaju
 * punu fotografiju s telefona (nekoliko MB, tisuće piksela u širinu), a
 * preglednik takvu sliku kao tab-ikonu ili jako sporo dekodira ili je uopće
 * ne prikaže — otud "custom favicon ne radi" iako je link na sliku ispravan.
 * `imageOrientation: "from-image"` poštuje EXIF rotaciju (česta kod fotki s
 * telefona) da izrezani kvadrat ne ispadne zarotiran.
 */
async function resizeImageToSquare(file: File, size: number): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return file;

    return new File([blob], "favicon.png", { type: "image/png" });
  } catch {
    // Ako iz nekog razloga ne uspije (npr. stariji preglednik bez
    // createImageBitmap), radije uploadaj original nego da upload padne.
    return file;
  }
}

/**
 * Upload slika izravno iz preglednika u Vercel Blob (mimo servera, pa nema
 * limita veličine kao kod Server Actiona). Radi i za jednu sliku (banner)
 * i za više slika odjednom (galerija) — razlika je samo u `multiple` propu.
 */
export default function ImageUploader({
  label,
  helpText,
  multiple = false,
  value,
  onChange,
  resizeToSquare,
}: {
  label: string;
  helpText?: string;
  multiple?: boolean;
  value: string[];
  onChange: (urls: string[]) => void;
  /** Kad je postavljeno (npr. 256), svaka slika se prije uploada izreže na
   *  kvadrat i smanji na tu veličinu u pikselima — vidi resizeImageToSquare
   *  iznad. Koristi se samo za favicon; galerija/banner žele punu kvalitetu
   *  pa ovo ne postavljaju. */
  resizeToSquare?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const toUpload = resizeToSquare ? await resizeImageToSquare(file, resizeToSquare) : file;
        const blob = await upload(toUpload.name, toUpload, {
          access: "public",
          handleUploadUrl: "/api/blob/upload",
        });
        uploaded.push(blob.url);
      }
      onChange(multiple ? [...value, ...uploaded] : uploaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload slike nije uspio.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {helpText && <span className="text-xs text-black/50">{helpText}</span>}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((url, i) => (
            <div
              key={url + i}
              className="relative w-20 h-20 rounded-lg overflow-hidden border border-black/10 bg-black/5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="Ukloni sliku"
                className="absolute top-0.5 right-0.5 bg-black/70 text-white rounded-full w-5 h-5 text-xs leading-none flex items-center justify-center"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="self-start rounded-full border border-black/20 px-4 py-2 text-sm cursor-pointer hover:border-black transition-colors">
        {busy
          ? "Uploadam…"
          : multiple
            ? "+ Dodaj slike"
            : value.length > 0
              ? "Zamijeni sliku"
              : "+ Dodaj sliku"}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={busy}
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

