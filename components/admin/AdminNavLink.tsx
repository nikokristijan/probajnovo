"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * Nav link koji zna je li TRENUTNA stranica — na izričit zahtjev ("kada se
 * klikne nesta u navbaru nek ta tipka izgleda kliknuto dok je korisnik u toj
 * sekciji"). Layout (app/admin/layout.tsx) je async Server Component pa ne
 * može čitati pathname izravno — ovaj mali "use client" wrapper je jedini
 * dio nava koji treba znati rutu, ostatak izbornika ostaje server-rendered.
 * aria-current="page" nosi i stil (.neu-nav > a[aria-current="page"] u
 * globals.css, trajna "utisnuta" sjena) i pristupačnost (screen readeri
 * najavljuju "trenutna stranica") u jednom atributu.
 *
 * exact=true samo za "/admin" ("Početna"/"Pregled") — bez toga bi
 * pathname.startsWith("/admin/") značio da je TA stavka uvijek aktivna na
 * svakoj drugoj admin stranici. Za sve ostalo (npr. "/admin/vikendice")
 * prefiks-podudaranje je namjerno: ostaje aktivno i na
 * /admin/vikendice/123 (detalj), ne samo na točnoj listi.
 */
export function AdminNavLink({
  href,
  exact = false,
  children,
  ...rest
}: ComponentProps<typeof Link> & { href: string; exact?: boolean }) {
  const pathname = usePathname();
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link href={href} aria-current={isActive ? "page" : undefined} {...rest}>
      {children}
    </Link>
  );
}

export default AdminNavLink;
