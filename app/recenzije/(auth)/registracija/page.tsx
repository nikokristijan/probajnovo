import { permanentRedirect } from "next/navigation";

/**
 * Registracije više nema: NOVO Recenzije je usluga koju vodi NOVO tim, a klijenti
 * nemaju račun. Stari linkovi i oglasi vode na ponudu.
 */
export default function SignupGonePage() {
  permanentRedirect("/recenzije");
}
