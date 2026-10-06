import { Logo } from "@/components/recenzije/brand";
import { OnboardingForm } from "@/components/recenzije/onboarding-form";
import { requireUser } from "@/lib/recenzije/session";

export const metadata = { title: "Postavljanje" };

export default async function OnboardingPage() {
  const user = await requireUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center border-b border-border px-4 sm:px-6">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-[520px] px-4 py-12 sm:px-0">
        <p className="label mb-3 flex items-center gap-2 text-muted">
          <span className="size-1.5 bg-orange" /> Korak 1 od 1
        </p>
        <h1 className="text-3xl font-bold">
          {user.name ? `Bok, ${user.name.split(" ")[0]}. ` : ""}Recite nam nešto o svojoj tvrtki.
        </h1>
        <p className="mt-2 text-[15px] text-muted">Odmah ćemo uključiti automatizaciju koja nakon svakog posla traži recenziju.</p>
        <div className="mt-8 border border-border p-5 sm:p-6">
          <OnboardingForm />
        </div>
      </main>
    </div>
  );
}
