import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";

/**
 * Prima zahtjev iz admin panela (klijent -> Vercel Blob, direktan upload
 * mimo servera pa nema limita veličine kao kod Server Actiona).
 * onBeforeGenerateToken provjerava da je zahtjev stvarno od prijavljenog
 * admina prije nego što izda token za upload — bez ovoga bi svatko mogao
 * uploadati datoteke u naš Blob store.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const admin = await getCurrentAdmin();
        if (!admin) {
          throw new Error("Nisi prijavljen kao admin.");
        }
        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/avif",
            "video/mp4",
            "video/webm",
            "video/quicktime",
            "video/x-m4v",
          ],
          addRandomSuffix: true,
          // 15MB je bilo dovoljno dok je ovo prihvaćalo samo slike; sad kroz
          // isti endpoint ide i upload proizvodnog videa, pa je limit podignut
          // na 200MB da stane kraći demo-video u razumnoj kvaliteti.
          maximumSizeInBytes: 200 * 1024 * 1024,
        };
      },
      onUploadCompleted: async () => {
        // Ništa dodatno — URL koji dobijemo natrag na klijentu je dovoljan,
        // admin ga sam sprema u formu (banner ili galerija) i sprema vikendicu.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}

