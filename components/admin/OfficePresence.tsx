"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Member = { email: string; isSuperAdmin: boolean; lastSeenAt: string | null; displayName?: string | null };
type Status = "working" | "away" | "sleeping";

const POLL_MS = 20_000;
/** Pragovi statusa po proteklom vremenu od zadnjeg otkucaja (PresenceHeartbeat
    šalje otkucaj svake minute) — < 2 min "radi" (šeta uredom, aktivan),
    2-15 min "pauza" (sjedi za stolom, kava/keks na stolu), inače/nikad
    "offline" (leži na kauču u kutku za odmor). */
const WORKING_MS = 2 * 60_000;
const AWAY_MS = 15 * 60_000;

function statusOf(lastSeenAt: string | null, now: number): Status {
  if (!lastSeenAt) return "sleeping";
  const diff = now - new Date(lastSeenAt).getTime();
  if (diff < WORKING_MS) return "working";
  if (diff < AWAY_MS) return "away";
  return "sleeping";
}

function hashStr(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return hash;
}

/** Deterministična boja majice avatara iz emaila — isti kolega uvijek ista
    boja, bez potrebe da itko bira/uploada avatar. */
function colorFor(email: string): string {
  const hue = hashStr(email) % 360;
  return `hsl(${hue}, 55%, 48%)`;
}

function labelFor(m: Member): string {
  const dn = m.displayName?.trim();
  return dn && dn.length > 0 ? dn : m.email.split("@")[0];
}

/** Prvo ime/nadimak za name tag iznad lika u sceni — kraće od punog
    labelFor (koji može biti cijeli email prefiks), da tag ne prekrije pola
    ureda kad je više kolega blizu jedno drugom. */
function shortLabelFor(m: Member): string {
  return labelFor(m).split(/\s+/)[0].slice(0, 10);
}

/* --- Tlocrt: fiksne koordinate namještaja (SVG viewBox 320×208, tile=16px) - */

const PANTS = "#2c2c34";
const SHOES = "#1c1712";
const EYE = "#1a1210";
const CUP = "#f4f1ea";
const STEAM = "#c9c2b0";

/** Nekoliko tonova kože i boja kose — birano deterministički po emailu
    (odvojen "salt" od boje majice) da likovi u Uredu izgledaju kao stvaran
    šareni tim (Pokémon/Stardew Valley stil "trenera"), a ne 8 klonova iste
    boje kože i kose s različitom majicom. */
const SKIN_TONES = ["#f2c9a0", "#e8b98a", "#c9905f", "#a86f45", "#7a4f30"];
const HAIR_COLORS = ["#2b1c14", "#4a2e1a", "#1a1a1a", "#7a3c1e", "#5c4433", "#c9a24a", "#8a3324"];

function skinFor(email: string): string {
  return SKIN_TONES[hashStr(`${email}#skin`) % SKIN_TONES.length];
}
function hairFor(email: string): string {
  return HAIR_COLORS[hashStr(`${email}#hair`) % HAIR_COLORS.length];
}

/**
 * Piksel-art likovi (v3) — na izričit zahtjev "napravi puno detaljnijim (u
 * pikselima isto), nešto poput Super Maria i Pokemona": svaki lik je sad
 * pravi 9×16 piksel-grid (glava/kosa/oči/majica/hlače/cipele) umjesto 3-4
 * gola pravokutnika kao u v2. Sprite je definiran kao niz stringova (jedan
 * red = jedan red piksela, jedan znak = jedan piksel), isti "ASCII pixel
 * art" obrazac kao tilemape u retro igrama — čitljivo za uređivati, lako
 * za dodati novu pozu. "." = providno (bez rect-a).
 *   H = kosa, S = koža, E = oko, B = majica (boja iz colorFor, personalizirano),
 *   P = hlače, F = cipele.
 * STAND (16 redaka) je lik koji stoji/hoda; SIT je gornjih 13 redaka STANDA
 * (glava+torzo+bedra, bez potkoljenica/stopala — one su svejedno skrivene
 * iza stola). SLEEP ponovno koristi STAND rotiran 90° (isti trik kao v2),
 * sad samo s puno detaljnijim likom koji se rotira.
 */
const STAND_SPRITE = [
  ".HHHHHHH.",
  "HHHHHHHHH",
  "HHSSSSSHH",
  "HSSESESSH",
  "HSSSSSSSH",
  ".SSSSSSS.",
  "..SSSSS..",
  ".BBBBBBB.",
  "BBBBBBBBB",
  "SBBBBBBBS",
  ".BBBBBBB.",
  "..PPPPP..",
  "..PPPPP..",
  "..PP.PP..",
  "..PP.PP..",
  ".FF...FF.",
] as const;
const SIT_SPRITE = STAND_SPRITE.slice(0, 13);

type Palette = Record<string, string>;

function paletteFor(email: string, shirtColor: string): Palette {
  return { H: hairFor(email), S: skinFor(email), E: EYE, B: shirtColor, P: PANTS, F: SHOES };
}

/** Crta jedan piksel-grid sprite kao niz <rect>-ova, centriran vodoravno
    (stupac 4 od 0-8 = x:0) i "prizemljen" (zadnji red = y:0, uzlazno u
    minus za glavu) — isti ishodišni ugovor kao stari AvatarStand/AvatarSit,
    pa sve postojeće translate(seat.x, seat.y) pozicije u sceni ostaju
    točne bez ikakve promjene. */
function PixelSprite({ sprite, palette }: { sprite: readonly string[]; palette: Palette }) {
  const rows = sprite.length;
  return (
    <>
      {sprite.map((row, y) =>
        row.split("").map((ch, x) => {
          const fill = palette[ch];
          if (!fill) return null;
          return <rect key={`${y}-${x}`} x={x - 4} y={y - (rows - 1)} width={1} height={1} fill={fill} />;
        })
      )}
    </>
  );
}

/** Name tag iznad lika ("neka pišu name tagovi... da se zna tko što radi")
    — mala pikselizirana pločica s imenom, uvijek USPRAVNA i čitljiva čak i
    kad je lik ispod nje rotiran (spavanje) ili ljulja se (hod/idle), zato
    se crta IZVAN grupe koja nosi tu animaciju/rotaciju. */
function NameTag({ label, x = 0, y }: { label: string; x?: number; y: number }) {
  const width = Math.max(14, label.length * 3.4 + 3);
  return (
    <g className="office-name-tag">
      <rect x={x - width / 2} y={y} width={width} height={6} fill="rgba(24,18,14,0.78)" />
      <text x={x} y={y + 4.5} textAnchor="middle" fontSize={4.6} fontFamily="monospace" fontWeight={700} fill="#fff">
        {label}
      </text>
    </g>
  );
}

type Pt = { x: number; y: number };

/** 4 stola u gornjem redu (leđa okrenuta prozoru) + 4 u donjem redu (leđa
    okrenuta zidu s ormarom) — dvije "face-to-face" grupe uz zajednički
    prolaz, kako radni prostori u uredu doista izgledaju. Sjedišta su točke
    gdje "away" lik sjedi (i gdje se crta kava/keks na stolu do njega). */
const DESK_X = [24, 64, 104, 144];
const DESKS: (Pt & { deskY: number; chairY: number })[] = [
  ...DESK_X.map((x) => ({ x: x + 14, y: 47, deskY: 28, chairY: 42 })),
  ...DESK_X.map((x) => ({ x: x + 14, y: 131, deskY: 140, chairY: 126 })),
];

/** 3-sjedni kauč u kutku za odmor — sjedišta gdje "offline" lik leži. */
const COUCH_SEATS: Pt[] = [
  { x: 228, y: 158 },
  { x: 252, y: 158 },
  { x: 276, y: 158 },
];

/**
 * "Ured" — pravi pikselizirani tlocrt tima (Faza 3, v3 — "puno detaljnijim
 * (u pikselima isto), nešto poput Super Maria i Pokemona" + "name tagovi da
 * se zna tko što radi"): stvaran plan kata (dva reda stolova licem u lice,
 * sastanačka soba s tepihom i stolom, kutak za odmor s kaučem, biljke,
 * ormar). Likovi su sad pravi 9×16 piksel-grid sprite-ovi (kosa/oči/majica/
 * hlače/cipele, vidi STAND_SPRITE/SIT_SPRITE/PixelSprite) s bojom kose i
 * kože nasumičnom po osobi (isti hash-trik kao boja majice) umjesto v2-ove
 * 3-4 gola pravokutnika — i svatko nosi čitljiv name tag u samoj sceni
 * (NameTag), ne samo hover title + listu ispod. Online kolege HODAJU
 * uredom (zajednička CSS putanja, vidi .office-char-pos.is-walking /
 * @keyframes office-walk-loop u globals.css, svaki avatar dobiva drukčiji
 * animation-delay/-duration iz hasha emaila pa svi hodaju istom stazom ali
 * u različitim točkama). "Away" lik SJEDI za svojim stolom, kava/keks je
 * nacrtan NA STOLU pored njega. Offline lik leži na kauču u kutku za
 * odmor, sa "Zzz". Sve je SVG (rect-only, shape-rendering:crispEdges) —
 * bez gradijenata, jedini brend akcent je mala narančasta (--neu-accent)
 * lampica na svakom monitoru. Nadahnuto RPG-tilemap referencama koje je
 * korisnik priložio, ali namjerno originalan raspored/paleta — ne kopija.
 */
export default function OfficePresence({ initialMembers }: { initialMembers: Member[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/admin/presence", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.members)) {
          setMembers(data.members);
          setNow(Date.now());
        }
      } catch {
        // Tiho ignoriraj — Ured nije kritična funkcija, stara stanja ostaju vidljiva.
      }
    };
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const byStatus: Record<Status, Member[]> = { working: [], away: [], sleeping: [] };
  for (const m of members) byStatus[statusOf(m.lastSeenAt, now)].push(m);

  return (
    <div className="office-wrap">
      <svg className="office-frame" viewBox="0 0 320 208" role="img" aria-label="Prisutnost tima u uredu">
        <defs>
          <pattern id="office-floor-tiles" width={16} height={16} patternUnits="userSpaceOnUse">
            <rect width={16} height={16} fill="#e7d3a6" />
            <rect width={16} height={1} y={15} fill="#ddc492" opacity={0.6} />
            <rect width={1} height={16} x={15} fill="#ddc492" opacity={0.4} />
          </pattern>
        </defs>

        {/* Zidovi + pod */}
        <rect x={0} y={0} width={320} height={208} fill="#3d2c1f" />
        <rect x={8} y={8} width={304} height={192} fill="url(#office-floor-tiles)" />

        {/* Prozori na gornjem zidu */}
        <rect x={38} y={0} width={36} height={8} fill="#89b7c9" />
        <rect x={40} y={1} width={32} height={6} fill="#bfe0ee" />
        <rect x={118} y={0} width={36} height={8} fill="#89b7c9" />
        <rect x={120} y={1} width={32} height={6} fill="#bfe0ee" />

        {/* Vrata na donjem zidu */}
        <rect x={140} y={200} width={32} height={8} fill="#7a5236" />

        {/* Biljke u kutovima */}
        <circle cx={21} cy={164} r={9} fill="#3f7d4a" />
        <rect x={16} y={170} width={10} height={10} fill="#7a5236" />
        <circle cx={305} cy={164} r={9} fill="#3f7d4a" />
        <rect x={300} y={170} width={10} height={10} fill="#7a5236" />

        {/* Ormar uz desni zid */}
        <rect x={296} y={100} width={12} height={28} fill="#6b7280" />
        <rect x={296} y={110} width={12} height={1} fill="#4b5563" />
        <rect x={296} y={120} width={12} height={1} fill="#4b5563" />

        {/* Stolovi (2 reda, licem u lice) */}
        {DESKS.map((d, i) => (
          <g key={`desk-${i}`}>
            <rect x={d.x - 14} y={d.deskY} width={28} height={12} fill="#8a6a45" />
            <rect x={d.x - 14} y={d.deskY} width={28} height={3} fill="#6f5335" />
            <rect x={d.x - 5} y={d.deskY + 2} width={10} height={7} fill="#20242f" />
            <rect x={d.x - 1} y={d.deskY + 4} width={1.6} height={1.6} fill="var(--neu-accent)" />
            <rect x={d.x - 5} y={d.chairY} width={10} height={10} fill="#4c4038" />
          </g>
        ))}

        {/* Sastanačka soba: tepih + stol + 4 stolice */}
        <rect x={206} y={22} width={90} height={58} fill="#9c3f2b" />
        <rect x={210} y={26} width={82} height={50} fill="#c1543a" />
        <rect x={233} y={41} width={36} height={22} fill="#6f5335" />
        <rect x={233} y={41} width={36} height={3} fill="#8a6a45" />
        <rect x={238} y={33} width={9} height={9} fill="#4c4038" />
        <rect x={261} y={33} width={9} height={9} fill="#4c4038" />
        <rect x={238} y={66} width={9} height={9} fill="#4c4038" />
        <rect x={261} y={66} width={9} height={9} fill="#4c4038" />

        {/* Kauč u kutku za odmor */}
        <rect x={216} y={148} width={72} height={22} fill="#38536b" />
        <rect x={218} y={150} width={68} height={16} fill="#4c6f8f" />
        <rect x={240} y={150} width={1.5} height={16} fill="#38536b" opacity={0.7} />
        <rect x={264} y={150} width={1.5} height={16} fill="#38536b" opacity={0.7} />

        {/* --- Avatari: working = hoda dijeljenom putanjom --- */}
        {byStatus.working.map((m, i) => {
          const h = hashStr(m.email);
          const dur = 16 + (h % 7);
          const delay = -((h % dur) + i);
          const style = { "--walk-dur": `${dur}s`, "--walk-delay": `${delay}s` } as unknown as CSSProperties;
          const palette = paletteFor(m.email, colorFor(m.email));
          return (
            <g key={m.email} className="office-char-pos is-walking" style={style}>
              <title>{`${labelFor(m)} · radi`}</title>
              {/* Name tag je IZVAN is-walk-bob grupe — putuje sa likom niz
                  stazu, ali se ne njiše/rotira s bob animacijom, ostaje
                  čitljiv. */}
              <NameTag label={shortLabelFor(m)} y={-23} />
              <g className="office-char-sprite is-walk-bob">
                <PixelSprite sprite={STAND_SPRITE} palette={palette} />
              </g>
            </g>
          );
        })}

        {/* --- Avatari: away = sjedi za stolom, kava/keks na stolu --- */}
        {byStatus.away.map((m, i) => {
          const seat = DESKS[i % DESKS.length];
          const palette = paletteFor(m.email, colorFor(m.email));
          return (
            <g key={m.email} className="office-char-pos" transform={`translate(${seat.x}, ${seat.y})`}>
              <title>{`${labelFor(m)} · pauza`}</title>
              <NameTag label={shortLabelFor(m)} y={-20} />
              <g className="office-char-sprite is-idle-sway">
                <PixelSprite sprite={SIT_SPRITE} palette={palette} />
              </g>
              <g className="office-snack-steam" transform="translate(9,-12)">
                <rect x={0} y={0} width={5} height={4} fill={CUP} />
                <rect x={0.5} y={-3} width={1} height={3} fill={STEAM} />
                <rect x={2.5} y={-4} width={1} height={4} fill={STEAM} />
              </g>
            </g>
          );
        })}

        {/* --- Avatari: sleeping/offline = leži na kauču, Zzz --- */}
        {byStatus.sleeping.map((m, i) => {
          const seat = COUCH_SEATS[i % COUCH_SEATS.length];
          const palette = paletteFor(m.email, colorFor(m.email));
          return (
            <g key={m.email} className="office-char-pos" transform={`translate(${seat.x}, ${seat.y})`}>
              <title>{`${labelFor(m)} · offline`}</title>
              {/* Lik je rotiran 90° (leži) — tag ostaje neroti­ran, centriran
                  iznad "ležećeg" tijela (koje se nakon rotacije proteže u
                  +x smjeru, vidi komentar uz STAND_SPRITE). */}
              <NameTag label={shortLabelFor(m)} x={7} y={-12} />
              <g className="office-char-sprite is-sleep-breathe" transform="rotate(90)">
                <PixelSprite sprite={STAND_SPRITE} palette={palette} />
              </g>
              <g className="office-zzz" transform="translate(9,-18)">
                <text x={0} y={0} fontSize={7} fontFamily="monospace" fill={STEAM}>
                  z
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* Čitljiv popis ispod scene — pikselizirani likovi u maloj razmjeri
          nisu dovoljno čitljivi sami za sebe (isti fallback kao title="" na
          avataru u sceni, samo uvijek vidljiv, ne samo na hover). */}
      <div className="office-roster">
        {members.length === 0 ? (
          <span className="office-roster-item">Nema članova tima.</span>
        ) : (
          members.map((m) => {
            const status = statusOf(m.lastSeenAt, now);
            const statusLabel = status === "working" ? "radi" : status === "away" ? "pauza" : "offline";
            const statusClass = status === "working" ? "is-working" : status === "away" ? "is-away" : "is-offline";
            return (
              <span key={m.email} className="office-roster-item" title={m.email}>
                <span className="office-roster-swatch" style={{ background: colorFor(m.email) }} />
                {labelFor(m)}
                <span className={`office-roster-status ${statusClass}`} title={statusLabel} />
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}
