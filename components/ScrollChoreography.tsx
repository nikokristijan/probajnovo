"use client";

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import Image from "next/image";

/**
 * "Grand" layout — jedan koreografirani scroll-trenutak usred stranice:
 * četiri fotografije objekta krenu iz kutova, sklope se u sredinu, pa se
 * jedna raširi preko cijelog zaslona. Zamišljeno kao jedini ovakav moment
 * na stranici (Aman/Tawaraya ritam: tišina → jedan veliki iznenadni gest →
 * tišina), zato se koristi točno jednom, između citata i pune galerije.
 *
 * S prefers-reduced-motion: reduce ne animiramo scroll (useTransform bi i
 * dalje mijenjao stilove na svaki scroll event) nego prikazujemo mirnu
 * 2×2 mrežu istih fotografija — isti sadržaj, bez pokreta.
 */
export default function ScrollChoreography({
  images,
}: {
  images: [string, string, string, string];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 400,
    damping: 50,
    mass: 1.2,
    restDelta: 0.001,
  });

  const xLeft = "-20vw";
  const xRight = "20vw";
  const yTop = "-14vh";
  const yBottom = "14vh";

  const tlX = useTransform(smoothProgress, [0, 0.3, 0.35, 0.65, 1], [xLeft, xLeft, xLeft, "0vw", "0vw"]);
  const tlY = useTransform(smoothProgress, [0, 0.3, 0.35, 0.65, 1], [yTop, yBottom, yBottom, "0vh", "0vh"]);

  const brX = useTransform(smoothProgress, [0, 0.3, 0.35, 0.65, 1], [xRight, xRight, xRight, "0vw", "0vw"]);
  const brY = useTransform(smoothProgress, [0, 0.3, 0.35, 0.65, 1], [yBottom, yTop, yTop, "0vh", "0vh"]);

  const blX = useTransform(smoothProgress, [0, 0.3, 0.35, 0.65, 1], [xLeft, xLeft, xLeft, "0vw", "0vw"]);
  const blY = useTransform(smoothProgress, [0, 0.3, 0.35, 0.65, 1], [yBottom, yBottom, yBottom, "0vh", "0vh"]);

  const trX = useTransform(smoothProgress, [0, 0.3, 0.35, 0.65, 1], [xRight, xRight, xRight, "0vw", "0vw"]);
  const trY = useTransform(smoothProgress, [0, 0.3, 0.35, 0.65, 1], [yTop, yTop, yTop, "0vh", "0vh"]);

  const heroWidth = useTransform(smoothProgress, [0.65, 0.7, 0.9, 1], ["36vw", "36vw", "100vw", "100vw"]);
  const heroHeight = useTransform(smoothProgress, [0.65, 0.7, 0.9, 1], ["24vh", "24vh", "100vh", "100vh"]);
  const underOpacity = useTransform(smoothProgress, [0.75, 0.85], [1, 0]);

  const [topLeft, topRight, bottomLeft, bottomRight] = images;

  if (shouldReduceMotion) {
    return (
      <div className="stay-choreo-static" aria-hidden="true">
        {images.map((src, i) => (
          <div className="stay-choreo-static-img" key={src + i}>
            <Image src={src} alt="" fill sizes="50vw" style={{ objectFit: "cover" }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="stay-choreo" aria-hidden="true">
      <div className="stay-choreo-sticky">
        <div className="stay-choreo-stage">
          <motion.div style={{ x: tlX, y: tlY, opacity: underOpacity }} className="stay-choreo-img" data-z="1">
            <Image src={topLeft} alt="" fill sizes="36vw" style={{ objectFit: "cover" }} />
          </motion.div>
          <motion.div style={{ x: brX, y: brY, opacity: underOpacity }} className="stay-choreo-img" data-z="2">
            <Image src={bottomRight} alt="" fill sizes="36vw" style={{ objectFit: "cover" }} />
          </motion.div>
          <motion.div style={{ x: blX, y: blY, opacity: underOpacity }} className="stay-choreo-img" data-z="3">
            <Image src={bottomLeft} alt="" fill sizes="36vw" style={{ objectFit: "cover" }} />
          </motion.div>
          <motion.div
            style={{ x: trX, y: trY, width: heroWidth, height: heroHeight }}
            className="stay-choreo-img stay-choreo-hero"
            data-z="4"
          >
            <Image src={topRight} alt="" fill sizes="100vw" style={{ objectFit: "cover" }} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
