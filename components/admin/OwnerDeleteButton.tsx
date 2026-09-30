"use client";

import type { ReactNode } from "react";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";

/**
 * Zajednički vlasnički "Obriši" gumb (owner-btn-danger, vidi globals.css) —
 * jedna komponenta za rezervacije, troškove... Potvrda je vlastiti dijalog
 * (plan #58, vidi ConfirmSubmit), ne browserov confirm().
 */
export default function OwnerDeleteButton({
  action,
  confirmTitle,
  confirmDescription,
  confirmLabel = "Obriši",
  label = "Obriši",
  className = "owner-btn-danger",
}: {
  action: (formData: FormData) => void | Promise<void>;
  confirmTitle: string;
  confirmDescription?: ReactNode;
  confirmLabel?: string;
  label?: ReactNode;
  className?: string;
}) {
  return (
    <ConfirmSubmit
      action={action}
      title={confirmTitle}
      description={confirmDescription}
      confirmLabel={confirmLabel}
      buttonLabel={label}
      buttonClassName={className}
    />
  );
}
