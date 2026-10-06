import Image from "next/image";
import QRCode from "qrcode";
import type { NfcTag } from "@/lib/db/schema";
import { NfcSsidRow, NfcPasswordRow } from "@/components/NfcWifiActions";

export type NfcGuestCardData = Pick<
  NfcTag,
  | "wifiSsid"
  | "wifiPassword"
  | "welcomeTitle"
  | "welcomeText"
  | "image"
  | "googleReviewUrl"
  | "socialUrl"
  | "contactPhone"
  | "houseRulesText"
  | "localTipsText"
>;

/** Escapira `\`, `;`, `,`, `:` unutar jednog polja WiFi QR payloada (vidi
    spec ispod) — bez ovoga bi npr. SSID ili lozinka koja sadrži ";" slomili
    parsiranje na strani telefona koji skenira kod. */
function escapeWifiField(value: string): string {
  return value.replace(/([\\;,:])/g, "\\$1");
}

/**
 * Standardni "WIFI:" QR payload koji Android/iOS kamera prepoznaje i nudi
 * izravno spajanje na mrežu bez ručnog upisa — vidi
 * https://github.com/zxing/zxing/wiki/Barcode-Contents#wifi-network-config
 * (WIFI:T:<WPA|nopass>;S:<ssid>;P:<password>;;). Prazna/null lozinka =
 * otvorena mreža (T:nopass, bez P polja).
 */
function buildWifiQrPayload(ssid: string, password: string | null): string {
  const s = escapeWifiField(ssid);
  if (!password) return `WIFI:T:nopass;S:${s};;`;
  const p = escapeWifiField(password);
  return `WIFI:T:WPA;S:${s};P:${p};;`;
}

/** wa.me traži broj bez "+"/razmaka/crtica — samo znamenke. */
function buildWhatsAppUrl(phone: string): string {
  return `https://wa.me/${phone.replace(/[^0-9]/g, "")}`;
}

/**
 * Kartica stranice za goste (/nfc/[slug]). Ista komponenta se koristi i za
 * živi prikaz na stranici proizvoda (NfcPagePreview), pa primjer uvijek
 * izgleda točno kao prava stranica.
 */
export default async function NfcGuestCard({ tag }: { tag: NfcGuestCardData }) {
  const qrDataUrl = await QRCode.toDataURL(buildWifiQrPayload(tag.wifiSsid, tag.wifiPassword), {
    margin: 1,
    width: 336,
  });

  return (
    <div className="nfc-card">
      {tag.image && (
        <div className="nfc-hero-image">
          <Image src={tag.image} alt="" fill sizes="420px" />
        </div>
      )}

      <div className="nfc-body">
        <div>
          <h1 className="nfc-welcome-title">{tag.welcomeTitle || "Dobrodošli!"}</h1>
          {tag.welcomeText && <p className="nfc-welcome-text">{tag.welcomeText}</p>}
        </div>

        <div className="nfc-wifi-card">
          <NfcSsidRow ssid={tag.wifiSsid} />
          <NfcPasswordRow password={tag.wifiPassword} />

          <div className="nfc-qr-wrap">
            <div className="nfc-qr-frame">
              {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, next/image ne podržava */}
              <img src={qrDataUrl} alt="QR kod za spajanje na WiFi" width={168} height={168} />
            </div>
            <span className="nfc-qr-caption">
              Skeniraj fotoaparatom ili drži prst na QR kodu za automatsko spajanje
            </span>
          </div>
        </div>

        {(tag.googleReviewUrl || tag.socialUrl || tag.contactPhone) && (
          <div className="nfc-actions">
            {tag.googleReviewUrl && (
              <a
                href={tag.googleReviewUrl}
                target="_blank"
                rel="noopener"
                className="nfc-action-btn nfc-action-btn--primary"
              >
                ⭐ Ostavi nam Google recenziju
              </a>
            )}
            {tag.socialUrl && (
              <a href={tag.socialUrl} target="_blank" rel="noopener" className="nfc-action-btn">
                Prati nas na društvenim mrežama
              </a>
            )}
            {tag.contactPhone && (
              <a href={buildWhatsAppUrl(tag.contactPhone)} target="_blank" rel="noopener" className="nfc-action-btn">
                WhatsApp / poziv
              </a>
            )}
          </div>
        )}

        {tag.houseRulesText && (
          <div className="nfc-text-card">
            <p className="nfc-text-card-title">Kućni red</p>
            <p className="nfc-text-card-body">{tag.houseRulesText}</p>
          </div>
        )}

        {tag.localTipsText && (
          <div className="nfc-text-card">
            <p className="nfc-text-card-title">Lokalne preporuke</p>
            <p className="nfc-text-card-body">{tag.localTipsText}</p>
          </div>
        )}

        <p className="nfc-footer">
          Stranicu pokreće <a href="https://www.probajnovo.com" target="_blank" rel="noopener">NOVO</a>
        </p>
      </div>
    </div>
  );
}
