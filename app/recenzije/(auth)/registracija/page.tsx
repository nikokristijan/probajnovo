import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/recenzije/auth/forms";
import { OAuthButtons } from "@/components/recenzije/auth/oauth";
import { integrations } from "@/lib/recenzije/env";
import { getCurrentUser } from "@/lib/recenzije/session";

export const metadata = { title: "Besplatna proba" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/recenzije/pregled");
  return (
    <div>
      <p className="label mb-3 flex items-center gap-2 text-muted">
        <span className="size-1.5 bg-orange" /> Registracija
      </p>
      <h1 className="text-3xl font-bold">14 dana besplatno</h1>
      <p className="mt-2 text-[15px] text-muted">Postavljanje traje 5 minuta. Prvi zahtjev za recenziju možete poslati danas.</p>
      <div className="mt-8 space-y-4">
        <OAuthButtons googleEnabled={integrations.googleOAuth()} demoEnabled={false} />
        <SignupForm />
      </div>
      <p className="mt-8 text-sm text-muted">
        Već imate račun?{" "}
        <Link href="/recenzije/prijava" className="font-bold text-foreground underline underline-offset-4">
          Prijava
        </Link>
      </p>
    </div>
  );
}
