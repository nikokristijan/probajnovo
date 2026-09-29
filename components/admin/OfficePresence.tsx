"use client";

import { useEffect, useState, type CSSProperties } from "react";
import OfficeStatusForm from "@/components/admin/OfficeStatusForm";

type Member = {
  email: string;
  isSuperAdmin: boolean;
  lastSeenAt: string | null;
  displayName?: string | null;
  statusText?: string | null;
  statusEmoji?: string | null;
};
type Status = "working" | "away" | "sleeping";

const POLL_MS = 20_000;
/** Pragovi statusa po proteklom vremenu od zadnjeg otkucaja (PresenceHeartbeat
    šalje otkucaj svake minute) — < 2 min "radi" (SJEDI za svojim računalom),
    2-15 min "pauza" (ustao je, ŠETA uredom), inače/nikad "offline" (leži na
    kauču u kutku za odmor). */
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

function hueFor(email: string): number {
  return hashStr(email) % 360;
}

/** Deterministična boja majice avatara iz emaila — isti kolega uvijek ista
    boja, bez potrebe da itko bira/uploada avatar. */
function colorFor(email: string): string {
  return `hsl(${hueFor(email)}, 55%, 48%)`;
}

/** Tamnija nijansa iste majice (bočna sjena/rukav u pikselizranom liku,
    vidi paletteFor) — ista boja tona, samo niža svjetlina. */
function shirtShadeFor(email: string): string {
  return `hsl(${hueFor(email)}, 55%, 32%)`;
}

function labelFor(m: Member): string {
  const dn = m.displayName?.trim();
  return dn && dn.length > 0 ? dn : m.email.split("@")[0];
}

/** Isto što i labelFor, ali za samo-email popise (npr. tjedna ljestvica) gdje
    nemamo cijeli Member objekt — traži u trenutnom `members` popisu za
    displayName, isti fallback na email prefiks ako član u međuvremenu nije
    (više) u timu. */
function labelForEntry(email: string, members: Member[]): string {
  const m = members.find((x) => x.email === email);
  return m ? labelFor(m) : email.split("@")[0];
}

/** Prvo ime/nadimak za name tag iznad lika u sceni — kraće od punog
    labelFor (koji može biti cijeli email prefiks), da tag ne prekrije pola
    ureda kad je više kolega blizu jedno drugom. */
function shortLabelFor(m: Member): string {
  return labelFor(m).split(/\s+/)[0].slice(0, 10);
}

/* --- Lik (avatar): paleta i piksel-grid sprite --------------------- */

const PANTS = "#2c2c34";
const PANTS_SHADOW = "#1c1c22";
const SHOES = "#1c1712";
const SHOE_SOLE = "#0d0a08";
const BELT = "#3d2b1d";
const EYE = "#1a1210";
const EYE_WHITE = "#f5f0e6";
const MOUTH = "#7a3b32";
const COLLAR = "#e8e2d3";
const CUP = "#f4f1ea";
const STEAM = "#c9c2b0";

/** Nekoliko tonova kože i boja kose — birano deterministički po emailu
    (odvojen "salt" od boje majice) da likovi u Uredu izgledaju kao stvaran
    šareni tim (Pokémon/Stardew Valley stil "trenera"), a ne 8 klonova iste
    boje kože i kose s različitom majicom. Svaki niz ima "par" tamnije
    nijanse na ISTOM indeksu (SKIN_SHADOWS/HAIR_SHADOWS) za sjenčanje lica i
    kose u sprite-u (vidi paletteFor) — ne izvodi se runtime iz baze boje
    da nijanse ostanu ručno birane i čitljive na sitnoj razmjeri. */
const SKIN_TONES = ["#f2c9a0", "#e8b98a", "#c9905f", "#a86f45", "#7a4f30"];
const SKIN_SHADOWS = ["#d9a878", "#cf9d6c", "#a8714a", "#87532f", "#5c3620"];
const HAIR_COLORS = ["#2b1c14", "#4a2e1a", "#1a1a1a", "#7a3c1e", "#5c4433", "#c9a24a", "#8a3324"];
const HAIR_SHADOWS = ["#1a100b", "#331f11", "#0d0d0d", "#552910", "#3d2e21", "#a17f34", "#5f2116"];

function skinIdx(email: string): number {
  return hashStr(`${email}#skin`) % SKIN_TONES.length;
}
function hairIdx(email: string): number {
  return hashStr(`${email}#hair`) % HAIR_COLORS.length;
}

/**
 * Piksel-art likovi — sprite je 16×28 piksela, s pravim licem (obrve, oči s
 * bjeloočnicom+zjenicom, usta, sjena čeljusti), dvotonskom sjenom na
 * kosi/koži/majici/hlačama (kao pravi "trainer" sprite iz Pokémona/Stardew
 * Valleyja, ne ravna boja), ovratnikom na majici, VIDLJIVIM rukama sa
 * strane i cipelama s odvojenim đonom. "ASCII pixel art" obrazac — niz
 * stringova, jedan red = jedan red piksela, jedan znak = jedan piksel,
 * "." = providno:
 *   H/h = kosa (baza/sjena), S/s = koža (baza/sjena), W = bjeloočnica,
 *   E = zjenica, B = obrva (boja kose), N = usta, L = rub ovratnika,
 *   C/c = majica (baza/sjena, personalizirano bojom iz colorFor),
 *   P/p = hlače (baza/sjena), K = remen, F/f = cipela (baza/đon).
 * Sprite se crta preko SPRITE_CELL veličine piksela (< 1 SVG jedinica) tako
 * da FIZIČKA veličina lika u sceni ostane ista bez obzira na rezoluciju
 * grida — translate(seat.x, seat.y), NameTag y-offseti i pozicije
 * šalice/pare/Zzz su svi u tim istim "fizičkim" jedinicama.
 * STAND je lik koji stoji/hoda; SIT je gornjih 21 redak STANDA (glava do
 * remena, bez nogu — one su svejedno skrivene iza stola/stolice). SLEEP
 * ponovno koristi STAND rotiran 90°.
 */
const STAND_SPRITE = [
  "......HHHH......",
  "....HHHHHHHH....",
  "...HHHHHHHhhh...",
  "..HHSSSSSSSHhh..",
  ".HHSSSSSSSSSHhh.",
  ".HHSSBBSSBBSSHh.",
  ".HHSSWESSEWSSHh.",
  ".ssSSSSSSSSSSss.",
  ".sSSSSSSSSSSSSs.",
  ".sSSSSSNNSSSSSs.",
  "..sSSSSSSSSSSs..",
  "......sSSs......",
  "...LLCCCCCCLL...",
  ".ccCCCCCCCCCCcc.",
  ".ccCCCCCCCCCCcc.",
  ".ccCCCCCCCCCCcc.",
  ".ccCCCCCCCCCCcc.",
  ".ccCCCCCCCCCCcc.",
  ".ccCCCCCCCCCCcc.",
  "SScCCCCCCCCCCcSS",
  ".KKKKKKKKKKKKKK.",
  "..pPPPp..pPPPp..",
  "..pPPPp..pPPPp..",
  "..pPPPp..pPPPp..",
  "..pPPPp..pPPPp..",
  "..pPPPp..pPPPp..",
  "..FFFFF..FFFFF..",
  "..fffff..fffff..",
] as const;
const SIT_SPRITE = STAND_SPRITE.slice(0, 21);

/** Fiksna ukupna visina lika u SVG jedinicama scene — veličina jednog
    piksela se izvodi iz broja redaka tako da lik uvijek "stane" u istu
    visinu bez obzira mijenja li se rezolucija grida u budućnosti. */
const SPRITE_HEIGHT_UNITS = 16;
const SPRITE_CELL = SPRITE_HEIGHT_UNITS / STAND_SPRITE.length;

type Palette = Record<string, string>;

function paletteFor(email: string): Palette {
  const si = skinIdx(email);
  const hi = hairIdx(email);
  return {
    H: HAIR_COLORS[hi],
    h: HAIR_SHADOWS[hi],
    S: SKIN_TONES[si],
    s: SKIN_SHADOWS[si],
    W: EYE_WHITE,
    E: EYE,
    B: HAIR_COLORS[hi],
    N: MOUTH,
    L: COLLAR,
    C: colorFor(email),
    c: shirtShadeFor(email),
    P: PANTS,
    p: PANTS_SHADOW,
    K: BELT,
    F: SHOES,
    f: SHOE_SOLE,
  };
}

/** Crta jedan piksel-grid sprite kao niz <rect>-ova, centriran vodoravno
    oko sredine retka i "prizemljen" (zadnji red = y:0, uzlazno u minus za
    glavu) — translate(seat.x, seat.y) u sceni postavlja upravo tu točku
    (dno lika) na traženo mjesto. `cell` drži fizičku veličinu lika
    nepromijenjenom bez obzira na broj piksela u gridu. */
function PixelSprite({ sprite, palette, cell = 1 }: { sprite: readonly string[]; palette: Palette; cell?: number }) {
  const rows = sprite.length;
  const cols = sprite[0]?.length ?? 0;
  const centerCol = (cols - 1) / 2;
  return (
    <>
      {sprite.map((row, y) =>
        row.split("").map((ch, x) => {
          const fill = palette[ch];
          if (!fill) return null;
          return (
            <rect
              key={`${y}-${x}`}
              x={(x - centerCol) * cell}
              y={(y - (rows - 1)) * cell}
              width={cell}
              height={cell}
              fill={fill}
            />
          );
        })
      )}
    </>
  );
}

/** Name tag iznad lika ("neka pišu name tagovi... da se zna tko što radi")
    — mala pikselizirana pločica s imenom, uvijek USPRAVNA i čitljiva čak i
    kad je lik ispod nje rotiran (spavanje) ili se ljulja (hod), zato se
    crta IZVAN grupe koja nosi tu animaciju/rotaciju. */
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

/** Status oblačić ("što trenutačno radim", v8) iznad lika — isti "uvijek
    uspravan, izvan animirane grupe" princip kao NameTag (vidi komentar
    ondje), crta se IZNAD name taga (manji y). Prikazuje se samo kad admin
    ima postavljen statusText i/ili statusEmoji (OfficeStatusForm). */
function StatusBubble({ text, emoji, x = 0, y }: { text: string; emoji: string; x?: number; y: number }) {
  const label = emoji && text ? `${emoji} ${text}` : emoji || text;
  const width = Math.max(16, label.length * 3.1 + 6);
  return (
    <g className="office-status-bubble">
      <rect x={x - width / 2} y={y} width={width} height={7} rx={2} fill="rgba(255,127,0,0.92)" />
      <text x={x} y={y + 5} textAnchor="middle" fontSize={4.4} fontFamily="monospace" fontWeight={700} fill="#fff">
        {label}
      </text>
    </g>
  );
}

type Pt = { x: number; y: number };

/**
 * v7 — na izričit zahtjev "napravi ispočetka, ostavi samo likove... nek
 * bude kao Pokemon i Super Mario... čak pregledaj i GitHub jel ima nešto
 * tako": cijeli PROSTOR (pod, zidovi, stolovi, kauč, kuhinja...) više NIJE
 * ručno crtan SVG (v3-v6 su redom bili ravne plohe → pikselizirani "šum" →
 * i dalje su izgledali kao amaterska aproksimacija) — sad je to jedna
 * gotova, PRAVA pixel-art pozadinska slika: "Pixel Office Asset Pack" by
 * 2dPig (itch.io, CC0 licenca — javna domena, slobodno za komercijalnu
 * upotrebu bez atribucije), ista obitelj vizualnog stila kao Pokémon/Stardew
 * Valley "overworld" tileset, koju je korisnik izričito odabrao nakon
 * ponuđenog izbora (pravi CC0 tileset vs. daljnje ručno crtanje). Iz
 * originalne scene su UKLONJENI autorovi vlastiti ljudski/životinjski
 * likovi (pikselski "clone-stamp" preko poda/zida, bez ijednog vidljivog
 * traga) i dodana je jedna dodatna stolica (isti CC0 paket) da svih 5
 * mjesta u timu ima svoje sjedalo — DESKS/COUCH_SEATS niže su kalibrirani
 * točno na tu sliku (public/office/office-scene.png, 256×224px, tile 8px).
 * SUSTAV LIKOVA (PixelSprite/paletteFor/STAND_SPRITE/SIT_SPRITE/NameTag) je
 * namjerno NEDIRNUT — to je jedino što je korisnik tražio da ostane.
 */
const OFFICE_IMAGE_W = 256;
const OFFICE_IMAGE_H = 224;

/** 5 radnih mjesta (stolica + računalo, već nacrtano u pozadinskoj slici) —
    koordinate su "dno" lika koje sjedi (SIT_SPRITE nema noge, pa je ovo
    otprilike visina sjedala stolice), kalibrirano ručno prema stvarnim
    pikselima stolica u office-scene.png. */
const DESKS: Pt[] = [
  { x: 42, y: 158 }, // red 1, lijevi ormarić (SAD zastava)
  { x: 155, y: 160 }, // red 1, desni ormarić (IND zastava)
  { x: 42, y: 186 }, // red 2, lijevi ormarić
  { x: 42, y: 219 }, // red 3, lijevi ormarić
  { x: 240, y: 219 }, // dodatna stolica uz kutak za kavu
];

/** 3-sjedni kauč gore desno u pozadinskoj slici — sjedišta gdje "offline"
    lik leži. */
const COUCH_SEATS: Pt[] = [
  { x: 197, y: 115 },
  { x: 211, y: 115 },
  { x: 225, y: 115 },
];

type SeasonalDecor = { emoji: string; x: number; y: number; size: number; drift?: boolean };

/** Sezonski ukrasi (v8, na izričit zahtjev "sezonske dekoracije npr.
    kape za Božić u prosincu") — sitni emoji postavljeni na fiksna mjesta uz
    rub scene (ne preklapaju stolove/kauč), po TEKUĆEM mjesecu preglednika.
    Namjerno malen popis mjeseci (ne svih 12) — samo prigode gdje je
    dekoracija prepoznatljiva bez da zatrpa scenu; ostatak godine = bez
    ukrasa, isti čist izgled kao dosad. `drift` uključuje blagu CSS
    lebdeću animaciju (office-seasonal-drift) — snijeg/listovi, ne statični
    ukrasi poput bundeve. */
function seasonalDecorItems(): SeasonalDecor[] {
  const month = new Date().getMonth(); // 0 = siječanj
  switch (month) {
    case 11: // prosinac — božićni ukrasi + snijeg
      return [
        { emoji: "🎄", x: 14, y: 30, size: 13 },
        { emoji: "❄️", x: 60, y: 12, size: 6, drift: true },
        { emoji: "❄️", x: 140, y: 8, size: 5, drift: true },
        { emoji: "❄️", x: 200, y: 16, size: 6, drift: true },
        { emoji: "🎅", x: 246, y: 32, size: 11 },
      ];
    case 9: // listopad — Noć vještica
      return [
        { emoji: "🎃", x: 16, y: 212, size: 10 },
        { emoji: "🕸️", x: 244, y: 10, size: 10 },
      ];
    case 1: // veljača — Valentinovo
      return [
        { emoji: "❤️", x: 128, y: 10, size: 7, drift: true },
        { emoji: "❤️", x: 150, y: 18, size: 5, drift: true },
      ];
    case 6:
    case 7: // srpanj/kolovoz — ljeto
      return [{ emoji: "☀️", x: 232, y: 12, size: 12 }];
    default:
      return [];
  }
}

/**
 * "Ured" (Faza 3, v7) — jedna PRAVA CC0 pixel-art pozadinska slika
 * (office-scene.png, vidi opširan komentar iznad DESKS) umjesto ručno
 * crtanog SVG namještaja. `shape-rendering: crispEdges` na okviru drži i
 * likove i sliku oštrima na svakoj CSS širini (v2), a `imageRendering:
 * pixelated` na samoj slici sprječava preglednik da je zamuti pri
 * skaliranju.
 * STATUSI likova: "radi" (working) SJEDI za svojim stolom i tipka, "pauza"
 * (away) HODA uredom (CSS putanja office-walk-loop, kroz otvoreni prolaz
 * ispred stolova) noseći šalicu kave sa sobom, "offline" leži na kauču sa
 * "Zzz". Likovi su detaljni piksel-grid sprite-ovi (kosa/lice/majica/
 * hlače/cipele) s bojom kose i kože nasumičnom po osobi, i svatko nosi
 * čitljiv name tag u samoj sceni.
 */
export default function OfficePresence({
  initialMembers,
  currentEmail,
  leaderboard = [],
}: {
  initialMembers: Member[];
  /** Kad je postavljen, prikazuje se uredljiv "Tvoj status" formular za taj
      red u rosteru (vidi OfficeStatusForm) — izostavljeno = samo za
      pregled (npr. buduća javna/read-only upotreba). */
  currentEmail?: string;
  /** "Tjedna ljestvica" (getWeeklyLeaderboard) — prazno = sekcija se ne
      prikazuje (npr. prvi tjedan bez ijedne akcije). */
  leaderboard?: { email: string; score: number }[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [now, setNow] = useState(() => Date.now());
  const seasonalDecor = useState(seasonalDecorItems)[0];

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
      <svg
        className="office-frame"
        viewBox={`0 0 ${OFFICE_IMAGE_W} ${OFFICE_IMAGE_H}`}
        role="img"
        aria-label="Prisutnost tima u uredu"
      >
        <image
          href="/office/office-scene.png"
          x={0}
          y={0}
          width={OFFICE_IMAGE_W}
          height={OFFICE_IMAGE_H}
          style={{ imageRendering: "pixelated" }}
        />

        {/* --- Avatari: radi (working) = SJEDI za svojim računalom i tipka --- */}
        {byStatus.working.map((m, i) => {
          const seat = DESKS[i % DESKS.length];
          const palette = paletteFor(m.email);
          return (
            <g key={m.email} className="office-char-pos" transform={`translate(${seat.x}, ${seat.y})`}>
              <title>{`${labelFor(m)} · radi`}</title>
              {(m.statusText || m.statusEmoji) && (
                <StatusBubble text={m.statusText ?? ""} emoji={m.statusEmoji ?? ""} y={-28} />
              )}
              <NameTag label={shortLabelFor(m)} y={-20} />
              <g className="office-char-sprite is-typing">
                <PixelSprite sprite={SIT_SPRITE} palette={palette} cell={SPRITE_CELL} />
              </g>
            </g>
          );
        })}

        {/* --- Avatari: pauza (away) = HODA uredom, sa šalicom kave --- */}
        {byStatus.away.map((m, i) => {
          const h = hashStr(m.email);
          const dur = 16 + (h % 7);
          const delay = -((h % dur) + i);
          const style = { "--walk-dur": `${dur}s`, "--walk-delay": `${delay}s` } as unknown as CSSProperties;
          const palette = paletteFor(m.email);
          return (
            <g key={m.email} className="office-char-pos is-walking" style={style}>
              <title>{`${labelFor(m)} · pauza`}</title>
              {/* Name tag (i status oblačić) su IZVAN is-walk-bob grupe —
                  putuju sa likom niz stazu, ali se ne njišu/rotiraju s bob
                  animacijom, ostaju čitljivi. */}
              {(m.statusText || m.statusEmoji) && (
                <StatusBubble text={m.statusText ?? ""} emoji={m.statusEmoji ?? ""} y={-31} />
              )}
              <NameTag label={shortLabelFor(m)} y={-23} />
              <g className="office-char-sprite is-walk-bob">
                <PixelSprite sprite={STAND_SPRITE} palette={palette} cell={SPRITE_CELL} />
                <g className="office-snack-steam" transform="translate(4.5,-9)">
                  <rect x={0} y={0} width={3} height={2.4} fill={CUP} />
                  <rect x={0.3} y={-1.8} width={0.7} height={1.8} fill={STEAM} />
                </g>
              </g>
            </g>
          );
        })}

        {/* --- Avatari: sleeping/offline = leži na kauču, Zzz --- */}
        {byStatus.sleeping.map((m, i) => {
          const seat = COUCH_SEATS[i % COUCH_SEATS.length];
          const palette = paletteFor(m.email);
          return (
            <g key={m.email} className="office-char-pos" transform={`translate(${seat.x}, ${seat.y})`}>
              <title>{`${labelFor(m)} · offline`}</title>
              {/* Lik je rotiran 90° (leži) — tag (i status oblačić) ostaju
                  nerotirani, centrirani iznad "ležećeg" tijela (koje se
                  nakon rotacije proteže u +x smjeru, vidi komentar uz
                  STAND_SPRITE). */}
              {(m.statusText || m.statusEmoji) && (
                <StatusBubble text={m.statusText ?? ""} emoji={m.statusEmoji ?? ""} x={7} y={-20} />
              )}
              <NameTag label={shortLabelFor(m)} x={7} y={-12} />
              <g className="office-char-sprite is-sleep-breathe" transform="rotate(90)">
                <PixelSprite sprite={STAND_SPRITE} palette={palette} cell={SPRITE_CELL} />
              </g>
              <g className="office-zzz" transform="translate(9,-18)">
                <text x={0} y={0} fontSize={7} fontFamily="monospace" fill={STEAM}>
                  z
                </text>
              </g>
            </g>
          );
        })}

        {/* --- Sezonski ukrasi (v8) — fiksni, uz rub scene, ne smetaju
            likovima/stolovima --- */}
        {seasonalDecor.map((d, i) => (
          <text
            key={i}
            x={d.x}
            y={d.y}
            fontSize={d.size}
            textAnchor="middle"
            className={d.drift ? "office-seasonal-decor is-drifting" : "office-seasonal-decor"}
            style={d.drift ? ({ "--drift-delay": `${(i * 0.6) % 3}s` } as unknown as CSSProperties) : undefined}
          >
            {d.emoji}
          </text>
        ))}
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
                {(m.statusText || m.statusEmoji) && (
                  <span className="office-roster-custom-status">
                    {m.statusEmoji} {m.statusText}
                  </span>
                )}
                <span className={`office-roster-status ${statusClass}`} title={statusLabel} />
              </span>
            );
          })
        )}
      </div>

      {leaderboard.length > 0 && (
        <div className="office-leaderboard">
          <span className="office-leaderboard-title">🏆 Tjedna ljestvica</span>
          <div className="office-leaderboard-list">
            {leaderboard.map((row, i) => (
              <span key={row.email} className="office-leaderboard-item">
                <span className="office-leaderboard-rank">{["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`}</span>
                <span className="office-roster-swatch" style={{ background: colorFor(row.email) }} />
                {labelForEntry(row.email, members)}
              </span>
            ))}
          </div>
        </div>
      )}

      {currentEmail && (
        <OfficeStatusForm
          currentText={members.find((m) => m.email === currentEmail)?.statusText ?? null}
          currentEmoji={members.find((m) => m.email === currentEmail)?.statusEmoji ?? null}
        />
      )}
    </div>
  );
}
