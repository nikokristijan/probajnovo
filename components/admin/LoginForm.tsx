"use client";

import { useActionState, useState } from "react";
import { loginAction, type ActionState } from "@/lib/actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
loginAction,
undefined
);
const [email, setEmail] = useState("");

return (
<form action={action} className="flex flex-col gap-4 max-w-sm">
<div className="flex flex-col gap-1.5">
<label htmlFor="email" className="text-sm font-medium">
Email
</label>
<input
id="email"
name="email"
type="email"
value={email}
onChange={(e) => setEmail(e.target.value)}
required
autoComplete="username"
className="border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0000c3]"
/>
</div>
<div className="flex flex-col gap-1.5">
<label htmlFor="password" className="text-sm font-medium">
Lozinka
</label>
<input
id="password"
name="password"
type="password"
required
autoComplete="current-password"
className="border border-black/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0000c3]"
/>
</div>
{state?.error && <p className="text-sm text-red-600">{state.error}</p>}
<button
type="submit"
disabled={pending}
className="rounded-full bg-black text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-50"
>
{pending ? "Prijava…" : "Prijavi se"}
</button>
</form>
);
}
