# NOVO / probajnovo.com

Cijela platforma za agenciju NOVO: naslovna stranica agencije, stranice za svaku
vikendicu (`novo.hr/naziv-vikendice`) i skriveni admin (`/admin`) za uređivanje
teksta bez diranja koda.

## Tehnologije

- **Next.js 16** (App Router, Turbopack)
- **PostgreSQL** + **Drizzle ORM** (bez native binarnih ovisnosti — radi svugdje)
- **Server Actions** za sve admin izmjene (bez zasebnog API-ja)
- Sesije prijave: potpisan httpOnly kolačić (JWT, `jose`), lozinke hashirane s `bcryptjs`

## Struktura

- `app/page.tsx` — naslovna stranica agencije
- `app/[slug]/page.tsx` — stranica pojedine vikendice (`/sokak-bez-imena` itd.)
- `app/admin/*` — admin sučelje (zaštićeno prijavom, nije linkano nigdje na javnoj stranici)
- `proxy.ts` — štiti sve `/admin/*` rute (preusmjeri na `/admin/login` ako nisi prijavljen)
- `lib/db/schema.ts` — struktura baze (agency, properties, adminUsers)
- `lib/actions.ts` — sve Server Actions (login, uređivanje agencije, CRUD vikendica)
- `scripts/seed.ts` — postavi prvi admin račun i primjer vikendice

## Lokalno pokretanje

1. `npm install`
2. Kopiraj `.env.example` u `.env` i popuni prave vrijednosti (vidi komentare u datoteci)
3. `npm run db:migrate` — napravi tablice u bazi
4. `npm run db:seed` — napravi prvi admin račun (koristi `ADMIN_EMAIL`/`ADMIN_PASSWORD` iz `.env`) i jednu primjer vikendicu
5. `npm run dev` — pokreni na `http://localhost:3000`

Admin je na `http://localhost:3000/admin` (nije linkan nigdje na javnoj stranici — namjerno).

## Deployment

Pogledaj `DEPLOYMENT.md` za detaljne korake (GitHub → Supabase → Vercel → domena).
