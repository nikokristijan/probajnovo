import "server-only";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { organizations } from "@/lib/recenzije/db/schema";
import { menuPublicUrl } from "@/lib/recenzije/services/menus";

/**
 * Podaci o ugostiteljstvu za karticu klijenta u /admin/recenzije: je li klijent lokal, adresa njegova javnog jelovnika
 * i koliko je brojeva gostiju stiglo u zadnjih 30 dana. Jedan upit za cijeli popis (bez N+1). Samo čita: ne stvara
 * jelovnik (to radi otvaranje radnog prostora), a ne vraća brojeve telefona ni ikakve podatke o pojedinim gostima.
 * Pozivatelj je dužan prije toga provjeriti da je admin glavni admin.
 */

export type AdminVenueInfo = {
  isVenue: boolean;
  /** null dok jelovnik nije otvoren (nastaje pri prvom otvaranju radnog prostora, ili odmah pri otvaranju lokala). */
  slug: string | null;
  menuEnabled: boolean;
  publicUrl: string | null;
  /** Unosi brojeva s jelovnika u zadnjih 30 dana (uključuje i one koji nisu zakazani). */
  guests30d: number;
  /** Od toga zakazanih poruka s molbom za recenziju. */
  scheduled30d: number;
};

export async function getAdminVenueInfo(orgIds: string[]): Promise<Map<string, AdminVenueInfo>> {
  const out = new Map<string, AdminVenueInfo>();
  if (orgIds.length === 0) return out;
  await ensureReviewsDb();

  const rows = await db
    .select({
      id: organizations.id,
      isVenue: organizations.isVenue,
      slug: sql<string | null>`(select m.slug from nr_menus m where m.organization_id = "nr_organizations"."id" limit 1)`,
      menuEnabled: sql<boolean | null>`(select m.enabled from nr_menus m where m.organization_id = "nr_organizations"."id" limit 1)`,
      guests30d: sql<number>`(select count(*)::int from nr_menu_guests g where g.organization_id = "nr_organizations"."id" and g.created_at >= now() - interval '30 days')`,
      scheduled30d: sql<number>`(select count(*)::int from nr_menu_guests g where g.organization_id = "nr_organizations"."id" and g.outcome = 'scheduled' and g.created_at >= now() - interval '30 days')`,
    })
    .from(organizations)
    .where(inArray(organizations.id, orgIds));

  for (const r of rows) {
    out.set(r.id, {
      isVenue: r.isVenue,
      slug: r.isVenue ? r.slug : null,
      menuEnabled: r.menuEnabled ?? false,
      publicUrl: r.isVenue && r.slug ? menuPublicUrl(r.slug) : null,
      guests30d: r.isVenue ? r.guests30d : 0,
      scheduled30d: r.isVenue ? r.scheduled30d : 0,
    });
  }
  return out;
}
