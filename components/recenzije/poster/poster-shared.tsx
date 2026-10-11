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

/** Preuzimanje običnog teksta (.csv, .txt) kao datoteke. */
export function saveText(fileName: string, text: string, mime: "text/csv" | "text/plain") {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Preuzeto: ${fileName}`);
  } catch {
    toast.error("Preuzimanje nije uspjelo. Pokušajte ponovno ili kopirajte adrese.");
  }
}

/** Kopira tekst u međuspremnik i javlja ishod. Vraća true kad je uspjelo. */
export async function copyText(value: string, done = "Kopirano"): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(done);
    return true;
  } catch {
    toast.error("Kopiranje nije uspjelo. Označite tekst i kopirajte ručno.");
    return false;
  }
}

export function CopyLinkButton({ value }: { value: string }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-11 sm:pointer-fine:h-11"
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
