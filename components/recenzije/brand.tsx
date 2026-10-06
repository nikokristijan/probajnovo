import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/recenzije/utils";

/** NOVO logo (isti kao na probajnovo.com) + mono oznaka proizvoda. */
export function Logo({ href = "/recenzije", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-3", className)} aria-label="NOVO Recenzije">
      <Image src="/novo-logo.png" alt="NOVO" width={1474} height={497} className="h-[22px] w-auto" priority />
      <span className="label border-l border-border-strong pl-3 text-foreground">Recenzije</span>
    </Link>
  );
}
