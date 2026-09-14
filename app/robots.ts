import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // "/nfc" — privatne WiFi stranice za goste s fizičkom NFC pločicom u
      // ruci (vidi app/nfc/[slug]), ne javne marketinške stranice; curi
      // naziv WiFi mreže pa namjerno ne smiju u indeks (vidi i per-stranicu
      // robots: noindex u generateMetadata istog filea, ovo je druga linija obrane).
      disallow: ["/admin", "/api", "/nfc"],
      },
    sitemap: "https://www.probajnovo.com/sitemap.xml",
    };
  }
