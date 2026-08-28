import LoginForm from "@/components/admin/LoginForm";

export default function AdminLoginPage() {
return (
<div>
<h1 className="text-xl font-bold mb-1">Prijava</h1>
<p className="text-sm text-black/60 mb-6">
Prijavi se da uređuješ sadržaj novo.hr stranice.
</p>
<LoginForm />
</div>
);
}
