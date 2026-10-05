"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

export function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z"
      />
    </svg>
  );
}

/** Link koji uz otvaranje WhatsAppa/poziva zabilježi "Contact" za oglase. */
export function ContactLink({
  href,
  productName,
  channel,
  className,
  children,
  ariaLabel,
  tabIndex,
}: {
  href: string;
  productName: string;
  channel: "whatsapp" | "phone";
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
  tabIndex?: number;
}) {
  return (
    <a
      href={href}
      className={className}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      target={channel === "whatsapp" ? "_blank" : undefined}
      rel={channel === "whatsapp" ? "noreferrer" : undefined}
      onClick={() => track("Contact", { content_name: productName, method: channel })}
    >
      {children}
    </a>
  );
}

const viewed = new Set<string>();

/** "Pregled proizvoda" za oglase — jednom po proizvodu (i u Reactovom dev dvostrukom pokretanju efekata). */
export function TrackProductView({ name, slug, priceEur }: { name: string; slug: string; priceEur: number | null }) {
  useEffect(() => {
    if (viewed.has(slug)) return;
    viewed.add(slug);
    track("ViewContent", {
      content_name: name,
      content_ids: [slug],
      content_type: "product",
      ...(priceEur != null ? { value: priceEur, currency: "EUR" } : {}),
    });
  }, [name, slug, priceEur]);
  return null;
}
