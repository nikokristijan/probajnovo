/**
 * Tanki wrapper oko Nominatim-a (OpenStreetMap-ov besplatni geocoding servis,
 * bez API ključa) za automatsko pretvaranje unesene adrese vikendice u
 * koordinate — vidi app/[slug]/page.tsx za kako se te koordinate koriste za
 * ugrađenu OpenStreetMap kartu na "Lokacija" sekciji.
 *
 * Isti "best effort" duh kao lib/email.ts i lib/translate.ts: ako Nominatim
 * padne, vrati grešku, ili nema rezultata, funkcija vraća `null` — pozivatelj
 * (lib/actions.ts) se tad tiho vraća na stare koordinate (ako postoje) ili na
 * "nema karte", nikad ne ruši spremanje vikendice.
 *
 * Nominatim-ova pravila korištenja (https://operations.osmfoundation.org/policies/nominatim/)
 * traže identificirajući User-Agent i max ~1 zahtjev/sekundu — mi geokodiramo
 * samo kad admin stvarno promijeni adresu (vidi resolveCoordinates), pa je to
 * u praksi rijetko i daleko ispod limita.
 */

export type Coordinates = { latitude: string; longitude: string };

export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url, {
      headers: {
        // Nominatim traži identificirajući User-Agent — vidi napomenu iznad.
        "User-Agent": "NOVO-probajnovo/1.0 (probajnovo.com)",
      },
    });

    if (!res.ok) {
      console.error("[geocodeAddress] Nominatim je vratio status", res.status);
      return null;
    }

    const data = (await res.json()) as { lat?: string; lon?: string }[];
    const first = data[0];
    if (!first?.lat || !first?.lon) return null;

    return { latitude: first.lat, longitude: first.lon };
  } catch (err) {
    console.error("[geocodeAddress] Nominatim poziv nije uspio:", err);
    return null;
  }
}

/**
 * Odlučuje treba li (ponovno) geokodirati adresu ili samo zadržati postojeće
 * koordinate — poziva se iz create/updatePropertyAction u lib/actions.ts.
 *
 * - Nema adrese → nema karte (null, null).
 * - Adresa je ista kao prije I već imamo koordinate → ništa se ne mijenja,
 *   ne trošimo nepotreban poziv na Nominatim.
 * - Adresa je nova/promijenjena → pokušaj geokodirati; ako Nominatim padne,
 *   radije zadrži stare koordinate (ako postoje) nego da karta nestane zbog
 *   privremenog mrežnog problema.
 */
export async function resolveCoordinates(
  address: string | null,
  previous?: { address: string | null; latitude: string | null; longitude: string | null }
): Promise<Coordinates | { latitude: null; longitude: null }> {
  if (!address) return { latitude: null, longitude: null };

  if (previous && previous.address === address && previous.latitude && previous.longitude) {
    return { latitude: previous.latitude, longitude: previous.longitude };
  }

  const geo = await geocodeAddress(address);
  if (geo) return geo;

  if (previous?.latitude && previous?.longitude) {
    return { latitude: previous.latitude, longitude: previous.longitude };
  }
  return { latitude: null, longitude: null };
}
