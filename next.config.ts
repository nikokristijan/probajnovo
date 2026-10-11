import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Sve galerije/banner/host-foto slike idu isključivo kroz Vercel Blob
    // upload (vidi app/api/blob/upload/route.ts, components/admin/ImageUploader.tsx)
    // — admin nema polje za ručno lijepljenje vanjskog URL-a, pa je ovo
    // jedina domena koju next/image treba dopustiti za optimizaciju
    // (kompresija, WebP/AVIF, responsive veličine po uređaju gosta).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
    // Manje različitih širina = manje transformacija izvora (Vercel Hobby ima ograničenu kvotu
    // transformacija/izvornih slika) uz isti dojam: 640 (mobitel DPR 2), 828 (iPhone DPR 2),
    // 1080 (većina mobitela DPR 2.6–3), 1200 (tablet/mali laptop), 1920 (desktop). Zadano je 8 širina
    // + 7 malih; 2048/3840 nitko ne treba za fotografije vikendica. imageSizes pokrivaju sličice.
    deviceSizes: [640, 828, 1080, 1200, 1920],
    imageSizes: [64, 128, 256, 384],
    // Blob URL-ovi imaju nasumični sufiks (addRandomSuffix u app/api/blob/upload/route.ts), tj. sadržaj
    // pod istim URL-om se nikad ne mijenja — optimizirana slika se smije držati u cacheu 31 dan
    // (zadano je samo 4 h, pa bi se ista slika stalno ponovno transformirala).
    minimumCacheTTL: 60 * 60 * 24 * 31,
  },
};

export default nextConfig;
