/** "+385 91 234 5678" / "091 234 5678" → "385912345678" (za wa.me). Null ako nije broj. */
export function phoneDigits(phone: string): string | null {
  let d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "385" + d.slice(1); // hrvatski broj bez pozivnog
  d = d.replace(/\D/g, "");
  return d.length >= 8 ? d : null;
}

export function whatsappUrl(phone: string, text: string): string | null {
  const d = phoneDigits(phone);
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : null;
}

export function telHref(phone: string): string | null {
  const d = phoneDigits(phone);
  return d ? `tel:+${d}` : null;
}
