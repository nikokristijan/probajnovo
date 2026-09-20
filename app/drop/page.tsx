import type { Metadata } from "next";
import DropExperience from "@/components/drop/DropExperience";

// Drop.hr je izmišljeni brend — showcase primjer za NOVO portfolio (vidi
// footer stranice), ne stvarna tvrtka. "noindex" da ga tražilice ne
// prikazuju kao pravi proizvod, ali stranica ostaje javno dostupna i
// dijeljiva na drop.probajnovo.com (poddomena preko proxy.ts wildcard
// rewritea — ista šema kao <vikendica>.probajnovo.com).
export const metadata: Metadata = {
  title: "Drop — fizički newsletter za digitalnu generaciju",
  description:
    "Drop je koncept fizičkog, mjesečnog newslettera za GenZ. Showcase stranica — dizajn i izrada: NOVO studio.",
  robots: { index: false, follow: false },
  icons: { icon: "/drop/drop-badge-blue.png" },
};

export default function DropPage() {
  return <DropExperience />;
}
