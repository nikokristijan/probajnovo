import LoginForm from "@/components/admin/LoginForm";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ lozinka?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Prijava</h1>
      <p className="text-sm text-black/60 mb-6">Prijavi se u NOVO admin.</p>
      {sp.lozinka === "postavljena" && (
        <p className="text-sm mb-5 max-w-sm rounded-lg border border-[#0a7a3e]/30 bg-[#0a7a3e]/5 px-3 py-2" role="status">
          Lozinka je spremljena. Prijavi se s njom i kodom iz aplikacije za autentikaciju.
        </p>
      )}
      <LoginForm />
    </div>
  );
}
