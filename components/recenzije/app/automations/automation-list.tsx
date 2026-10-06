"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createAutomationAction, toggleAutomationAction } from "@/lib/recenzije/actions/automations";
import { Switch } from "@/components/recenzije/ui/dialog";

export function AutomationToggle({ id, enabled, name }: { id: string; enabled: boolean; name: string }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  return (
    <Switch
      checked={on}
      disabled={pending}
      label={`${name} enabled`}
      onCheckedChange={(v) => {
        setOn(v);
        start(async () => {
          const r = await toggleAutomationAction(id, v);
          if (r.ok) toast.success(r.message);
          else {
            setOn(!v);
            toast.error(r.error);
          }
        });
      }}
    />
  );
}

export function TemplateCard({ templateKey, name, description, steps }: { templateKey: string; name: string; description: string; steps: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => createAutomationAction(templateKey))}
      className="group flex h-full flex-col border border-border bg-white p-4 text-left transition-colors hover:border-foreground disabled:opacity-60"
    >
      <span className="font-bold group-hover:underline">{name}</span>
      <span className="mt-1 flex-1 text-[13px] text-muted">{description}</span>
      <span className="label mt-3 text-subtle">{pending ? "Stvaram…" : steps}</span>
    </button>
  );
}

export function EditLink({ id }: { id: string }) {
  return (
    <Link href={`/recenzije/automatizacije/${id}`} className="text-[13px] text-muted hover:text-foreground">
      Uredi →
    </Link>
  );
}
