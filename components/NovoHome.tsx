"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";

/* Konfigurator prostornih slova (fontovi + SlovaCustomizer) učitan tek kad
   se stvarno otvori (klik na ikonu širenja u "CUSTOM SLOVA PO MJERI"
   prozoru) — ssr:false + dynamic import, da posjetitelji naslovnice koji
   ga ne otvore ne preuzimaju 10 dodatnih Google fontova. Vidi
   components/slova/SlovaFullscreenOverlay.tsx. */
const SlovaFullscreenOverlay = dynamic(() => import("@/components/slova/SlovaFullscreenOverlay"), {
  ssr: false,
  loading: () => (
    <div className="product-full">
      <div className="product-full-topbar">
        <span className="product-full-brand mono muted">NOVO — PROSTORNA SLOVA</span>
      </div>
      <div className="product-full-scroll">
        <div className="novo-product-wrap">
          <p className="studies-empty">Učitavanje konfiguratora…</p>
        </div>
      </div>
    </div>
  ),
});

/* ------------------------------------------------------------------ */
/* Tipovi                                                              */
/* ------------------------------------------------------------------ */

/**
 * "vikendica" = booking property sa svojom /[slug] stranicom i kontakt emailom.
 * "study" = opći portfolio unos agencije (brend, dizajn, film…) — samo tekst +
 * slike + opcionalna vanjska poveznica, bez vlastite stranice.
 */
export type StudyProject = {
  id: number;
  kind: "vikendica" | "study";
  slug?: string;
  name: string;
  location: string;
  tagline: string;
  description: string;
  year: number;
  images: string[];
  contactEmail?: string;
  externalUrl?: string;
};

/** Fizički proizvod (npr. 3D printana pločica s NFC oznakom) — upit ide mailom. */
export type ProductCard = {
  id: number;
  name: string;
  tagline: string;
  description: string;
  priceEur: number | null;
  images: string[];
  features: string[];
  /** Adresa vlastite stranice (probajnovo.com/proizvodi/<slug>) — null =
      proizvod (još) nema vlastitu stranicu, ne prikazuje se poveznica. */
  slug: string | null;
  featured: boolean;
  category: string | null;
};

const SERVICES = ["BREND IDENTITET", "DIGITALNI DIZAJN", "WEB & PRODUKT", "FILM & MOTION", "MARKETING"];

/**
 * Svaka vikendica/firma ima svoju wildcard poddomenu "<slug>.<APEX_HOST>" (vidi
 * proxy.ts) — s glavne NOVO stranice "CIJELA STRANICA" mora voditi baš tamo,
 * ne na interni /<slug> put, da adresna traka gosta odmah pokaže poddomenu.
 * Radi automatski za svaku BUDUĆU vikendicu/firmu čim dobije slug — nema
 * dodatnog koraka po unosu. Dok APEX_HOST nije postavljen (lokalni razvoj),
 * pada natrag na interni /<slug> put.
 */
const APEX_HOST = process.env.NEXT_PUBLIC_APEX_HOST || "";
function propertyUrl(slug: string) {
  return APEX_HOST ? `https://${slug}.${APEX_HOST}` : `/${slug}`;
}

type NovoHomeProps = {
  heroTitle: string;
  officeText: string;
  contactEmail: string;
  instagramHandle: string;
  city: string;
  projects: StudyProject[];
  products: ProductCard[];
  /** Otvara stranicu izravno na jednom od tabova (npr. ?view=products) —
      koristi ga /proizvodi redirect da gost koji je imao stari link ne
      završi na POČETNA tabu nego direktno na PROIZVODI. */
  initialView?: View;
};

type View = "home" | "studies" | "office" | "products";

/* ------------------------------------------------------------------ */
/* Halftone placeholder (kad vikendica/proizvod još nema uploadanih slika) */
/* ------------------------------------------------------------------ */

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
const BG_SHADES = ["#eee", "#e6e6e6", "#dedede", "#f1f1f1", "#e2e2e2"];

function ProjectImage({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />;
  }
  const seed = alt || "novo";
  const hash = hashStr(seed);
  const rotation = (hash % 6) * 15;
  const bg = BG_SHADES[hash % BG_SHADES.length];
  const patId = `dots-${seed.replace(/[^a-zA-Z0-9]/g, "").slice(-12)}-${hash % 997}`;
  return (
    <svg className={className} viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" role="img" aria-label={alt}>
      <defs>
        <pattern id={patId} width="16" height="16" patternUnits="userSpaceOnUse" patternTransform={`rotate(${rotation})`}>
          <circle cx="8" cy="8" r="3.2" fill="#000" opacity="0.16" />
        </pattern>
      </defs>
      <rect width="400" height="500" fill={bg} />
      <rect width="400" height="500" fill={`url(#${patId})`} />
      <text x="20" y="472" fontFamily="var(--font-jetbrains-mono), monospace" fontSize="13" letterSpacing="2" fill="rgba(0,0,0,0.4)">
        {alt}
      </text>
    </svg>
  );
}

/* Geometrijska strelica za minimiziranje — umjesto fontovnog znaka, da se
   uvijek okreće čisto i centrirano oko svog središta bez obzira na font. */
function Chevron({ up }: { up: boolean }) {
  return (
    <svg
      className={up ? "fw-chevron fw-chevron-up" : "fw-chevron"}
      viewBox="0 0 12 12"
      width="10"
      height="10"
      fill="none"
      aria-hidden="true"
    >
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Ikone za cijeli zaslon (proizvodi) — kutne zagrade koje se šire/skupljaju,
   dosljedno geometrijskom stilu Chevrona iznad. */
function ExpandIcon() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" fill="none" aria-hidden="true">
      <path
        d="M1 4.5V1h3.5M11 4.5V1H7.5M1 7.5V11h3.5M11 7.5V11H7.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function CompressIcon() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" fill="none" aria-hidden="true">
      <path
        d="M4.5 1v3.5H1M7.5 1v3.5H11M4.5 11V7.5H1M7.5 11V7.5H11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Floating window — draggable, minimizable, closable                  */
/* ------------------------------------------------------------------ */

function FloatingWindow({
  title,
  x,
  y,
  z,
  onFocus,
  onClose,
  minimized,
  onToggleMinimize,
  onToggleFullscreen,
  width = 220,
  children,
}: {
  title: string;
  x: number;
  y: number;
  z: number;
  onFocus: () => void;
  onClose?: () => void;
  minimized: boolean;
  onToggleMinimize?: () => void;
  onToggleFullscreen?: () => void;
  width?: number;
  children: React.ReactNode;
}) {
  const posRef = useRef({ x, y });
  const [pos, setPos] = useState({ x, y });
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    onFocus();
    const startX = e.clientX;
    const startY = e.clientY;
    dragState.current = { startX, startY, origX: posRef.current.x, origY: posRef.current.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    const maxX = (typeof window !== "undefined" ? window.innerWidth : 1200) - 60;
    const maxY = (typeof window !== "undefined" ? window.innerHeight : 800) - 40;
    const next = {
      x: Math.min(Math.max(dragState.current.origX + dx, -width + 80), maxX),
      y: Math.min(Math.max(dragState.current.origY + dy, 0), maxY),
    };
    posRef.current = next;
    setPos(next);
  };

  const endDrag = () => {
    dragState.current = null;
  };

  return (
    <div
      className="floating-window"
      style={{ left: pos.x, top: pos.y, width, zIndex: z }}
      onMouseDown={onFocus}
      onTouchStart={onFocus}
    >
      <div
        className="fw-titlebar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="fw-title">{title}</span>
        <div className="fw-controls">
          {onToggleFullscreen && (
            <button
              className="fw-btn"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onToggleFullscreen}
              aria-label="Cijeli zaslon"
            >
              <ExpandIcon />
            </button>
          )}
          {onToggleMinimize && (
            <button
              className="fw-btn"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onToggleMinimize}
              aria-label="Minimiziraj"
            >
              <Chevron up={minimized} />
            </button>
          )}
          {onClose && (
            <button
              className="fw-btn"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onClose}
              aria-label="Zatvori"
            >
              ×
            </button>
          )}
        </div>
      </div>
      {!minimized && <div className="fw-body">{children}</div>}
    </div>
  );
}

/* Ambient exhibit: jedna slika po kadru, auto-scroll prema dolje u petlji */
function ExhibitContent({ images }: { images: { src?: string; alt: string }[] }) {
  const loop = [...images, ...images];
  return (
    <div className="exhibit-viewport">
      <div className="exhibit-track">
        {loop.map((img, i) => (
          <div className="exhibit-frame" key={i}>
            <ProjectImage src={img.src} alt={img.alt} className="exhibit-img" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* Sadržaj pop-up prozora projekta: klik na sliku ide na sljedeću */
function ProjectContent({ project }: { project: StudyProject }) {
  const [i, setI] = useState(0);
  const images = project.images.length > 0 ? project.images : [undefined];
  const total = images.length;
  const advance = () => setI((v) => (v + 1) % total);

  return (
    <div className="proj-viewport">
      <button className="proj-image-btn" onClick={advance} aria-label="Sljedeća slika">
        <ProjectImage src={images[i]} alt={project.name} className="proj-img" />
      </button>
      <div className="proj-info">
        <p className="proj-desc">{project.tagline}</p>
        <div className="proj-meta">
          <span className="mono muted">
            {project.location} · {project.year}
          </span>
          <span className="mono muted">
            {i + 1}/{total}
          </span>
        </div>
        <div className="proj-actions">
          {project.kind === "vikendica" && project.contactEmail && (
            <a
              href={`mailto:${project.contactEmail}?subject=Upit — ${project.name}`}
              className="mono link"
            >
              KONTAKTIRAJTE NAS ↗
            </a>
          )}
          {project.kind === "vikendica" && project.slug && (
            <a href={propertyUrl(project.slug)} className="mono link">
              CIJELA STRANICA ↗
            </a>
          )}
          {project.kind === "study" && project.externalUrl && (
            <a href={project.externalUrl} target="_blank" rel="noreferrer" className="mono link">
              POGLEDAJ PROJEKT ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* Sadržaj pop-up prozora proizvoda: galerija + značajke + upit mailom
   koji automatski predloži naslov, količinu i naziv vikendice/firme. */
function ProductContent({ product, contactEmail }: { product: ProductCard; contactEmail: string }) {
  const [i, setI] = useState(0);
  const images = product.images.length > 0 ? product.images : [undefined];
  const total = images.length;
  const advance = () => setI((v) => (v + 1) % total);

  const subject = `Upit — ${product.name}`;
  const body = `Pozdrav,\n\nZanima me proizvod: ${product.name}.\n\nKoličina: \nNaziv vikendice / firme: \n\nHvala!`;
  const mailHref = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="proj-viewport">
      <button className="proj-image-btn" onClick={advance} aria-label="Sljedeća slika">
        <ProjectImage src={images[i]} alt={product.name} className="proj-img" />
      </button>
      <div className="proj-info">
        <p className="proj-desc">{product.description}</p>
        {product.features.length > 0 && (
          <div className="product-features">
            {product.features.map((f) => (
              <span key={f} className="product-feature-chip mono">
                {f}
              </span>
            ))}
          </div>
        )}
        <div className="proj-meta">
          <span className="mono muted">{product.priceEur != null ? `od ${product.priceEur} €` : "na upit"}</span>
          <span className="mono muted">
            {i + 1}/{total}
          </span>
        </div>
        <div className="proj-actions">
          <a href={mailHref} className="mono link">
            POŠALJI UPIT ↗
          </a>
          {product.slug && (
            <Link href={`/proizvodi/${product.slug}`} className="mono link">
              STRANICA PROIZVODA ↗
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* Sadržaj malog pop-up prozora za "Custom slova po mjeri" — konfigurator sam
   (SlovaCustomizer) je prevelik za mali plutajući prozor (puni desktop alat s
   3D pregledom, biračem fonta/veličine/boje i formom za upit), zato ovdje
   stoji samo kratak teaser s CTA-om koji ga otvara preko cijelog zaslona
   (isti "proširi" mehanizam kao kod pravih proizvoda) — ne šalje gosta na
   /slova, ostaje unutar OS shella kao i svi ostali proizvodi. */
function SlovaTeaserContent({ onOpenFullscreen }: { onOpenFullscreen: () => void }) {
  return (
    <div className="proj-viewport">
      <button
        type="button"
        className="proj-image-btn"
        onClick={onOpenFullscreen}
        aria-label="Otvori konfigurator prostornih slova"
        style={{ background: "#0b0b10" }}
      />
      <div className="proj-info">
        <p className="proj-desc">
          Odaberite font, veličinu i boju prostornih slova, pogledajte uživo i pošaljite upit u dva
          klika.
        </p>
        <div className="proj-meta">
          <span className="mono muted">od 4 €/slovo</span>
        </div>
        <div className="proj-actions">
          <button type="button" className="mono link link-btn" onClick={onOpenFullscreen}>
            OTVORI KONFIGURATOR ↗
          </button>
          <Link href="/slova" className="mono link">
            STRANICA PROIZVODA ↗
          </Link>
        </div>
      </div>
    </div>
  );
}

/* Cijeli zaslon proizvoda — umjesto malog plutajućeg prozora, proizvod
   "postane" vlastita stranica preko cijelog ekrana (veća galerija, čitljiviji
   opis). Otvara se klikom na ikonu širenja kraj minimiziranja, zatvara se
   ikonom skupljanja (vraća se natrag na plutajući prozor) ili križićem. */
function ProductFullscreenPage({
  product,
  contactEmail,
  onExitFullscreen,
  onClose,
}: {
  product: ProductCard;
  contactEmail: string;
  onExitFullscreen: () => void;
  onClose: () => void;
}) {
  const [i, setI] = useState(0);
  const images = product.images.length > 0 ? product.images : [undefined];

  const subject = `Upit — ${product.name}`;
  const body = `Pozdrav,\n\nZanima me proizvod: ${product.name}.\n\nKoličina: \nNaziv vikendice / firme: \n\nHvala!`;
  const mailHref = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onExitFullscreen();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExitFullscreen]);

  return (
    <div className="product-full mono">
      <div className="product-full-topbar">
        <span className="product-full-brand mono muted">NOVO — PROIZVOD</span>
        <div className="fw-controls">
          <button className="fw-btn" onClick={onExitFullscreen} aria-label="Izađi iz cijelog zaslona — natrag na prozor">
            <CompressIcon />
          </button>
          <button className="fw-btn" onClick={onClose} aria-label="Zatvori">
            ×
          </button>
        </div>
      </div>
      <div className="product-full-scroll">
        <div className="product-full-body">
          <div className="product-full-hero">
            <ProjectImage src={images[i]} alt={product.name} className="product-full-hero-img" />
          </div>
          {images.length > 1 && (
            <div className="product-full-thumbs">
              {images.map((src, idx) => (
                <button
                  key={idx}
                  className={idx === i ? "product-full-thumb active" : "product-full-thumb"}
                  onClick={() => setI(idx)}
                  aria-label={`Slika ${idx + 1}`}
                >
                  <ProjectImage src={src} alt={product.name} className="product-full-thumb-img" />
                </button>
              ))}
            </div>
          )}
          <div className="product-full-info">
            <span className="novo-os-kicker mono">PROIZVOD</span>
            <h1>{product.name}</h1>
            <p className="product-full-tagline">{product.tagline}</p>
            <p className="product-full-desc">{product.description}</p>
            {product.features.length > 0 && (
              <div className="product-features">
                {product.features.map((f) => (
                  <span key={f} className="product-feature-chip mono">
                    {f}
                  </span>
                ))}
              </div>
            )}
            <div className="product-full-actions">
              <span className="product-full-price mono">
                {product.priceEur != null ? `od ${product.priceEur} €` : "Cijena na upit"}
              </span>
              <a href={mailHref} className="novo-os-cta mono">
                POŠALJI UPIT ↗
              </a>
              {product.slug && (
                <Link href={`/proizvodi/${product.slug}`} className="mono link">
                  STRANICA PROIZVODA ↗
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Glavna komponenta                                                    */
/* ------------------------------------------------------------------ */

function pad(n: number) {
  return String(n + 1).padStart(3, "0");
}

export default function NovoHome({
  heroTitle,
  officeText,
  contactEmail,
  instagramHandle,
  city,
  projects,
  products,
  initialView,
}: NovoHomeProps) {
  const [view, setView] = useState<View>(initialView ?? "home");
  const zCounter = useRef(10);

  const [exhibit, setExhibit] = useState({ x: 40, y: 100, z: 5, minimized: false });
  const [exhibitReady, setExhibitReady] = useState(false);
  const [projectWindows, setProjectWindows] = useState<
    { key: string; project: StudyProject; x: number; y: number; z: number; minimized: boolean }[]
  >([]);
  const [productWindows, setProductWindows] = useState<
    { key: string; product: ProductCard; x: number; y: number; z: number; minimized: boolean; fullscreen: boolean }[]
  >([]);
  /* "Custom slova po mjeri" nije u `products` tablici (zaseban interaktivni
     alat, ne DB kartica) pa ima svoj, jednostruki prozor umjesto niza kao
     projectWindows/productWindows — u svakom trenutku postoji najviše jedan. */
  const [slovaWindow, setSlovaWindow] = useState<
    { x: number; y: number; z: number; minimized: boolean; fullscreen: boolean } | null
  >(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  // no page-scroll: zaključaj <html>/<body> dok je ova stranica montirana
  useEffect(() => {
    document.documentElement.classList.add("novo-lock-scroll");
    return () => document.documentElement.classList.remove("novo-lock-scroll");
  }, []);

  useEffect(() => {
    // Početna pozicija EXHIBIT prozora ovisi o veličini prozora preglednika,
    // koja je poznata tek nakon montiranja (SSR je ne zna) — prozor se prvi
    // put renderira tek kad je pozicija izračunata (vidi `exhibitReady` niže),
    // pa ovo ne uzrokuje vidljiv "skok" niti dodatni render tuđe komponente.
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExhibit((e) => ({ ...e, x: Math.max(vw - 300, 20), y: Math.max(vh - 360, 90) }));
    setExhibitReady(true);

    const onMove = (e: MouseEvent) => setCoords({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const bringExhibitFront = () => setExhibit((e) => ({ ...e, z: ++zCounter.current }));

  const openProject = (project: StudyProject) => {
    setProjectWindows((wins) => {
      const existing = wins.find((w) => w.project.id === project.id);
      if (existing) {
        return wins.map((w) =>
          w.project.id === project.id ? { ...w, z: ++zCounter.current, minimized: false } : w
        );
      }
      const count = wins.length + productWindows.length;
      const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
      const vh = typeof window !== "undefined" ? window.innerHeight : 800;
      const baseX = Math.min(220 + count * 36, Math.max(vw - 280, 60));
      const baseY = Math.min(100 + count * 36, Math.max(vh - 420, 70));
      return [
        ...wins,
        { key: `${project.id}-${Date.now()}`, project, x: baseX, y: baseY, z: ++zCounter.current, minimized: false },
      ];
    });
  };

  const closeProject = (key: string) => setProjectWindows((wins) => wins.filter((w) => w.key !== key));
  const toggleMinimizeProject = (key: string) =>
    setProjectWindows((wins) => wins.map((w) => (w.key === key ? { ...w, minimized: !w.minimized } : w)));
  const focusProject = (key: string) =>
    setProjectWindows((wins) => wins.map((w) => (w.key === key ? { ...w, z: ++zCounter.current } : w)));

  const openProduct = (product: ProductCard) => {
    setProductWindows((wins) => {
      const existing = wins.find((w) => w.product.id === product.id);
      if (existing) {
        return wins.map((w) =>
          w.product.id === product.id ? { ...w, z: ++zCounter.current, minimized: false } : w
        );
      }
      const count = wins.length + projectWindows.length;
      const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
      const vh = typeof window !== "undefined" ? window.innerHeight : 800;
      const baseX = Math.min(220 + count * 36, Math.max(vw - 280, 60));
      const baseY = Math.min(100 + count * 36, Math.max(vh - 420, 70));
      return [
        ...wins,
        {
          key: `p-${product.id}-${Date.now()}`,
          product,
          x: baseX,
          y: baseY,
          z: ++zCounter.current,
          minimized: false,
          fullscreen: false,
        },
      ];
    });
  };

  const closeProduct = (key: string) => setProductWindows((wins) => wins.filter((w) => w.key !== key));
  const toggleMinimizeProduct = (key: string) =>
    setProductWindows((wins) => wins.map((w) => (w.key === key ? { ...w, minimized: !w.minimized } : w)));
  const focusProduct = (key: string) =>
    setProductWindows((wins) => wins.map((w) => (w.key === key ? { ...w, z: ++zCounter.current } : w)));
  const toggleFullscreenProduct = (key: string) =>
    setProductWindows((wins) =>
      wins.map((w) =>
        w.key === key ? { ...w, fullscreen: !w.fullscreen, minimized: false, z: ++zCounter.current } : w
      )
    );

  const openSlova = () => {
    setSlovaWindow((w) => {
      if (w) return { ...w, z: ++zCounter.current, minimized: false };
      const count = projectWindows.length + productWindows.length;
      const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
      const vh = typeof window !== "undefined" ? window.innerHeight : 800;
      const baseX = Math.min(220 + count * 36, Math.max(vw - 280, 60));
      const baseY = Math.min(100 + count * 36, Math.max(vh - 420, 70));
      return { x: baseX, y: baseY, z: ++zCounter.current, minimized: false, fullscreen: false };
    });
  };
  const closeSlova = () => setSlovaWindow(null);
  const toggleMinimizeSlova = () => setSlovaWindow((w) => (w ? { ...w, minimized: !w.minimized } : w));
  const focusSlova = () => setSlovaWindow((w) => (w ? { ...w, z: ++zCounter.current } : w));
  const toggleFullscreenSlova = () =>
    setSlovaWindow((w) => (w ? { ...w, fullscreen: !w.fullscreen, minimized: false, z: ++zCounter.current } : w));

  // Esc zatvara prozor koji je trenutno navrh (najveći z) — tipkovničko
  // korištenje bez miša, isto kao što bi se očekivalo od pravog OS prozora.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const candidates = [
        ...projectWindows.filter((w) => !w.minimized).map((w) => ({ z: w.z, close: () => closeProject(w.key) })),
        ...productWindows.filter((w) => !w.minimized).map((w) => ({ z: w.z, close: () => closeProduct(w.key) })),
        ...(slovaWindow && !slovaWindow.minimized ? [{ z: slovaWindow.z, close: closeSlova }] : []),
      ];
      candidates.sort((a, b) => b.z - a.z)[0]?.close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [projectWindows, productWindows, slovaWindow]);

  const exhibitImages =
    projects.length > 0
      ? projects.map((p) => ({ src: p.images[0], alt: p.name }))
      : [{ src: undefined, alt: "NOVO" }];

  const instaUrl = `https://instagram.com/${instagramHandle.replace(/^@/, "")}`;

  return (
    <div className="novo-os">
      <div className="novo-os-topbar">
        <button
          type="button"
          className="novo-os-brand"
          onClick={() => setView("home")}
          aria-label="NOVO — natrag na početnu"
        >
          <Image
            src="/novo-logo.png"
            alt="NOVO"
            className="novo-os-logo-img"
            width={1474}
            height={497}
            priority
          />
        </button>
        <span className="novo-os-coords mono muted">
          {coords.x}(X), {coords.y}(Y)
        </span>
      </div>

      <nav className="novo-os-nav">
        <button className={view === "home" ? "novo-os-navbtn active" : "novo-os-navbtn"} onClick={() => setView("home")}>
          POČETNA
        </button>
        <button
          className={view === "studies" ? "novo-os-navbtn active" : "novo-os-navbtn"}
          onClick={() => setView("studies")}
        >
          RADOVI
        </button>
        <button
          className={view === "products" ? "novo-os-navbtn active" : "novo-os-navbtn"}
          onClick={() => setView("products")}
        >
          PROIZVODI
        </button>
        <button
          className={view === "office" ? "novo-os-navbtn active" : "novo-os-navbtn"}
          onClick={() => setView("office")}
        >
          STUDIO
        </button>
      </nav>

      <main className="novo-os-main">
        {view === "home" && (
          <div className="novo-os-hero">
            <div className="novo-os-hero-content">
              <span className="novo-os-kicker mono">KREATIVNI STUDIO</span>
              <h1>{heroTitle}</h1>
              <div className="novo-os-services">
                {SERVICES.map((s) => (
                  <span key={s} className="novo-os-chip mono">
                    {s}
                  </span>
                ))}
              </div>
              <button className="novo-os-cta mono" onClick={() => setView("studies")}>
                POGLEDAJ RADOVE ↗
              </button>
            </div>
          </div>
        )}

        {view === "studies" && (
          <div className="novo-os-panel">
            <h2 className="section-title">RADOVI</h2>
            <div className="studies-head">
              <span>BR.</span>
              <span>NAZIV</span>
              <span className="col-cat">INFO</span>
              <span>GODINA</span>
            </div>
            <div className="studies-scroll">
              {projects.length === 0 && (
                <p className="studies-empty">Još nema dodanih radova — dodaj prvi u /admin.</p>
              )}
              {projects.map((p, i) => (
                <button key={p.id} className="studies-row" onClick={() => openProject(p)}>
                  <div className="studies-row-grid">
                    <span className="proj-no">{pad(i)}</span>
                    <span className="proj-name">{p.name.toUpperCase()}</span>
                    <span className="proj-cat col-cat">{p.location}</span>
                    <span className="proj-year">{p.year}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {view === "products" && (
          <div className="novo-os-panel">
            <h2 className="section-title">PROIZVODI</h2>
            <div className="products-scroll">
              <div className="products-grid">
                {/* /slova konfigurator nije u `products` tablici (zaseban interaktivni
                    alat, ne tekst/slika+upit kartica kao ostali proizvodi) — uvijek
                    prikazan prvi, isto kao što je prije bio na zasebnoj /proizvodi
                    listing stranici prije spajanja u ovaj tab. Otvara se kao popup
                    prozor (openSlova), isto kao svi ostali proizvodi — ne šalje gosta
                    na /slova (ta stranica i dalje postoji za izravne/SEO posjete). */}
                <button type="button" className="product-card" onClick={openSlova}>
                  <div className="product-card-img" style={{ background: "#0b0b10" }} />
                  <div className="product-card-body">
                    <span className="product-card-name">Custom slova po mjeri</span>
                    <span className="product-card-tagline">
                      Odaberite font, veličinu i boju, pogledajte uživo i pošaljite upit.
                    </span>
                    <span className="product-card-price mono">od 4 €/slovo</span>
                  </div>
                </button>
                {products.length === 0 ? (
                  <p className="studies-empty">
                    Uskoro dostupno — 3D printane pločice s NFC oznakama za vikendice i firme.
                  </p>
                ) : (
                  products.map((p) => (
                    <button key={p.id} className="product-card" onClick={() => openProduct(p)}>
                      <div className="product-card-img">
                        <ProjectImage src={p.images[0]} alt={p.name} className="product-card-thumb" />
                      </div>
                      <div className="product-card-body">
                        <span className="product-card-name">{p.name}</span>
                        <span className="product-card-tagline">{p.tagline}</span>
                        <span className="product-card-price mono">
                          {p.priceEur != null ? `od ${p.priceEur} €` : "na upit"}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {view === "office" && (
          <div className="novo-os-panel">
            <h2 className="section-title">STUDIO</h2>
            <div className="office-grid">
              <div className="office-col">
                <p className="office-text">{officeText}</p>
                <div className="novo-os-services office-services">
                  {SERVICES.map((s) => (
                    <span key={s} className="novo-os-chip mono">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div className="office-col office-contact">
                <div className="office-block">
                  <span className="mono muted">LOKACIJA</span>
                  <span>{city}</span>
                </div>
                <div className="office-block">
                  <span className="mono muted">UPIT</span>
                  <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
                </div>
                <div className="office-block">
                  <span className="mono muted">PRATI NAS</span>
                  <a href={instaUrl} target="_blank" rel="noreferrer">
                    {instagramHandle}
                  </a>
                </div>
                <div className="office-block">
                  <span className="mono muted">PRAVNO</span>
                  <Link href="/privatnost">Politika privatnosti</Link>
                  <Link href="/uvjeti">Uvjeti korištenja</Link>
                  <Link href="/povrat">Politika povrata</Link>
                  <Link href="/kolacici">Politika kolačića</Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <aside className="novo-os-side">
        <div className="novo-os-side-block">
          <span className="mono muted">UPIT</span>
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </div>
        <div className="novo-os-side-block">
          <span className="mono muted">PRATI NAS</span>
          <a href={instaUrl} target="_blank" rel="noreferrer">
            {instagramHandle}
          </a>
        </div>
        <div className="novo-os-side-block">
          <span className="mono muted">LOKACIJA</span>
          <span>{city}</span>
        </div>
      </aside>

      <div className="novo-os-footer">
        <span>© {new Date().getFullYear()} NOVO</span>
        <span>{city}</span>
      </div>

      {exhibitReady && (
        <FloatingWindow
          title="GALERIJA"
          x={exhibit.x}
          y={exhibit.y}
          z={exhibit.z}
          onFocus={bringExhibitFront}
          minimized={exhibit.minimized}
          onToggleMinimize={() => setExhibit((e) => ({ ...e, minimized: !e.minimized }))}
          width={230}
        >
          <ExhibitContent images={exhibitImages} />
        </FloatingWindow>
      )}

      {projectWindows.map((w) => (
        <FloatingWindow
          key={w.key}
          title={w.project.name.toUpperCase()}
          x={w.x}
          y={w.y}
          z={w.z}
          onFocus={() => focusProject(w.key)}
          onClose={() => closeProject(w.key)}
          minimized={w.minimized}
          onToggleMinimize={() => toggleMinimizeProject(w.key)}
          width={260}
        >
          <ProjectContent project={w.project} />
        </FloatingWindow>
      ))}

      {productWindows.map((w) =>
        w.fullscreen ? (
          <ProductFullscreenPage
            key={w.key}
            product={w.product}
            contactEmail={contactEmail}
            onExitFullscreen={() => toggleFullscreenProduct(w.key)}
            onClose={() => closeProduct(w.key)}
          />
        ) : (
          <FloatingWindow
            key={w.key}
            title={w.product.name.toUpperCase()}
            x={w.x}
            y={w.y}
            z={w.z}
            onFocus={() => focusProduct(w.key)}
            onClose={() => closeProduct(w.key)}
            minimized={w.minimized}
            onToggleMinimize={() => toggleMinimizeProduct(w.key)}
            onToggleFullscreen={() => toggleFullscreenProduct(w.key)}
            width={260}
          >
            <ProductContent product={w.product} contactEmail={contactEmail} />
          </FloatingWindow>
        )
      )}

      {slovaWindow &&
        (slovaWindow.fullscreen ? (
          <SlovaFullscreenOverlay onExitFullscreen={toggleFullscreenSlova} onClose={closeSlova} />
        ) : (
          <FloatingWindow
            title="CUSTOM SLOVA PO MJERI"
            x={slovaWindow.x}
            y={slovaWindow.y}
            z={slovaWindow.z}
            onFocus={focusSlova}
            onClose={closeSlova}
            minimized={slovaWindow.minimized}
            onToggleMinimize={toggleMinimizeSlova}
            onToggleFullscreen={toggleFullscreenSlova}
            width={260}
          >
            <SlovaTeaserContent onOpenFullscreen={toggleFullscreenSlova} />
          </FloatingWindow>
        ))}
    </div>
  );
}
