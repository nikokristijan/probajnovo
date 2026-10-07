import { redirect } from "next/navigation";

/** Samostalna registracija je zatvorena: uslugu postavlja NOVO, pa ovdje vodi na upit. */
export default function SignupPage() {
  redirect("/recenzije#ponuda");
}
