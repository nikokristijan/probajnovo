"use client";
import { FC } from "react";

import Image from "next/image";

// Types
interface iCardItem {
  title: string;
  description: string;
  tag: string;
  src: string;
  link: string;
  color: string;
  textColor: string;
}

interface iCardProps extends Omit<iCardItem, "src" | "link" | "tag"> {
  i: number;
  src: string;
}

// Components
/**
 * Adapted from the 21st.dev "scroll-cards" community component: each card is
 * a sticky h-screen panel, so as the user scrolls, cards stack on top of one
 * another instead of sliding past. Kept the original structure/classes;
 * swapped the demo's placeholder Tailwind font utilities (font-tiemposHeadline,
 * font-manrope — not defined in this project's theme) for NOVO's own display
 * (Fraunces) and body (Karla) fonts via CSS vars, and moved next/image off the
 * removed legacy `layout="fill"` API onto the current `fill` prop. Also added
 * a soft scrim behind the text and skip empty descriptions, since the raw
 * demo relies on hand-picked photos for legibility and we're feeding it real
 * property gallery images.
 */
const Card: FC<iCardProps> = ({ title, description, color, textColor, src }) => {
  return (
    <div className="h-screen flex items-center justify-center sticky top-0 md:p-0 px-4">
      <div
        className="relative flex flex-col h-[300px] w-[700px] py-12 px-10 md:px-12
        rotate-0 md:h-[400px] md:w-[600px] items-center justify-center mx-auto
        shadow-md pr-3 pl-3 pt-3 pb-4 overflow-hidden"
        style={{ backgroundColor: color }}
      >
        <span className="relative text-4xl md:text-6xl mt-5">
          <span
            className="relative z-10 tracking-tight"
            style={{
              color: textColor,
              fontFamily: "var(--font-fraunces), Georgia, serif",
              fontStyle: "italic",
              fontWeight: 400,
            }}
          >
            {title}
          </span>
        </span>
        {description && (
          <div
            className="text-lg md:text-2xl font-medium text-center mb-0 z-10 mt-2 lowercase tracking-wide"
            style={{
              lineHeight: 1.4,
              color: textColor,
              fontFamily: "var(--font-karla), sans-serif",
            }}
          >
            {description}
          </div>
        )}
        <div className="absolute inset-0 z-0">
          <Image
            className="w-full h-full object-cover"
            src={src}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 700px"
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.5))" }}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * CardsParallax component displays a series of cards in a vertical scroll layout
 * Each card contains a title, description, and decorative elements
 */
interface iCardSlideProps {
  items: iCardItem[];
}

const CardsParallax: FC<iCardSlideProps> = ({ items }) => {
  return (
    <div className="min-h-screen">
      {items.map((project, i) => {
        return <Card key={`p_${i}`} {...project} i={i} />;
      })}
    </div>
  );
};

export { CardsParallax, type iCardItem };
