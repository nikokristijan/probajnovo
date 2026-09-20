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
 * potpuno ilustrirano, s likom koji reagira na klik, i sadržajem koji se
 * pomiče/rotira na scroll umjesto klasičnog fade-in scrolla.
 *
 * Umjesto pravog WebGL prizora (rizičnije dodati kao novu ovisnost u
 * postojeći Next.js build), 3D dojam se postiže CSS 3D transformacijama
 * (perspective + rotateX/Y) vezanim na scroll poziciju i na
 * IntersectionObserver — maskota se stvarno okreće/pomiče dok skrolaš,
 * razglednica se "otvara" u 3D kad uđe u kadar, kartice brojki upadaju pod
 * kutom kao razbacane polaroid fotke.
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

function useReveal<T extends HTMLElement>() {
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
  return ref;
}

/** Wrapper koji sam poziva useReveal — MILESTONES/STEPS se renderiraju kroz
 * ovu komponentu umjesto pozivanja hooka izravno unutar .map() callbacka
 * (poziv hooka unutar petlje krši Rules of Hooks i puca ESLint build). */
function RevealItem({
  className,
  style,
  children,
}: {
  className: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}

function Envelope() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div className="drop-postcard-stage" ref={ref}>
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

export default function DropExperience() {
  const mascotRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const [poked, setPoked] = useState(false);

  useEffect(() => {
    let raf = 0;
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const heroH = heroRef.current?.offsetHeight ?? 800;
        const progress = Math.min(Math.max(window.scrollY / heroH, 0), 1.4);
        if (mascotRef.current) {
          const rotate = progress * 340;
          const rise = progress * -120;
          const scale = 1 - Math.min(progress, 1) * 0.22;
          mascotRef.current.style.transform = `translateY(${rise}px) rotate(${rotate}deg) scale(${scale})`;
        }
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="drop-page">
      <nav className="drop-nav">
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
      </nav>

      <header id="top" className="drop-hero" ref={heroRef}>
        <div className="drop-cloud drop-cloud--a" />
        <div className="drop-cloud drop-cloud--b" />
        <div className="drop-cloud drop-cloud--c" />
        <Bee pathIndex={0} duration={11} delay={0} style={{ top: "18%", left: "6%" }} />
        <Bee pathIndex={1} duration={9} delay={1.4} scale={0.8} style={{ top: "62%", left: "78%" }} />
        <Bee pathIndex={2} duration={13} delay={0.6} scale={1.1} style={{ top: "40%", left: "40%" }} />

        <div className="drop-hero-inner">
          <Image
            src="/drop/drop-wordmark.png"
            alt="Drop"
            width={1100}
            height={517}
            priority
            className="drop-wordmark"
          />
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

        <div
          className={`drop-mascot${poked ? " is-poked" : ""}`}
          ref={mascotRef}
          onClick={() => {
            setPoked(true);
            window.setTimeout(() => setPoked(false), 600);
          }}
          role="button"
          tabIndex={0}
          aria-label="Kap, maskota Dropa — klikni me"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setPoked(true);
              window.setTimeout(() => setPoked(false), 600);
            }
          }}
        >
          <svg viewBox="0 0 200 220" width="180" height="198">
            <path
              d="M100 8 C150 78 186 118 186 156 A86 86 0 1 1 14 156 C14 118 50 78 100 8 Z"
              fill="#59BCE6"
            />
            <path
              d="M100 8 C150 78 186 118 186 156 A86 86 0 0 1 100 242 Z"
              fill="#3FA6D6"
              opacity="0.55"
            />
            <ellipse className="drop-mascot-eye" cx="76" cy="150" rx="9" ry="12" fill="#1B1B1F" />
            <ellipse className="drop-mascot-eye" cx="124" cy="150" rx="9" ry="12" fill="#1B1B1F" />
            <circle cx="72" cy="146" r="3" fill="#fff" />
            <circle cx="120" cy="146" r="3" fill="#fff" />
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
        </div>
      </header>

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
