"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Member = { email: string; isSuperAdmin: boolean; lastSeenAt: string | null; displayName?: string | null };
type Status = "working" | "away" | "sleeping";

const POLL_MS = 20_000;
/** Pragovi statusa po proteklom vremenu od zadnjeg otkucaja (PresenceHeartbeat
    šalje otkucaj svake minute) — < 2 min "radi" (SJEDI za svojim računalom i
    tipka, vidi v5 niže), 2-15 min "pauza" (ustao je, ŠETA uredom — do kuhinje
    na kavu i natrag), inače/nikad "offline" (leži na kauču u kutku za
    odmor). */
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

/** Prvo ime/nadimak za name tag iznad lika u sceni — kraće od punog
    labelFor (koji može biti cijeli email prefiks), da tag ne prekrije pola
    ureda kad je više kolega blizu jedno drugom. */
function shortLabelFor(m: Member): string {
  return labelFor(m).split(/\s+/)[0].slice(0, 10);
}

/* --- Tlocrt: fiksne koordinate namještaja (SVG viewBox 320×208, tile=16px) - */

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
const WOOD = "#8a6a45";
const WOOD_DARK = "#6f5335";
const METAL = "#8b95a3";
const METAL_DARK = "#5b6673";
const CORK = "#c9a26a";
const CORK_DARK = "#a5824f";
const CORK_LIGHT = "#ddbc85";
const WOOD_LIGHT = "#a98552";
const METAL_LIGHT = "#a7b0bd";
const FABRIC = "#4c6f8f";
const FABRIC_DARK = "#38536b";
const FABRIC_LIGHT = "#5f86a8";
const RUST = "#c1543a";
const RUST_DARK = "#9c3f2b";
const RUST_LIGHT = "#d1684f";

/** Nekoliko tonova kože i boja kose — birano deterministički po emailu
    (odvojen "salt" od boje majice) da likovi u Uredu izgledaju kao stvaran
    šareni tim (Pokémon/Stardew Valley stil "trenera"), a ne 8 klonova iste
    boje kože i kose s različitom majicom. Svaki niz ima "par" tamnije
    nijanse na ISTOM indeksu (SKIN_SHADOWS/HAIR_SHADOWS) za sjenčanje lica i
    kose u v4 sprite-u (vidi paletteFor) — ne izvodi se runtime iz baze boje
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
 * Piksel-art likovi (v4) — na izričit ponovljeni zahtjev "Ured takoder mora
 * biti puno detaljniji" (nakon v3 koji je već zamijenio gole pravokutnike
 * 9×16 gridom): sprite je sad 16×28 piksela — skoro 4× više piksela od v3
 * — s pravim licem (obrve, oči s bjeloočnicom+zjenicom, usta, sjena
 * čeljusti), dvotonskom sjenom na kosi/koži/majici/hlačama (kao pravi
 * "trainer" sprite iz Pokémona/Stardew Valleyja, ne ravna boja), ovratnikom
 * na majici, VIDLJIVIM rukama sa strane i cipelama s odvojenim đonom.
 * I dalje isti "ASCII pixel art" obrazac — niz stringova, jedan red = jedan
 * red piksela, jedan znak = jedan piksel, "." = providno:
 *   H/h = kosa (baza/sjena), S/s = koža (baza/sjena), W = bjeloočnica,
 *   E = zjenica, B = obrva (boja kose), N = usta, L = rub ovratnika,
 *   C/c = majica (baza/sjena, personalizirano bojom iz colorFor),
 *   P/p = hlače (baza/sjena), K = remen, F/f = cipela (baza/đon).
 * Sprite se crta preko SPRITE_CELL veličine piksela (< 1 SVG jedinica) tako
 * da FIZIČKA veličina lika u sceni ostane ista kao u v3 (~9×16 jedinica) —
 * dakle sve postojeće translate(seat.x, seat.y), NameTag y-offseti i
 * pozicije šalice/pare/Zzz i dalje pašu bez promjene, samo je sad
 * rezolucija samog lika puno finija.
 * STAND je lik koji stoji/hoda; SIT je gornjih 21 redak STANDA (glava do
 * remena, bez nogu — one su svejedno skrivene iza stola). SLEEP ponovno
 * koristi STAND rotiran 90° (isti trik kao v2/v3).
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

/** Fiksna ukupna visina lika u SVG jedinicama scene (isto kao fizička
    visina v3 sprite-a) — veličina jednog piksela se izvodi iz broja
    redaka tako da lik uvijek "stane" u istu visinu bez obzira mijenja li
    se rezolucija grida u budućnosti. */
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
    glavu) — isti ishodišni ugovor kao v3, pa sve postojeće
    translate(seat.x, seat.y) pozicije u sceni ostaju točne bez promjene.
    `cell` (< 1 za v4-ovu finiju rezoluciju) drži fizičku veličinu lika
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

/**
 * v6 — na izričit i vrlo glasan zahtjev "OVE VELIKE KOCKE NE SMIJU BITI
 * JEDNOBOJNE, ISTO JE U PUNO PIKSELA SVE": nijedna velika ploha namještaja
 * (stol, ormar, hladnjak, kauč...) više se ne crta kao 1-3 ravne boje, nego
 * kao gusti grid sitnih piksela s determiniranom "šum" teksturom
 * (cellNoise → PixelNoise), točno kao u pravim pixel-art tilemapama gdje
 * je svaka ploha zapravo desetci/stotine ručno obojanih piksela. `salt`
 * mijenja uzorak šuma (dvije plohe iste veličine ne izgledaju identično).
 */
function cellNoise(cx: number, cy: number, salt: number): number {
  const n = Math.sin(cx * 127.1 + cy * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function PixelNoise({
  x,
  y,
  width,
  height,
  cell = 2,
  tones,
  weights,
  salt = 0,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  cell?: number;
  tones: string[];
  weights?: number[];
  salt?: number;
}) {
  const cols = Math.max(1, Math.round(width / cell));
  const rows = Math.max(1, Math.round(height / cell));
  const cw = width / cols;
  const ch = height / rows;
  const w = weights ?? tones.map((_, i) => (i === 0 ? 7 : 1));
  const total = w.reduce((a, b) => a + b, 0);
  const rects = [];
  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      const r = cellNoise(rx, ry, salt) * total;
      let acc = 0;
      let tone = tones[0];
      for (let i = 0; i < tones.length; i++) {
        acc += w[i];
        if (r < acc) {
          tone = tones[i];
          break;
        }
      }
      rects.push(<rect key={`${rx}-${ry}`} x={x + rx * cw} y={y + ry * ch} width={cw} height={ch} fill={tone} />);
    }
  }
  return <>{rects}</>;
}

/** Pikselizirani "krug" BEZ SVG <circle> — vodoravne trake čija širina
    prati kružnicu ali je zaokružena na `cell`, kao stepped-edge krug u
    pravom pixel-artu (na izričit zahtjev "ne smiju biti krugovi... sve su
    pikseli" — koristi se za sat, stol za pauzu, zdjelu voća itd.). */
function PixelDisc({
  cx,
  cy,
  r,
  fill,
  cell = 1,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  cell?: number;
}) {
  const steps = Math.max(1, Math.round((r * 2) / cell));
  const rows = [];
  for (let i = 0; i < steps; i++) {
    const yTop = -r + i * cell;
    const yMid = yTop + cell / 2;
    const halfW = Math.sqrt(Math.max(r * r - yMid * yMid, 0));
    const w = Math.max(cell, Math.round((halfW * 2) / cell) * cell);
    rows.push(<rect key={i} x={cx - w / 2} y={cy + yTop} width={w} height={cell} fill={fill} />);
  }
  return <>{rows}</>;
}

type Pt = { x: number; y: number };

/** 4 stola u gornjem redu (leđa okrenuta prozoru) + 4 u donjem redu (leđa
    okrenuta zidu s ormarom) — dvije "face-to-face" grupe uz zajednički
    prolaz, kako radni prostori u uredu doista izgledaju. Sjedišta su točke
    gdje "radi" lik sjedi za SVOJIM računalom (v5 — vidi ComputerDesk). */
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
 * Jedan radni stol S RAČUNALOM (v5, na izričit zahtjev "nek svaki lik moze
 * sjesti za kompjuter i raditi") — prije je "stol" bio samo tamni
 * pravokutnik s jednom narančastom točkicom kao "monitor". Sad je pravo
 * računalo: monitor s kućištem i postoljem, EKRAN koji svijetli (plavkasto
 * "upaljen" izgled) kad netko na tom mjestu stvarno radi (`lit`), s dva
 * piksela "sadržaja" na ekranu i treptavim animiranim sjajem
 * (.office-screen-glow), tipkovnica i miš na stolu, te stolica. Kad mjesto
 * nije zauzeto, ekran je ugašen (tamno siv) — mala, ali bitna razlika koja
 * čitatelju odmah govori koji su stolovi trenutno u upotrebi.
 */
function ComputerDesk({ x, deskY, chairY, lit }: { x: number; deskY: number; chairY: number; lit: boolean }) {
  const screenFill = lit ? "#2f6fb0" : "#20242f";
  return (
    <g>
      <PixelNoise
        x={x - 14}
        y={deskY}
        width={28}
        height={12}
        cell={1.75}
        tones={[WOOD, WOOD_LIGHT, WOOD_DARK]}
        weights={[7, 2, 1]}
        salt={x}
      />
      <rect x={x - 14} y={deskY} width={28} height={3} fill={WOOD_DARK} />
      {/* monitor kućište + postolje */}
      <rect x={x - 6.5} y={deskY - 8} width={13} height={9} fill="#15171f" />
      <rect x={x - 1.2} y={deskY - 0.5} width={2.4} height={1.5} fill="#4b5563" />
      {/* ekran */}
      <rect x={x - 5.3} y={deskY - 6.8} width={10.6} height={6.6} fill={screenFill} />
      {lit && (
        <g className="office-screen-glow">
          <rect x={x - 4.3} y={deskY - 5.6} width={6.5} height={0.9} fill="#bcd9f2" />
          <rect x={x - 4.3} y={deskY - 4} width={4.2} height={0.9} fill="#8fbde3" />
          <rect x={x - 4.3} y={deskY - 2.4} width={5.4} height={0.9} fill="#bcd9f2" />
        </g>
      )}
      {/* tipkovnica + miš */}
      <rect x={x - 6} y={deskY + 3} width={9} height={2.6} fill="#2c2c34" />
      <rect x={x - 5.5} y={deskY + 3.4} width={8} height={0.5} fill="#454554" />
      <rect x={x + 5} y={deskY + 3.2} width={2} height={2} fill="#2c2c34" />
      {/* napajanje / status lampica */}
      <rect x={x - 0.8} y={deskY + 6.2} width={1.2} height={1.2} fill={lit ? "var(--neu-accent)" : "#5c5343"} />
      {/* stolna lampa u kutu stola — kao na referentnim slikama, uvijek
          "upaljena" (ambijentalno svjetlo stola, neovisno o računalu) */}
      <rect x={x + 9.5} y={deskY - 5} width={1.4} height={5} fill="#4b5563" />
      <rect x={x + 7.6} y={deskY - 7.4} width={5.2} height={2.6} fill="#c9a24a" />
      <rect x={x + 8.6} y={deskY - 6.6} width={3.2} height={1.2} fill="#f2d98a" />
      {/* stolica */}
      <rect x={x - 5} y={chairY} width={10} height={10} fill="#4c4038" />
      <rect x={x - 5} y={chairY} width={10} height={2} fill="#3a2f29" />
    </g>
  );
}

/** Biljka u tegli (v6) — na izričit zahtjev "NE SMIJU BITI KRUGOVI ZA OVE
    BILJKE, SVE SU PIKSELI": prijašnja tri preklopljena SVG <circle> lišća su
    UKLONJENA, biljka je sad ručno crtan ASCII piksel-grid (isti obrazac kao
    STAND_SPRITE za likove) — blokasta, nazubljena silueta lišća + teglica s
    rubom, sastavljena isključivo od <rect> "piksela", bliže stvarnoj
    pixel-art tilemap referenci. */
const PLANT_PALETTE: Record<string, string> = {
  D: "#254a2c",
  G: "#3f7d4a",
  g: "#5aa062",
  p: WOOD_DARK,
  P: WOOD,
};
const PLANT_SPRITE = [
  "..DDDD..",
  ".DDGgDD.",
  "DDGgGgDD",
  "DGGGgGGD",
  ".DGgGgD.",
  "..DGGD..",
  "...GG...",
  "..pppp..",
  ".pppppp.",
  "PPPPPPPP",
  "PpppppP.",
  ".PPPPPP.",
] as const;

function Plant({ x, y, cell = 1.3 }: { x: number; y: number; cell?: number }) {
  const rows = PLANT_SPRITE.length;
  const cols = PLANT_SPRITE[0].length;
  const centerCol = (cols - 1) / 2;
  return (
    <g>
      {PLANT_SPRITE.map((row, ry) =>
        row.split("").map((ch, rx) => {
          const fill = PLANT_PALETTE[ch];
          if (!fill) return null;
          return (
            <rect
              key={`${ry}-${rx}`}
              x={x + (rx - centerCol) * cell}
              y={y + (ry - (rows - 1)) * cell}
              width={cell}
              height={cell}
              fill={fill}
            />
          );
        })
      )}
    </g>
  );
}

/** Zidni sat (v5 dekor) — jednostavan, ali odmah čitljiv "ured" detalj. */
function WallClock({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <PixelDisc cx={x} cy={y} r={4.5} fill="#3d2c1f" cell={1} />
      <PixelDisc cx={x} cy={y} r={3.5} fill="#e8e2d3" cell={1} />
      <rect x={x - 0.5} y={y - 3} width={1} height={3} fill="#1a1210" />
      <rect x={x} y={y - 0.6} width={2.2} height={1} fill="#1a1210" />
    </g>
  );
}

/** Uokvirena slika na zidu (v5 dekor) — dvije razlike boje daju varijaciju
    bez da se doda nova paleta samo za ovo. */
function FramedPicture({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g>
      <rect x={x - 6.5} y={y - 4.5} width={13} height={10} fill={WOOD_DARK} />
      <rect x={x - 5.5} y={y - 3.5} width={11} height={8} fill={color} />
    </g>
  );
}

/** Bijela ploča ("whiteboard") uz sastanačku sobu (v5/v6 dekor) — s dvije
    "flomaster" crte i pikseliziranim "grafom" (bez SVG kruga), kao stvaran
    radni doodle. */
function Whiteboard({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={40} height={11} fill="#c9c2b0" />
      <rect x={x} y={y} width={40} height={1.5} fill="#a89f8a" />
      <rect x={x + 4} y={y + 4} width={16} height={1.1} fill="#3b5a8a" />
      <rect x={x + 4} y={y + 7} width={10} height={1.1} fill="#b0483a" />
      {/* pikselizirani "graf" doodle umjesto praznog kruga — nazubljena
          linija od kvadratića, kao flomasterom nacrtan graf na ploči */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect
          key={i}
          x={x + 27 + i * 2.2}
          y={y + 8.5 - [1, 3, 2, 4.5, 3.5, 5.5][i]}
          width={1.6}
          height={1.6}
          fill="#3f7d4a"
        />
      ))}
    </g>
  );
}

/** Polica s knjigama uz kutak za odmor (v5 dekor) — dva reda raznobojnih
    "hrbata" knjiga, umetnuta u tamniji ormarić. */
function Bookshelf({ x, y }: { x: number; y: number }) {
  const spineColors = ["#b0483a", "#3f7d4a", "#5b6b8a", "#c9a24a", "#8a3324", "#6b7280"];
  const rowWidth = 24;
  const spineW = rowWidth / spineColors.length;
  return (
    <g>
      <PixelNoise
        x={x}
        y={y}
        width={rowWidth + 2}
        height={30}
        cell={1.8}
        tones={[WOOD_DARK, "#5a4530", "#2f2417"]}
        weights={[6, 2, 1]}
        salt={x + 1}
      />
      <PixelNoise
        x={x + 1}
        y={y + 1}
        width={rowWidth}
        height={12.5}
        cell={1.6}
        tones={["#3a2c1f", "#2a1f15"]}
        weights={[4, 1]}
        salt={x + 2}
      />
      <PixelNoise
        x={x + 1}
        y={y + 16.5}
        width={rowWidth}
        height={12.5}
        cell={1.6}
        tones={["#3a2c1f", "#2a1f15"]}
        weights={[4, 1]}
        salt={x + 3}
      />
      {spineColors.map((c, i) => (
        <rect key={`top-${i}`} x={x + 1.5 + i * spineW} y={y + 2} width={spineW - 0.6} height={10.5} fill={c} />
      ))}
      {spineColors
        .slice()
        .reverse()
        .map((c, i) => (
          <rect key={`bot-${i}`} x={x + 1.5 + i * spineW} y={y + 17.5} width={spineW - 0.6} height={10.5} fill={c} />
        ))}
    </g>
  );
}

/**
 * Kuhinja / kutak za kavu (v5, POTPUNO NOV prostor — na izričit zahtjev
 * "sam PROSTOR treba biti puno detaljniji... kao oni na slikama za
 * primjer"): zidni ormarići, radna ploča sa sudoperom, aparat za kavu s
 * malom narančastom lampicom, samostojeći hladnjak i okrugli stolić s dvije
 * stolice za pauzu — sve u istoj drveno/metalnoj paleti kao ostatak ureda
 * (WOOD/METAL), bez gradijenata, s gustom pikseliziranom teksturom
 * (PixelNoise) na svakoj većoj plohi umjesto ravne boje (v6), i
 * pikseliziranim "krugovima" (PixelDisc, bez SVG <circle>) za zdjelu voća.
 */
function Kitchen({ x, y }: { x: number; y: number }) {
  const counterW = 92;
  return (
    <g>
      {/* zidni ormarići iznad radne ploče */}
      <PixelNoise x={x} y={y - 11} width={counterW} height={9} cell={1.8} tones={[METAL, METAL_DARK]} weights={[3, 1]} salt={1} />
      {[...Array(5)].map((_, i) => (
        <g key={i}>
          <PixelNoise
            x={x + 2 + i * (counterW / 5)}
            y={y - 10}
            width={counterW / 5 - 2}
            height={7}
            cell={1.6}
            tones={["#9aa3af", METAL_LIGHT, "#7c8695"]}
            weights={[6, 2, 1]}
            salt={i * 7 + 2}
          />
          <rect x={x + 2 + i * (counterW / 5) + (counterW / 5 - 2) / 2 - 0.3} y={y - 9} width={0.6} height={5} fill="#6b7280" />
        </g>
      ))}
      {/* radna ploča */}
      <PixelNoise x={x} y={y} width={counterW} height={13} cell={1.8} tones={[WOOD, WOOD_LIGHT, WOOD_DARK]} weights={[7, 2, 1]} salt={3} />
      <rect x={x} y={y} width={counterW} height={3} fill={WOOD_DARK} />
      {/* sudoper */}
      <rect x={x + 6} y={y + 3} width={15} height={7} fill={METAL} />
      <rect x={x + 8} y={y + 4.5} width={11} height={4.5} fill={METAL_DARK} />
      {/* aparat za kavu */}
      <rect x={x + 34} y={y - 9} width={10} height={12} fill="#2c2c34" />
      <rect x={x + 35.5} y={y - 2.5} width={7} height={3.5} fill={WOOD} />
      <rect x={x + 37.5} y={y - 7} width={2.2} height={2.2} fill="var(--neu-accent)" />
      {/* aparat za tost + posuda za voće, radi životnosti radne ploče —
          zdjela i voće su sad pikselizirani "krugovi" (PixelDisc), ne
          SVG <circle> */}
      <rect x={x + 50} y={y - 4} width={9} height={4} fill="#7c8695" />
      <PixelDisc cx={x + 70} cy={y + 5} r={5} fill="#b0483a" cell={1} />
      <PixelDisc cx={x + 70} cy={y + 4.3} r={4} fill="#c1543a" cell={1} />
      <PixelDisc cx={x + 68} cy={y + 3.5} r={2.2} fill="#c9a24a" cell={1} />
      <PixelDisc cx={x + 71.5} cy={y + 2.8} r={1.8} fill="#8a3324" cell={1} />
      {/* samostojeći hladnjak, lijevo od radne ploče */}
      <PixelNoise x={x - 17} y={y - 19} width={15} height={34} cell={1.8} tones={[METAL, METAL_LIGHT, METAL_DARK]} weights={[6, 2, 1]} salt={11} />
      <rect x={x - 17} y={y - 19} width={15} height={2} fill="#7c8695" />
      <rect x={x - 5} y={y - 10} width={1.6} height={6} fill={METAL_DARK} />
      <rect x={x - 5} y={y + 2} width={1.6} height={6} fill={METAL_DARK} />
    </g>
  );
}

/** Okrugli stolić s dvije stolice za pauzu (v5 dekor) — kraj kuhinje, gdje
    "pauza" (away) kolege mogu stati dok šeću uredom. */
function BreakTable({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <PixelDisc cx={x} cy={y} r={9} fill={WOOD_DARK} cell={1.2} />
      <PixelDisc cx={x} cy={y} r={7.3} fill={WOOD} cell={1.2} />
      {/* fina drvena tekstura na okrugloj ploči, umjesto jedne ravne boje */}
      <rect x={x - 5.5} y={y - 1} width={11} height={0.7} fill={WOOD_DARK} opacity={0.5} />
      <rect x={x - 4.5} y={y + 1.5} width={9} height={0.7} fill={WOOD_LIGHT} opacity={0.6} />
      <rect x={x - 3.5} y={y - 3.5} width={7} height={0.6} fill={WOOD_LIGHT} opacity={0.5} />
      <rect x={x - 13} y={y + 6} width={7} height={7} fill="#4c4038" />
      <rect x={x + 6} y={y + 6} width={7} height={7} fill="#4c4038" />
    </g>
  );
}

/** Aparat za vodu (v5 dekor, uz referentne slike) — bočni ormarić uz zid,
    prepoznatljiv po plavičastom "vrču" na vrhu. */
function WaterCooler({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <PixelNoise x={x - 4} y={y} width={8} height={14} cell={1.3} tones={["#e8e2d3", "#dcd5c4", "#c9c2b0"]} weights={[6, 2, 1]} salt={5} />
      <rect x={x - 4} y={y + 10} width={8} height={1} fill="#c9c2b0" />
      <rect x={x - 1} y={y + 4} width={2} height={2} fill="#3b5a8a" />
      <rect x={x - 3.2} y={y - 8} width={6.4} height={8.5} fill="#bfe0ee" opacity={0.85} />
      <rect x={x - 3.2} y={y - 8} width={6.4} height={2} fill="#89b7c9" />
    </g>
  );
}

/** Mali stolić s pisačem/kopirkom (v5 dekor) — printer s ladicom za papir i
    treptavom lampicom, čest detalj na referentnim uredskim tilemapama. */
function Printer({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <PixelNoise x={x - 10} y={y + 6} width={20} height={7} cell={1.4} tones={[WOOD_DARK, "#5a4530"]} weights={[4, 1]} salt={6} />
      <PixelNoise x={x - 8} y={y - 3} width={16} height={9} cell={1.4} tones={["#c9c2b0", "#bdb5a1", "#a89f8a"]} weights={[6, 2, 1]} salt={7} />
      <rect x={x - 8} y={y - 3} width={16} height={2} fill="#a89f8a" />
      <rect x={x - 6} y={y + 2.2} width={12} height={1.6} fill="#8a8272" />
      <rect x={x + 4.5} y={y - 1.5} width={1.4} height={1.4} fill="var(--neu-accent)" />
    </g>
  );
}

/** Plutena ploča za obavijesti ("corkboard") uz bijelu ploču (v5 dekor) —
    nekoliko obojanih "papirića" i pribadača, kako je i na priloženim
    referentnim slikama pokraj whiteboarda. */
function Corkboard({ x, y }: { x: number; y: number }) {
  const notes = [
    { dx: 3, dy: 2, w: 8, h: 6, fill: "#e8c86a" },
    { dx: 13, dy: 3.5, w: 7, h: 5.5, fill: "#bfe0ee" },
    { dx: 5, dy: 9, w: 7.5, h: 5.5, fill: "#e69a8a" },
  ];
  return (
    <g>
      <rect x={x} y={y} width={24} height={17} fill={CORK_DARK} />
      <PixelNoise x={x + 1} y={y + 1} width={22} height={15} cell={1.1} tones={[CORK, CORK_LIGHT, CORK_DARK]} weights={[6, 2, 1]} salt={9} />
      {notes.map((n, i) => (
        <g key={i}>
          <rect x={x + n.dx} y={y + n.dy} width={n.w} height={n.h} fill={n.fill} />
          <rect x={x + n.dx + 0.5} y={y + n.dy + 0.5} width={1.1} height={1.1} fill="#9c3f2b" />
        </g>
      ))}
    </g>
  );
}

/**
 * "Ured" — pravi pikselizirani tlocrt tima (Faza 3, v5 — nakon v4 "sam LIK
 * puno detaljniji", na novi izričit zahtjev "sam PROSTOR treba biti puno
 * detaljniji... nek svaki lik moze sjesti za kompjuter i raditi... napravi
 * zanimljivije i najbitnije, puno puno ljepse"): SVAKI stol sad ima pravo
 * računalo (ComputerDesk — monitor s upaljenim/ugašenim ekranom, tipkovnica,
 * miš), dodan je potpuno nov kutak za kavu/kuhinju (Kitchen + BreakTable),
 * polica s knjigama i tepih uz kauč, bijela ploča i uokvirene slike uz
 * sastanačku sobu, zidni sat, tepih-staza kroz sredinu ureda, pod s
 * dvotonskim pločicama umjesto ravne boje, te sitni detalji s referentnih
 * slika koje je korisnik priložio — stolna lampa na svakom stolu, aparat za
 * vodu i pisač uz ormar, i plutena ploča s "papirićima" uz whiteboard.
 * STATUSI likova su ZAMIJENJENI
 * mjestima da imaju smisla s "radi = za računalom": "radi" (working) sad
 * SJEDI za SVOJIM stolom i tipka (ComputerDesk toj osobi pali ekran —
 * `occupiedDesks`), "pauza" (away) sad HODA uredom (prijašnja animacija za
 * "radi", zajednička CSS putanja office-walk-loop) noseći šalicu kave sa
 * sobom, "offline" i dalje leži na kauču sa "Zzz" (nepromijenjeno). Likovi
 * su detaljni piksel-grid sprite-ovi (kosa/lice/majica/hlače/cipele, vidi
 * STAND_SPRITE/SIT_SPRITE/PixelSprite) s bojom kose i kože nasumičnom po
 * osobi, i svatko nosi čitljiv name tag u samoj sceni (NameTag). Sve je SVG
 * (rect/circle, shape-rendering:crispEdges) — bez gradijenata (sjene su
 * dvotonske plohe, ne CSS gradient), jedini brend akcent je mala
 * narančasta (--neu-accent) lampica na svakom UKLJUČENOM računalu i na
 * aparatu za kavu. Nadahnuto RPG-tilemap referencama koje je korisnik
 * priložio, ali namjerno originalan raspored/paleta — ne kopija.
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

  /** Koji su stolovi trenutno zauzeti nekim "radi" kolegom — koristi se za
      paljenje ekrana na ComputerDesk (isti i%DESKS.length raspored kao kad
      se avatar crta niže, da se poklapa 1:1). */
  const occupiedDesks = new Set(byStatus.working.map((_, i) => i % DESKS.length));

  return (
    <div className="office-wrap">
      <svg className="office-frame" viewBox="0 0 320 208" role="img" aria-label="Prisutnost tima u uredu">
        <defs>
          <pattern id="office-floor-tiles" width={32} height={32} patternUnits="userSpaceOnUse">
            <rect width={32} height={32} fill="#e7d3a6" />
            <rect width={16} height={16} fill="#e2cc9c" />
            <rect x={16} y={16} width={16} height={16} fill="#e2cc9c" />
            <rect width={32} height={1} y={15} fill="#ddc492" opacity={0.6} />
            <rect width={32} height={1} y={31} fill="#ddc492" opacity={0.6} />
            <rect width={1} height={32} x={15} fill="#ddc492" opacity={0.4} />
            <rect width={1} height={32} x={31} fill="#ddc492" opacity={0.4} />
          </pattern>
        </defs>

        {/* Zidovi + pod */}
        <rect x={0} y={0} width={320} height={208} fill="#3d2c1f" />
        <rect x={8} y={8} width={304} height={192} fill="url(#office-floor-tiles)" />

        {/* Tepih-staza kroz sredinu ureda (v5 dekor) — dugačka staza kroz
            prolaz između dva reda stolova, sa "obrubom". */}
        <rect x={20} y={84} width={170} height={16} fill="#8a4636" />
        <rect x={22} y={86} width={166} height={12} fill="#b0583f" />
        <rect x={22} y={90} width={166} height={4} fill="#c1543a" opacity={0.6} />

        {/* Prozori na gornjem zidu, s klupčicom i podjelom na dva okna */}
        <rect x={38} y={0} width={36} height={8} fill="#89b7c9" />
        <rect x={40} y={1} width={15} height={6} fill="#bfe0ee" />
        <rect x={57} y={1} width={15} height={6} fill="#bfe0ee" />
        <rect x={38} y={8} width={36} height={2} fill="#6f5335" />
        <rect x={118} y={0} width={36} height={8} fill="#89b7c9" />
        <rect x={120} y={1} width={15} height={6} fill="#bfe0ee" />
        <rect x={137} y={1} width={15} height={6} fill="#bfe0ee" />
        <rect x={118} y={8} width={36} height={2} fill="#6f5335" />

        {/* Zidni sat između prozora + uokvirena slika desno od drugog prozora */}
        <WallClock x={96} y={13} />
        <FramedPicture x={180} y={13} color="#5b6b8a" />

        {/* Vrata na donjem zidu */}
        <rect x={140} y={200} width={32} height={8} fill="#7a5236" />

        {/* Biljke u kutovima */}
        <Plant x={21} y={162} />
        <Plant x={305} y={162} />

        {/* Ormar za dokumente uz desni zid — 3 ladice s ručkama, i aparat za
            vodu odmah pokraj njega (v5, uz referentne slike) */}
        <rect x={296} y={100} width={12} height={28} fill="#6b7280" />
        <PixelNoise x={296} y={100} width={12} height={8.5} cell={1.2} tones={["#5b6673", METAL_LIGHT, "#4a5561"]} weights={[6, 2, 1]} salt={21} />
        <PixelNoise x={296} y={109} width={12} height={9.5} cell={1.2} tones={["#5b6673", METAL_LIGHT, "#4a5561"]} weights={[6, 2, 1]} salt={22} />
        <PixelNoise x={296} y={119} width={12} height={9} cell={1.2} tones={["#5b6673", METAL_LIGHT, "#4a5561"]} weights={[6, 2, 1]} salt={23} />
        <rect x={300.5} y={104} width={3} height={1} fill="#2c2c34" />
        <rect x={300.5} y={113.5} width={3} height={1} fill="#2c2c34" />
        <rect x={300.5} y={123} width={3} height={1} fill="#2c2c34" />
        <WaterCooler x={306} y={70} />
        <Printer x={189} y={35} />

        {/* Stolovi s pravim računalima (2 reda, licem u lice) — ekran
            svijetli samo kad je netko "radi" stvarno tu (occupiedDesks). */}
        {DESKS.map((d, i) => (
          <ComputerDesk key={`desk-${i}`} x={d.x} deskY={d.deskY} chairY={d.chairY} lit={occupiedDesks.has(i)} />
        ))}

        {/* Sastanačka soba: bijela ploča iznad, tepih + stol + 4 stolice s
            naslonima i bocama vode */}
        <Whiteboard x={210} y={9} />
        <Corkboard x={253} y={5} />
        <rect x={206} y={22} width={90} height={58} fill={RUST_DARK} />
        <PixelNoise x={210} y={26} width={82} height={50} cell={3} tones={[RUST, RUST_LIGHT, RUST_DARK]} weights={[7, 2, 1]} salt={31} />
        <PixelNoise x={233} y={41} width={36} height={22} cell={1.8} tones={[WOOD_DARK, "#5a4530"]} weights={[4, 1]} salt={32} />
        <rect x={233} y={41} width={36} height={3} fill={WOOD} />
        <rect x={240} y={48} width={2} height={5} fill="#bfe0ee" />
        <rect x={258} y={48} width={2} height={5} fill="#bfe0ee" />
        {[
          { x: 238, y: 33 },
          { x: 261, y: 33 },
          { x: 238, y: 66 },
          { x: 261, y: 66 },
        ].map((c, i) => (
          <g key={`meeting-chair-${i}`}>
            <rect x={c.x} y={c.y} width={9} height={9} fill="#4c4038" />
            <rect x={c.x} y={c.y < 50 ? c.y : c.y + 7} width={9} height={2} fill="#3a2f29" />
          </g>
        ))}

        {/* Kuhinja / kutak za kavu (v5, nov prostor) + stolić za pauzu */}
        <Kitchen x={38} y={178} />
        <BreakTable x={178} y={180} />

        {/* Tepih + polica s knjigama uz kauč u kutku za odmor */}
        <PixelNoise x={192} y={146} width={98} height={28} cell={3.2} tones={[FABRIC_DARK, FABRIC]} weights={[3, 1]} salt={41} />
        <Bookshelf x={188} y={144} />
        <rect x={216} y={148} width={72} height={22} fill={FABRIC_DARK} />
        <PixelNoise x={218} y={150} width={68} height={16} cell={1.7} tones={[FABRIC, FABRIC_LIGHT, FABRIC_DARK]} weights={[6, 2, 1]} salt={42} />
        <rect x={240} y={150} width={1.5} height={16} fill={FABRIC_DARK} opacity={0.7} />
        <rect x={264} y={150} width={1.5} height={16} fill={FABRIC_DARK} opacity={0.7} />

        {/* --- Avatari: radi (working) = SJEDI za svojim računalom i tipka --- */}
        {byStatus.working.map((m, i) => {
          const seat = DESKS[i % DESKS.length];
          const palette = paletteFor(m.email);
          return (
            <g key={m.email} className="office-char-pos" transform={`translate(${seat.x}, ${seat.y})`}>
              <title>{`${labelFor(m)} · radi`}</title>
              <NameTag label={shortLabelFor(m)} y={-20} />
              <g className="office-char-sprite is-typing">
                <PixelSprite sprite={SIT_SPRITE} palette={palette} cell={SPRITE_CELL} />
              </g>
            </g>
          );
        })}

        {/* --- Avatari: pauza (away) = HODA uredom (do kuhinje i natrag), sa šalicom kave --- */}
        {byStatus.away.map((m, i) => {
          const h = hashStr(m.email);
          const dur = 16 + (h % 7);
          const delay = -((h % dur) + i);
          const style = { "--walk-dur": `${dur}s`, "--walk-delay": `${delay}s` } as unknown as CSSProperties;
          const palette = paletteFor(m.email);
          return (
            <g key={m.email} className="office-char-pos is-walking" style={style}>
              <title>{`${labelFor(m)} · pauza`}</title>
              {/* Name tag je IZVAN is-walk-bob grupe — putuje sa likom niz
                  stazu, ali se ne njiše/rotira s bob animacijom, ostaje
                  čitljiv. */}
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
              {/* Lik je rotiran 90° (leži) — tag ostaje neroti­ran, centriran
                  iznad "ležećeg" tijela (koje se nakon rotacije proteže u
                  +x smjeru, vidi komentar uz STAND_SPRITE). */}
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
