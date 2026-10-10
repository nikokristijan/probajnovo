import Link from "next/link";
import { menuNoun, type MenuKind } from "@/lib/recenzije/menu-noun";

/** Mala oznaka (velika slova, razmaknuta slova) s tankim crtama sa strane. */
export function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="jl-kicker">{children}</p>;
}

/** Podnožje javnih stranica jelovnika: nenametljivo, s poveznicom na privatnost. Bez prefetcha: gost ne treba da mu mobilni promet troše tuđe stranice. */
export function Footer({ kind }: { kind?: MenuKind | null }) {
  return (
    <footer className="jl-foot">
      <div className="jl-wrap jl-foot-in">
        <Link href="/recenzije" prefetch={false} className="jl-foot-link">
          {kind ? `${menuNoun(kind).Nom}: NOVO` : "NOVO Recenzije"}
        </Link>
        <Link href="/privatnost" prefetch={false} className="jl-foot-link">
          Privatnost
        </Link>
      </div>
    </footer>
  );
}
