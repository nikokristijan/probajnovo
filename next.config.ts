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
  },
};

export default nextConfig;
