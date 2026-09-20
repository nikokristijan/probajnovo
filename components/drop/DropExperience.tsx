"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import "@/app/drop/drop.css";

/**
 * Drop.hr — showcase mikrostranica (drop.probajnovo.com).
 *
 * Izmišljeni brend napravljen ISKLJUČIVO kao portfolio primjer za NOVO
 * (vidi footer na dnu stranice — jasno piše da je koncept, ne pravi
 * proizvod). Referentni "mood" po dogovoru: leoparpeix.com — igrivo,
 * potpuno ilustrirano, s likom koji stvarno reagira (miš/klik/scroll) i
 * slojevitom, "3D" pozadinom umjesto ravnih boja.
 *
 * v2 (nakon feedbacka): maskota je prije radila punu 2D rotate() do 476°
 * na scroll — vizualno se prevrtala naglavačke i lice je postajalo
 * nečitljivo ("izgleda katastrofa"). Sad je rastavljena u 3 sloja koji se
 * NIKAD ne bore oko istog CSS transforma:
 *   stage (JS scroll parallax, blaga translacija/rotacija do max 8°)
 *   → idle (čisti CSS keyframe bob/njihanje, uvijek uključen)
 *     → mascot (CSS custom-property rotateX/Y tilt na hover/mousemove,
 *       preko perspective(), lice nikad ne prelazi ~20° pa ostaje čitljivo).
 * Oči prate kursor (pomak zjenice), klik radi "splash" mikro-interakciju.
 */

const BEE_PATHS = [
  "M4,60 C 40,10 80,10 116,55 S 190,100 230,45",
  "M2,20 C 50,80 90,-10 140,50 S 210,10 250,70",
  "M0,50 C 45,-5 95,95 150,30 S 220,60 260,10",
];

function Bee({
  pathIndex = 0,
  duration = 9,
  delay = 0,
  scale = 1,
  style,
}: {
  pathIndex?: number;
  duration?: number;
  delay?: number;
  scale?: number;
  style?: React.CSSProperties;
}) {
  const [scared, setScared] = useState(false);
  return (
    <div
      className={`drop-bee-track${scared ? " is-scared" : ""}`}
      style={{
        ["--drop-bee-path" as string]: `path("${BEE_PATHS[pathIndex % BEE_PATHS.length]}")`,
        ["--drop-bee-duration" as string]: `${duration}s`,
        ["--drop-bee-delay" as string]: `${delay}s`,
        ["--drop-bee-scale" as string]: scale,
        ...style,
      }}
      onMouseEnter={() => {
        setScared(true);
        window.setTimeout(() => setScared(false), 900);
      }}
      aria-hidden="true"
    >
      <svg className="drop-bee" width="34" height="26" viewBox="0 0 34 26">
        <ellipse className="drop-bee-wing drop-bee-wing--l" cx="14" cy="7" rx="9" ry="6" />
        <ellipse className="drop-bee-wing drop-bee-wing--r" cx="22" cy="7" rx="9" ry="6" />
        <ellipse cx="18" cy="16" rx="14" ry="9" fill="#1B1B1F" />
        <path d="M5 16 h26" stroke="#FFD34D" strokeWidth="5" />
        <path d="M9 10 h18" stroke="#FFD34D" strokeWidth="4" />
        <circle cx="30" cy="14" r="3.4" fill="#1B1B1F" />
      </svg>
    </div>
  );
}

/** Blurani "blob" pozadinski oblici — daju dubinu i pomiču se blago
 * drugačijom brzinom od ostatka sadržaja (parallax) dok se scrolla. */
function Blob({
  variant,
  parallaxRef,
}: {
  variant: "a" | "b" | "c";
  parallaxRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className={`drop-blob-wrap drop-blob-wrap--${variant}`} ref={parallaxRef} aria-hidden="true">
      <div className={`drop-blob drop-blob--${variant}`} />
    </div>
  );
}

/** Valoviti razdjelnik između sekcija — umjesto ravnog reza između boja. */
function WaveDivider({ bg, fill, flip }: { bg: string; fill: string; flip?: boolean }) {
  return (
    <div
      className={`drop-wave${flip ? " drop-wave--flip" : ""}`}
      aria-hidden="true"
      style={{ background: bg, ["--drop-wave-fill" as string]: fill }}
    >
      <svg viewBox="0 0 1200 80" preserveAspectRatio="none">
        <path d="M0,40 C150,85 350,0 600,32 C850,64 1050,8 1200,42 L1200,80 L0,80 Z" />
      </svg>
    </div>
  );
}

/** IntersectionObserver reveal + pointer-tilt (3D naginjanje prema kursoru)
 * u jednom hooku, na istom refu — tako se izbjegava spajanje dva refa na
 * isti DOM node i izbjegava se poziv hooka unutar .map() callbacka (krši
 * Rules of Hooks i puca ESLint build), jer se poziva iz RevealItem-a koji
 * je zaseban komponent. */
function useRevealTilt<T extends HTMLElement>(maxDeg = 8) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.22 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function onPointerMove(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty("--tiltx", `${(-py * maxDeg).toFixed(2)}deg`);
    el.style.setProperty("--tilty", `${(px * maxDeg).toFixed(2)}deg`);
  }
  function onPointerLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--tiltx", "0deg");
    el.style.setProperty("--tilty", "0deg");
  }

  return { ref, onPointerMove, onPointerLeave };
}

function RevealItem({
  className,
  style,
  children,
}: {
  className: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const { ref, onPointerMove, onPointerLeave } = useRevealTilt<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={className}
      style={style}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </div>
  );
}

function Envelope() {
  const { ref, onPointerMove, onPointerLeave } = useRevealTilt<HTMLDivElement>(10);
  return (
    <div className="drop-postcard-stage" ref={ref} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      <div className="drop-postcard">
        <div className="drop-postcard-face drop-postcard-back" />
        <div className="drop-postcard-flap" />
        <div className="drop-postcard-face drop-postcard-front">
          <span className="drop-postcard-stamp">🐝</span>
          <span className="drop-postcard-line" />
          <span className="drop-postcard-line drop-postcard-line--short" />
        </div>
      </div>
    </div>
  );
}

const MILESTONES = [
  { n: "12.482", label: "pretplatnika na čekanju", tilt: -4 },
  { n: "54", label: "grada u regiji", tilt: 3 },
  { n: "31", label: "Drop poslan od starta", tilt: -2 },
  { n: "98%", label: "otvori paket isti dan", tilt: 4 },
  { n: "2024.", label: "godina kad je sve krenulo", tilt: -3 },
  { n: "420 kg", label: "voska potrošeno na pečate*", tilt: 2 },
];

function Milestones() {
  return (
    <div className="drop-grid">
      {MILESTONES.map((m, i) => (
        <RevealItem
          key={m.n}
          className="drop-card drop-reveal"
          style={{
            ["--drop-tilt" as string]: `${m.tilt}deg`,
            transitionDelay: `${i * 90}ms`,
          }}
        >
          <strong>{m.n}</strong>
          <span>{m.label}</span>
        </RevealItem>
      ))}
    </div>
  );
}

const STEPS = [
  {
    emoji: "🐝",
    title: "Prijaviš se",
    body: "Ostaviš adresu — pravu, poštansku, ne email. Ne, ozbiljno, treba nam broj i grad.",
  },
  {
    emoji: "📦",
    title: "Čekaš Drop",
    body: "Svakog 1. u mjesecu roj poleti sa svježim paketom. Bez najave, bez spama — samo dođe.",
  },
  {
    emoji: "✨",
    title: "Otvoriš i uživaš",
    body: "Naljepnice, mini-zine, kod za popust, ponekad i mirisna kartica. Skeniraš QR za bonus, dijeliš na storyju.",
  },
];

function Steps() {
  return (
    <div className="drop-steps">
      {STEPS.map((s, i) => (
        <RevealItem
          className="drop-step drop-reveal"
          key={s.title}
          style={{ transitionDelay: `${i * 120}ms` }}
        >
          <span className="drop-step-emoji">{s.emoji}</span>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
        </RevealItem>
      ))}
    </div>
  );
}

function JoinForm() {
  const [value, setValue] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <form
      className="drop-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        setSent(true);
      }}
    >
      {sent ? (
        <p className="drop-form-thanks">
          Hvala na kapi, {value}! 🐝 (ovo je showcase primjer — Drop stvarno ne postoji, ali NOVO
          može ovako izgraditi tvoj brend.)
        </p>
      ) : (
        <>
          <input
            type="text"
            required
            placeholder="tvoje ime ili @ instagrama"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Ime za pridruživanje roju"
          />
          <button type="submit">Pošalji kap 💧</button>
        </>
      )}
    </form>
  );
}

/** Par kapljica koje prsnu iz maskote na klik — čisti CSS keyframe,
 * uklone se iz DOM-a nakon animacije preko setTimeout u parentu. */
function Splash() {
  return (
    <span className="drop-splash" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className="drop-splash-dot" style={{ ["--drop-splash-angle" as string]: `${i * 60}deg` }} />
      ))}
    </span>
  );
}

export default function DropExperience() {
  const heroRef = useRef<HTMLDivElement | null>(null);
  const mascotStageRef = useRef<HTMLDivElement | null>(null);
  const mascotRef = useRef<HTMLDivElement | null>(null);
  const pupilLRef = useRef<SVGEllipseElement | null>(null);
  const pupilRRef = useRef<SVGEllipseElement | null>(null);
  const wordmarkStageRef = useRef<HTMLDivElement | null>(null);
  const blobARef = useRef<HTMLDivElement | null>(null);
  const blobBRef = useRef<HTMLDivElement | null>(null);
  const blobCRef = useRef<HTMLDivElement | null>(null);
  const [poked, setPoked] = useState(false);
  const [splashes, setSplashes] = useState<number[]>([]);

  // Jedna dijeljena rAF petlja za: scroll-parallax maskote i blobova,
  // ambijentalni tilt wordmarka prema kursoru, i oči koje prate kursor.
  // Sve se okida na scroll ILI pointermove pa je jeftino (nema stalnog
  // rafa dok se ništa ne miče).
  useEffect(() => {
    let raf = 0;
    let pointer = { x: typeof window !== "undefined" ? window.innerWidth / 2 : 0, y: 200 };

    function update() {
      const heroH = heroRef.current?.offsetHeight ?? 800;
      const progress = Math.min(Math.max(window.scrollY / heroH, 0), 1);

      if (mascotStageRef.current) {
        const rise = progress * -70;
        const tilt = progress * 8;
        const scale = 1 - progress * 0.1;
        mascotStageRef.current.style.transform = `translateY(${rise}px) rotate(${tilt}deg) scale(${scale})`;
      }

      if (blobARef.current) blobARef.current.style.transform = `translate3d(0, ${(progress * -50).toFixed(1)}px, 0)`;
      if (blobBRef.current) blobBRef.current.style.transform = `translate3d(0, ${(progress * 60).toFixed(1)}px, 0)`;
      if (blobCRef.current)
        blobCRef.current.style.transform = `translate3d(0, ${(progress * -30).toFixed(1)}px, 0) rotate(${(progress * 14).toFixed(1)}deg)`;

      if (wordmarkStageRef.current && window.innerWidth > 720) {
        const px = pointer.x / window.innerWidth - 0.5;
        const py = pointer.y / window.innerHeight - 0.5;
        wordmarkStageRef.current.style.transform = `perspective(1400px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 8).toFixed(2)}deg)`;
      }

      const mascotEl = mascotRef.current;
      if (mascotEl && (pupilLRef.current || pupilRRef.current)) {
        const rect = mascotEl.getBoundingClientRect();
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.42;
        const dx = pointer.x - cx;
        const dy = pointer.y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const travel = Math.min(3.4, dist / 30);
        const t = `translate(${((dx / dist) * travel).toFixed(1)}px, ${((dy / dist) * travel).toFixed(1)}px)`;
        if (pupilLRef.current) pupilLRef.current.style.transform = t;
        if (pupilRRef.current) pupilRRef.current.style.transform = t;
      }

      raf = 0;
    }
    function schedule() {
      if (!raf) raf = requestAnimationFrame(update);
    }
    function onScroll() {
      schedule();
    }
    function onPointerMove(e: PointerEvent) {
      pointer = { x: e.clientX, y: e.clientY };
      schedule();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    schedule();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  function handlePoke() {
    setPoked(true);
    window.setTimeout(() => setPoked(false), 600);
    const id = Date.now();
    setSplashes((s) => [...s, id]);
    window.setTimeout(() => setSplashes((s) => s.filter((x) => x !== id)), 650);
  }

  function onMascotPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "touch") return;
    const el = mascotRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty("--drop-mascot-tiltx", `${(-py * 20).toFixed(1)}deg`);
    el.style.setProperty("--drop-mascot-tilty", `${(px * 20).toFixed(1)}deg`);
  }
  function onMascotPointerLeave() {
    const el = mascotRef.current;
    if (!el) return;
    el.style.setProperty("--drop-mascot-tiltx", "0deg");
    el.style.setProperty("--drop-mascot-tilty", "0deg");
  }

  return (
    <div className="drop-page">
      <nav className="drop-nav">
        <div className="drop-nav-inner">
          <a href="#top" className="drop-nav-brand">
            <Image src="/drop/drop-badge-blue.png" alt="" width={36} height={36} />
            <span>Drop</span>
          </a>
          <div className="drop-nav-links">
            <a href="#kako-radi">Kako radi</a>
            <a href="#brojke">Brojke</a>
            <a href="#pridruzi-se" className="drop-nav-cta">
              Pridruži se
            </a>
          </div>
        </div>
      </nav>

      <header id="top" className="drop-hero" ref={heroRef}>
        <Blob variant="a" parallaxRef={blobARef} />
        <Blob variant="b" parallaxRef={blobBRef} />
        <Blob variant="c" parallaxRef={blobCRef} />
        <div className="drop-cloud drop-cloud--a" />
        <div className="drop-cloud drop-cloud--b" />
        <div className="drop-cloud drop-cloud--c" />
        <Bee pathIndex={0} duration={11} delay={0} style={{ top: "18%", left: "6%" }} />
        <Bee pathIndex={1} duration={9} delay={1.4} scale={0.8} style={{ top: "62%", left: "78%" }} />
        <Bee pathIndex={2} duration={13} delay={0.6} scale={1.1} style={{ top: "40%", left: "40%" }} />

        <div className="drop-hero-inner">
          <div className="drop-wordmark-stage" ref={wordmarkStageRef}>
            <Image
              src="/drop/drop-wordmark.png"
              alt="Drop"
              width={1100}
              height={517}
              priority
              className="drop-wordmark"
            />
          </div>
          <p className="drop-tagline">Prvi fizički newsletter za digitalnu generaciju.</p>
          <p className="drop-subcopy">
            Svaki mjesec ti u sandučić stiže Drop — mini paket vijesti, poziva i iznenađenja koji
            se ne mogu scrollati. Samo otvoriti.
          </p>
          <a className="drop-scroll-cue" href="#sto-je-drop">
            Skroluj i upoznaj roj
            <span aria-hidden="true">↓</span>
          </a>
        </div>

        <div className="drop-mascot-stage" ref={mascotStageRef}>
          <div className="drop-mascot-shadow" aria-hidden="true" />
          <div className="drop-mascot-idle">
            <div
              className={`drop-mascot${poked ? " is-poked" : ""}`}
              ref={mascotRef}
              onPointerMove={onMascotPointerMove}
              onPointerLeave={onMascotPointerLeave}
              onClick={handlePoke}
              role="button"
              tabIndex={0}
              aria-label="Kap, maskota Dropa — klikni me"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handlePoke();
              }}
            >
              <svg viewBox="0 0 200 220" width="180" height="198" className="drop-mascot-svg" aria-hidden="true">
                <defs>
                  <radialGradient id="dropBodyGrad" cx="35%" cy="28%" r="80%">
                    <stop offset="0%" stopColor="#a9e2fa" />
                    <stop offset="55%" stopColor="#59bce6" />
                    <stop offset="100%" stopColor="#2f8fc4" />
                  </radialGradient>
                </defs>
                <path
                  d="M100 8 C150 78 186 118 186 156 A86 86 0 1 1 14 156 C14 118 50 78 100 8 Z"
                  fill="url(#dropBodyGrad)"
                />
                <path
                  d="M100 8 C150 78 186 118 186 156 A86 86 0 0 1 100 242 Z"
                  fill="#2f8fc4"
                  opacity="0.4"
                />
                <ellipse
                  cx="66"
                  cy="64"
                  rx="20"
                  ry="28"
                  fill="#ffffff"
                  opacity="0.4"
                  transform="rotate(-16 66 64)"
                  style={{ filter: "blur(3px)" }}
                />
                <g className="drop-mascot-eye drop-mascot-eye--l">
                  <ellipse cx="76" cy="150" rx="11" ry="14" fill="#ffffff" />
                  <ellipse ref={pupilLRef} className="drop-mascot-pupil" cx="76" cy="150" rx="7" ry="10" fill="#1B1B1F" />
                  <circle cx="73" cy="146" r="2.6" fill="#fff" />
                </g>
                <g className="drop-mascot-eye drop-mascot-eye--r">
                  <ellipse cx="124" cy="150" rx="11" ry="14" fill="#ffffff" />
                  <ellipse ref={pupilRRef} className="drop-mascot-pupil" cx="124" cy="150" rx="7" ry="10" fill="#1B1B1F" />
                  <circle cx="121" cy="146" r="2.6" fill="#fff" />
                </g>
                <path
                  className="drop-mascot-mouth"
                  d="M82 176 Q100 192 118 176"
                  stroke="#1B1B1F"
                  strokeWidth="5"
                  fill="none"
                  strokeLinecap="round"
                />
                <ellipse cx="60" cy="168" rx="10" ry="6" fill="#F4AACB" opacity="0.7" />
                <ellipse cx="140" cy="168" rx="10" ry="6" fill="#F4AACB" opacity="0.7" />
              </svg>
              {splashes.map((id) => (
                <Splash key={id} />
              ))}
            </div>
          </div>
        </div>
      </header>

      <WaveDivider bg="var(--drop-sky)" fill="var(--drop-cream)" />

      <section id="sto-je-drop" className="drop-section">
        <div className="drop-section-grid">
          <div className="drop-copy">
            <p className="drop-eyebrow">Što je Drop?</p>
            <h2>Zamisli newsletter... ali stvaran.</h2>
            <p>
              Nema inboxa punog promocija. Nema &ldquo;unsubscribe&rdquo; gumba koji se sakrije u
              sitnom tisku. Drop ti svaki mjesec šalje pravu, opipljivu kutijicu — naljepnice,
              mini-zine, kod za popust, ponekad i mirisnu karticu.
            </p>
            <p>Digital fatigue je prošlost. Fizički je novi flex.</p>
          </div>
          <Envelope />
        </div>
      </section>

      <section id="kako-radi" className="drop-section drop-section--alt">
        <p className="drop-eyebrow drop-eyebrow--center">Kako radi</p>
        <h2 className="drop-h2-center">Tri koraka. Nula scrollanja.</h2>
        <Steps />
      </section>

      <WaveDivider bg="var(--drop-cream-deep)" fill="var(--drop-cream)" />

      <section id="brojke" className="drop-section">
        <p className="drop-eyebrow drop-eyebrow--center">Brojke koje zuje</p>
        <h2 className="drop-h2-center">Od pokretanja 2024. rastemo brže od trenda na TikToku.</h2>
        <Milestones />
        <p className="drop-fineprint">*ili barem toliko roj tvrdi. Ne provjeravamo baš svaki mjesec.</p>
      </section>

      <section id="pridruzi-se" className="drop-section drop-section--cta">
        <div className="drop-cta-hive">
          <Bee pathIndex={1} duration={8} delay={0} scale={0.9} style={{ top: "10%", left: "12%" }} />
          <Bee pathIndex={2} duration={10} delay={0.8} scale={0.75} style={{ top: "70%", left: "70%" }} />
          <h2>Budi dio roja.</h2>
          <p>Ostavi ime i javi se roju — dobit ćeš prvi Drop čim poleti (kad-tad, u nekom svemiru).</p>
          <JoinForm />
        </div>
      </section>

      <footer className="drop-footer">
        <div className="drop-footer-brand">
          <Image src="/drop/drop-badge-black.png" alt="" width={28} height={28} />
          <span>Drop.hr</span>
        </div>
        <p>
          Drop je izmišljeni brend — koncept i dizajn za portfolio.{" "}
          <a href="https://probajnovo.com">Napravio NOVO studio →</a>
        </p>
      </footer>
    </div>
  );
}
