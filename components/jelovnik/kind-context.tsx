"use client";

import { createContext, useContext } from "react";
import type { MenuKind } from "@/lib/recenzije/menu-noun";

/**
 * Vrsta stranice ("jelovnik" ili "meni") za komponente koje nemaju podatke o lokalu u propsima (kostur učitavanja, granica
 * greške unutar [slug]). Layout [slug] ju postavlja nakon što učita lokal. Izvan layouta (npr. greška samog layouta, 404)
 * vrijednost je null, pa tamo stoji neutralan tekst koji ne imenuje ni jedno ni drugo.
 */
const KindContext = createContext<MenuKind | null>(null);

export function MenuKindProvider({ kind, children }: { kind: MenuKind; children: React.ReactNode }) {
  return <KindContext.Provider value={kind}>{children}</KindContext.Provider>;
}

export function useMenuKind(): MenuKind | null {
  return useContext(KindContext);
}
