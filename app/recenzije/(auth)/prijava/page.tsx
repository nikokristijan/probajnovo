import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { LoginForm } from "@/components/recenzije/auth/forms";
import { OAuthButtons } from "@/components/recenzije/auth/oauth";
import { env, integrations } from "@/lib/recenzije/env";
import { getCurrentUser } from "@/lib/recenzije/session";

export const metadata = { title: "Prijava" };

const ERRORS: Record<string, string> = {
  demo: "Demo trenutno nije dostupan. Pokušajte za minutu.",
  rate: "Previše pokušaja. Pokušajte ponovno za nekoliko minuta.",
  google: "Prijava Googleom nije uspjela. Pokušajte ponovno.",
  nopristup: "Za ovaj račun nema pristupa. Javite se NOVO-u.",
  google_off: "Prijava Googleom još nije uključena.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (await getCurrentUser()) redirect("/recenzije/pregled");
  const error = sp.error ? (ERRORS[sp.error] ?? "Prijava nije uspjela. Pokušajte ponovno.") : null;
  return (
    <div>
      <p className="label mb-3 flex items-center gap-2 text-muted">
        <span className="size-1.5 bg-orange" /> Prijava
      </p>
      <h1 className="text-3xl font-bold">Dobro došli natrag</h1>
      <p className="mt-2 text-[15px] text-muted">Prijava za pregled recenzija.</p>
      <div className="mt-8 space-y-4">
        {sp.reset && (
          <p className="flex items-center gap-2 border-l-[3px] border-success bg-success-soft p-3 text-sm">
            <CheckCircle2 className="size-4 text-success" /> Lozinka je promijenjena. Prijavite se novom lozinkom.
          </p>
        )}
        {error && (
          <p role="alert" className="border-l-[3px] border-danger bg-danger-soft p-3 text-sm text-danger">
            {error}
          </p>
        )}
        <OAuthButtons googleEnabled={integrations.googleOAuth()} demoEnabled={env.demoEnabled} />
        <LoginForm next={sp.next} />
      </div>
      <p className="mt-8 text-sm text-muted">
        Trebate pristup ili pomoć? Javite nam se na{" "}
        <a href={`mailto:${env.salesEmail}`} className="font-bold text-foreground underline underline-offset-4">
          {env.salesEmail}
        </a>
        .
      </p>
    </div>
  );
}
