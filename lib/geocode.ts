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

/** Poruka kad je adresa unesena ali Nominatim (ni uz fallback na šire
 *  verzije adrese) nije uspio pronaći koordinate.
 *  Namjerno NIJE u lib/actions.ts: taj file ima "use server" na vrhu, pa
 *  Next.js tretira SVAKI export iz njega kao Server Action i traži da bude
 *  async funkcija — geoMissWarning je obična sinkrona funkcija, pa build
 *  pada ako je izvezena odande. Zato živi ovdje (lib/geocode.ts nema
 *  "use server") i lib/actions.ts je samo poziva/re-eksportira po potrebi. */
export function geoMissWarning(address: string): string {
  return `Vikendica je spremljena, ali karta se nije mogla automatski pronaći za adresu "${address}" — OpenStreetMap je nije prepoznao. Probaj dodati ime mjesta/grada (npr. "…, Vrsar") ili ručno upiši poveznicu pod "Poveznica na mapu" ispod.`;
}

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gradi listu sve "širih" verzija adrese za pokušaj geokodiranja — korisno
 * kad je unesena neimenovana ulica/zaselak/sokak (čest slučaj kod vikendica
 * u manjim mjestima) koji Nominatim ne prepoznaje po imenu, ali samo mjesto
 * prepoznaje. Npr. "Sokak bez imena 5, Vrsar" prvo pokuša cijelu adresu, pa
 * ako to ne uspije, probaj samo "Vrsar".
 *
 * Pretpostavlja da su dijelovi adrese odvojeni zarezima, od najdetaljnijeg
 * (ulica/broj) do najšireg (mjesto/država) — isti redoslijed kao placeholder
 * u admin formi ("Bukovlje 45, Slavonski Brod").
 */
function widenedCandidates(address: string): string[] {
  const segments = address
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const candidates = segments.map((_, i) => segments.slice(i).join(", "));

  if (!/hrvatsk|croatia/i.test(address)) {
    candidates.push(`${address}, Hrvatska`);
    if (segments.length > 1) {
      candidates.push(`${segments[segments.length - 1]}, Hrvatska`);
    }
  }

  return Array.from(new Set(candidates));
}

/**
 * Isto kao geocodeAddress, ali uz progresivni fallback preko
 * widenedCandidates — ako puna adresa ne da rezultat, pokušava redom šire
 * verzije (npr. bez naziva ulice, samo mjesto) dok jedna ne upali ili sve ne
 * promaše. Poziva se iz resolveCoordinates ispod.
 */
async function geocodeWithFallback(address: string): Promise<Coordinates | null> {
  const candidates = widenedCandidates(address);

  for (let i = 0; i < candidates.length; i++) {
    const result = await geocodeAddress(candidates[i]);
    if (result) return result;
    // Nominatim traži max ~1 zahtjev/sekundu — kratka pauza između pokušaja.
    if (i < candidates.length - 1) await sleep(1100);
  }

  return null;
}

/**
 * Odlučuje treba li (ponovno) geokodirati adresu ili samo zadržati postojeće
 * koordinate — poziva se iz create/updatePropertyAction u lib/actions.ts.
 *
 * - Nema adrese → nema karte (null, null).
 * - Adresa je ista kao prije I već imamo koordinate → ništa se ne mijenja,
 *   ne trošimo nepotreban poziv na Nominatim.
 * - Adresa je nova/promijenjena → pokušaj geokodirati (uz fallback na šire
 *   verzije adrese); ako sve promaši, radije zadrži stare koordinate (ako
 *   postoje) nego da karta nestane zbog privremenog mrežnog problema.
 */
export async function resolveCoordinates(
  address: string | null,
  previous?: { address: string | null; latitude: string | null; longitude: string | null }
): Promise<Coordinates | { latitude: null; longitude: null }> {
  if (!address) return { latitude: null, longitude: null };

  if (previous && previous.address === address && previous.latitude && previous.longitude) {
    return { latitude: previous.latitude, longitude: previous.longitude };
  }

  const geo = await geocodeWithFallback(address);
  if (geo) return geo;

  if (previous?.latitude && previous?.longitude) {
    return { latitude: previous.latitude, longitude: previous.longitude };
  }
  return { latitude: null, longitude: null };
}
