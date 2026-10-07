/**
 * NOVO Recenzije se vodi kao usluga: klijenti nemaju prijavu, sve radi NOVO tim
 * iz admina. "Operator" je interni korisnik pod kojim NOVO tim otvara radni
 * prostor klijenta (gumb "Otvori" u /admin/recenzije). Nema lozinku i ne može se
 * prijaviti običnom prijavom ni resetom lozinke.
 */
export const OPERATOR_EMAIL = "operator@novo.internal";
export const OPERATOR_NAME = "NOVO tim";
