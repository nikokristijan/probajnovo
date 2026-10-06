import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getNfcTagBySlug } from "@/lib/db/queries";
import NfcGuestCard from "@/components/NfcGuestCard";

export const revalidate = 0;

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getNfcTagBySlug(slug);
  if (!tag || !tag.published) {
    return { title: "NFC — NOVO", robots: { index: false, follow: false } };
  }
  return {
    title: tag.welcomeTitle || `WiFi — ${tag.label}`,
    // Namjerno noindex/nofollow (i vidi app/robots.ts disallow "/nfc") —
    // ovo je privatna WiFi stranica za goste s fizičkom pločicom u ruci,
    // ne javna marketinška stranica; ne treba se pojavljivati u tražilicama
    // (curi naziv WiFi mreže) niti ući u sitemap.xml.
    robots: { index: false, follow: false },
    icons: { icon: "/favicon-orange.png" },
  };
}

export default async function NfcTagPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const tag = await getNfcTagBySlug(slug);
  if (!tag || !tag.published) notFound();

  const accentStyle = { "--nfc-accent": tag.accentColor } as React.CSSProperties;

  return (
    <div className="nfc-page" style={accentStyle}>
      <NfcGuestCard tag={tag} />
    </div>
  );
}
