/**
 * Adresa javnog jelovnika s neobaveznim brojem stola. Čista funkcija (bez baze, servera i Reacta) da je koriste i server
 * (menuPublicUrl u services/menus.ts: QR kod, plakat, admin) i preglednik (popis adresa za NFC pločice), pa QR i NFC
 * UVIJEK vode na istu adresu. `base` je već gotova adresa bez stola (env.appUrl + /jelovnik/<slug>).
 */
export function menuUrlWithTable(base: string, table?: string | number | null): string {
  const t = table === null || table === undefined ? "" : String(table).trim();
  return t ? `${base}?stol=${encodeURIComponent(t.slice(0, 20))}` : base;
}
