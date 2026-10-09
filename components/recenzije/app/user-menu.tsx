"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Check, CircleUser, LogOut } from "lucide-react";
import { logoutAction } from "@/lib/recenzije/actions/auth";
import { switchOrganizationAction } from "@/lib/recenzije/actions/org";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/recenzije/ui/dialog";
import { Avatar } from "@/components/recenzije/ui/primitives";

export function UserMenu({
  name,
  email,
  orgs,
  activeOrgId,
  isOperator = false,
  showAccount = false,
}: {
  name: string;
  email: string;
  orgs: { id: string; name: string }[];
  activeOrgId: string;
  /** NOVO tim radi u ime klijenta: nema računa za uređivanje, a povratak vodi u admin. */
  isOperator?: boolean;
  /** Stranica "Račun" (lozinka) postoji samo za stare korisnike s računom. */
  showAccount?: boolean;
}) {
  const router = useRouter();
  return (
    <Menu>
      <MenuTrigger className="flex items-center rounded-full" aria-label="Izbornik računa">
        <Avatar name={name || email} className="size-9" />
      </MenuTrigger>
      <MenuContent>
        <div className="px-2.5 py-2">
          <p className="truncate text-sm font-bold">{name || "Račun"}</p>
          {!isOperator && <p className="truncate text-xs text-muted">{email}</p>}
        </div>
        <MenuSeparator />
        {orgs.length > 1 && !isOperator && (
          <>
            <p className="label px-2.5 pb-1 pt-1.5 text-subtle">Tvrtke</p>
            {orgs.map((o) => (
              <MenuItem key={o.id} onSelect={() => o.id !== activeOrgId && switchOrganizationAction(o.id)}>
                <Building2 />
                <span className="flex-1 truncate">{o.name}</span>
                {o.id === activeOrgId && <Check className="text-orange" />}
              </MenuItem>
            ))}
            <MenuSeparator />
          </>
        )}
        {isOperator && (
          <MenuItem onSelect={() => router.push("/admin/recenzije")}>
            <ArrowLeft /> Natrag na admin
          </MenuItem>
        )}
        {showAccount && (
          <MenuItem onSelect={() => router.push("/recenzije/postavke/racun")}>
            <CircleUser /> Postavke računa
          </MenuItem>
        )}
        <MenuItem onSelect={() => logoutAction()}>
          <LogOut /> Odjava
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
