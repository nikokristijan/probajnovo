import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { getAdminById } from "@/lib/db/queries";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"];

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
        const row = await getAdminById(admin.adminId);
        if (!row) {
          throw new Error("Nisi prijavljen kao admin.");
        }
        // Plan #7: vlasnik (role="owner") smije samo slike do 10MB — video
        // i velike datoteke troše Blob kvotu agencije, a vlasniku ne trebaju.
        if (row.role === "owner") {
          return {
            allowedContentTypes: IMAGE_TYPES,
            addRandomSuffix: true,
            maximumSizeInBytes: 10 * 1024 * 1024,
          };
        }
        return {
          allowedContentTypes: [...IMAGE_TYPES, ...VIDEO_TYPES],
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

