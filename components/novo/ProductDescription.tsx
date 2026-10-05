type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; text: string }
  | { kind: "ul"; items: string[] };

const BULLET = /^\s*[·•\-*–]\s+/;

/**
 * Opis proizvoda iz admina je običan tekst. Ovdje ga pretvaramo u strukturu:
 * redovi koji počinju s "·", "•" ili "-" postaju popis, kratak red koji
 * završava dvotočkom postaje podnaslov, ostalo su odlomci (prijelomi
 * redova se čuvaju). Admin ne mora pisati nikakav poseban format.
 */
export function parseDescription(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    const last = blocks[blocks.length - 1];
    if (!line) {
      blocks.push({ kind: "p", lines: [] }); // razdjelnik
      continue;
    }
    if (BULLET.test(line)) {
      const item = line.replace(BULLET, "");
      if (last?.kind === "ul") last.items.push(item);
      else blocks.push({ kind: "ul", items: [item] });
      continue;
    }
    if (line.endsWith(":") && line.length <= 60) {
      blocks.push({ kind: "h", text: line.slice(0, -1) });
      continue;
    }
    if (last?.kind === "p" && last.lines.length > 0) last.lines.push(line);
    else blocks.push({ kind: "p", lines: [line] });
  }
  return blocks.filter((b) => b.kind !== "p" || b.lines.length > 0);
}

export default function ProductDescription({ text }: { text: string }) {
  const blocks = parseDescription(text);
  return (
    <div className="pd-desc">
      {blocks.map((b, i) => {
        if (b.kind === "h") {
          return (
            <h3 key={i} className="pd-desc-h mono">
              {b.text.toUpperCase()}
            </h3>
          );
        }
        if (b.kind === "ul") {
          return (
            <ul key={i} className="pd-desc-list">
              {b.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="pd-desc-p">
            {b.lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {l}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
