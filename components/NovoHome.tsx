"use client";

import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/* Tipovi                                                              */
/* ------------------------------------------------------------------ */

export type StudyProject = {
  id: number;
  slug: string;
  name: string;
  location: string;
  tagline: string;
  description: string;
  year: number;
  images: string[];
  contactEmail: string;
};

type NovoHomeProps = {
  heroTitle: string;
  officeText: string;
  contactEmail: string;
  instagramHandle: string;
  city: string;
  projects: StudyProject[];
};

type View = "home" | "studies" | "office";

/* ------------------------------------------------------------------ */
/* Halftone placeholder (kad vikendica još nema uploadanih slika)      */
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
    return <img src={src} alt={alt} className={className} />;
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
          {onToggleMinimize && (
            <button
              className="fw-btn"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onToggleMinimize}
              aria-label="Minimiziraj"
            >
              <span className={minimized ? "fw-chevron fw-chevron-up" : "fw-chevron"}>⌄</span>
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
          <a
            href={`mailto:${project.contactEmail}?subject=Upit — ${project.name}`}
            className="mono link"
          >
            KONTAKTIRAJTE NAS ↗
          </a>
          <a href={`/${project.slug}`} className="mono link">
            CIJELA STRANICA ↗
          </a>
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
}: NovoHomeProps) {
  const [view, setView] = useState<View>("home");
  const zCounter = useRef(10);

  const [exhibit, setExhibit] = useState({ x: 40, y: 100, z: 5, minimized: false });
  const [exhibitReady, setExhibitReady] = useState(false);
  const [projectWindows, setProjectWindows] = useState<
    { key: string; project: StudyProject; x: number; y: number; z: number; minimized: boolean }[]
  >([]);
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
      const count = wins.length;
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

  const exhibitImages =
    projects.length > 0
      ? projects.map((p) => ({ src: p.images[0], alt: p.name }))
      : [{ src: undefined, alt: "NOVO" }];

  const instaUrl = `https://instagram.com/${instagramHandle.replace(/^@/, "")}`;

  return (
    <div className="novo-os">
      <div className="novo-os-topbar">
        <span className="novo-os-logo">NOVO</span>
        <span className="novo-os-coords mono muted">
          {coords.x}(X), {coords.y}(Y)
        </span>
      </div>

      <nav className="novo-os-nav">
        <button className={view === "home" ? "novo-os-navbtn active" : "novo-os-navbtn"} onClick={() => setView("home")}>
          HOME
        </button>
        <button
          className={view === "studies" ? "novo-os-navbtn active" : "novo-os-navbtn"}
          onClick={() => setView("studies")}
        >
          STUDIES
        </button>
        <button
          className={view === "office" ? "novo-os-navbtn active" : "novo-os-navbtn"}
          onClick={() => setView("office")}
        >
          OFFICE
        </button>
      </nav>

      <main className="novo-os-main">
        {view === "home" && (
          <div className="novo-os-hero">
            <h1>{heroTitle}</h1>
            <button className="novo-os-cta mono" onClick={() => setView("studies")}>
              POGLEDAJ PROJEKTE ↗
            </button>
          </div>
        )}

        {view === "studies" && (
          <div className="novo-os-panel">
            <h2 className="section-title">STUDIES</h2>
            <div className="studies-head">
              <span>NO.</span>
              <span>NAME</span>
              <span className="col-cat">LOKACIJA</span>
              <span>YEAR</span>
            </div>
            <div className="studies-scroll">
              {projects.length === 0 && (
                <p className="studies-empty">Još nema dodanih projekata — dodaj prvi u /admin.</p>
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

        {view === "office" && (
          <div className="novo-os-panel">
            <h2 className="section-title">OFFICE</h2>
            <p className="office-text">{officeText}</p>
          </div>
        )}
      </main>

      <aside className="novo-os-side">
        <div className="novo-os-side-block">
          <span className="mono muted">INQUIRE</span>
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </div>
        <div className="novo-os-side-block">
          <span className="mono muted">ONLINE</span>
          <a href={instaUrl} target="_blank" rel="noreferrer">
            {instagramHandle}
          </a>
        </div>
        <div className="novo-os-side-block">
          <span className="mono muted">STUDIO</span>
          <span>{city}</span>
        </div>
      </aside>

      <div className="novo-os-footer">
        <span>© {new Date().getFullYear()} NOVO</span>
        <span>Slavonski Brod</span>
      </div>

      {exhibitReady && (
        <FloatingWindow
          title="EXHIBIT"
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
    </div>
  );
}

