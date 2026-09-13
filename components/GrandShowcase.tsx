"use client";

import { CardsParallax, type iCardItem } from "@/components/ui/scroll-cards";
import ShaderBackground from "@/components/ShaderBackground";

/**
 * Replaces the old ScrollChoreography "4 images glue into 1" moment with a
 * sturdier, well-understood pattern: photos pin one on top of another while
 * an animated gradient (Paper Shaders "Static Mesh Gradient") drifts behind
 * them in the gaps. Grid-stacks two full-height children in the same cell —
 * the shader canvas stays `sticky` so it reads as one continuous backdrop
 * while the cards scroll and pin over it.
 */
export default function GrandShowcase({
  images,
  captions,
  name,
}: {
  images: string[];
  captions: Record<string, string>;
  name: string;
}) {
  const boxTint = ["var(--ink)", "var(--accent-dark)", "var(--ink)", "var(--accent-dark)"];
  const items: iCardItem[] = images.slice(0, 4).map((src, i) => ({
    title: captions[src] || name,
    description: "",
    tag: "",
    link: "#",
    src,
    color: boxTint[i % boxTint.length],
    textColor: "var(--paper)",
  }));

  return (
    <div className="stay-showcase relative grid" aria-hidden="true">
      <div className="[grid-area:1/1] sticky top-0 h-screen w-full overflow-hidden">
        <ShaderBackground />
      </div>
      <div className="[grid-area:1/1] relative z-10">
        <CardsParallax items={items} />
      </div>
    </div>
  );
}
