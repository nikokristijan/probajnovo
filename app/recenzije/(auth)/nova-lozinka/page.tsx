import Link from "next/link";
import { ResetForm } from "@/components/recenzije/auth/forms";

export const metadata = { title: "Nova lozinka" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div>
      <h1 className="text-3xl font-bold">Nova lozinka</h1>
      <div className="mt-8">
        {token ? (
          <ResetForm token={token} />
        ) : (
          <p className="border-l-[3px] border-danger bg-danger-soft p-3 text-sm text-danger">
            Poveznica nema token.{" "}
            <Link href="/recenzije/zaboravljena-lozinka" className="underline">
              Zatražite novu
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
