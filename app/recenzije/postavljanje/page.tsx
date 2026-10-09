import { permanentRedirect } from "next/navigation";

/**
 * Samostalnog postavljanja više nema: sve za klijente postavlja NOVO tim iz admina.
 * Ruta ostaje samo da stari linkovi ne završe na 404.
 */
export default function OnboardingGonePage() {
  permanentRedirect("/recenzije");
}
