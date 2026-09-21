import Link from "next/link";
import LegalFooterLinks from "./LegalFooterLinks";

/**
 * Zajednički wrapper za 4 pravne stranice (privatnost/uvjeti/povrat/kolačići)
 * — isti topbar+wrap obrazac kao /proizvodi i /slova (.novo-product-page),
 * plus .novo-legal za čitljivu tipografiju dužeg pravnog teksta.
 */
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  /** Datum zadnje izmjene, npr. "21. rujna 2026." — prikazan ispod naslova. */
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="novo-product-page">
      <div className="novo-product-topbar">
        <Link href="/" className="novo-product-logo">NOVO</Link>
        <Link href="/" className="novo-product-back">← NASLOVNICA</Link>
      </div>
      <div className="novo-product-wrap novo-legal">
        <span className="novo-products-kicker">PRAVNO</span>
        <h1>{title}</h1>
        <p className="novo-legal-updated">Zadnja izmjena: {updated}</p>
        {children}
        <LegalFooterLinks />
      </div>
    </div>
  );
}
