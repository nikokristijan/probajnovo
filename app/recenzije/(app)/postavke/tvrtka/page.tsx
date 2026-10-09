import { redirect } from "next/navigation";

/** Podaci tvrtke sada su na glavnoj stranici Postavki; stara adresa ostaje da stari linkovi i oznake rade. */
export default function BusinessRedirect() {
  redirect("/recenzije/postavke");
}
