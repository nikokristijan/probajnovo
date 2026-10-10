"use client";

/**
 * Granica greške za cijeli /jelovnik. [slug]/layout.tsx čita bazu PRIJE stranice, a error.tsx unutar [slug] ne hvata
 * greške vlastitog layouta: bez ove datoteke bi gost pri kratkom ispadu baze vidio potpuno praznu stranicu.
 * Isti prikaz kao [slug]/error.tsx (kratka poruka i gumb za ponovni pokušaj).
 */
export { default } from "./[slug]/error";
