"use client";

import { toast } from "sonner";
import { Button } from "@/components/recenzije/ui/button";

/** Preuzimanje SVG-a kao datoteke (isto za plakat za recenziju i za plakate jelovnika). */
export function saveSvg(fileName: string, svg: string) {
  try {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Preuzeto: ${fileName}`);
  } catch {
    toast.error("Preuzimanje nije uspjelo. Pokušajte ponovno ili koristite Ispiši.");
  }
}

export function CopyLinkButton({ value }: { value: string }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast.success("Kopirano");
        } catch {
          toast.error("Kopiranje nije uspjelo. Označite tekst i kopirajte ručno.");
        }
      }}
    >
      Kopiraj
    </Button>
  );
}
