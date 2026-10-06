import Link from "next/link";
import { ForgotForm } from "@/components/recenzije/auth/forms";

export const metadata = { title: "Nova lozinka" };

export default function ForgotPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Zaboravljena lozinka</h1>
      <p className="mt-2 text-[15px] text-muted">Poslat ćemo vam poveznicu za novu lozinku.</p>
      <div className="mt-8">
        <ForgotForm />
      </div>
      <p className="mt-8 text-sm">
        <Link href="/recenzije/prijava" className="label text-muted hover:text-foreground">
          ← Natrag na prijavu
        </Link>
      </p>
    </div>
  );
}
