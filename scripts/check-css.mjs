// Provjera app/globals.css prije builda (plan #11).
//
// Zašto: komentar koji slučajno sadrži "*/" (npr. "--neu-*/--na-*") zatvori
// se prerano i preglednik tiho odbaci pravila iza njega — tako su Portalu
// nestali okviri, a build je svejedno prošao. Ova skripta parsira CSS istim
// parserom kao Tailwind (lightningcss) i ruši build ako nađe grešku.
// Ako lightningcss iz nekog razloga nije instaliran, samo preskoči provjeru.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const files = process.argv.slice(2).length ? process.argv.slice(2) : ["app/globals.css"];

let transform;
try {
  ({ transform } = require("lightningcss"));
} catch {
  console.warn("[check-css] lightningcss nije dostupan — provjera preskočena.");
  process.exit(0);
}

let failed = false;
for (const file of files) {
  const code = readFileSync(file);
  let result;
  try {
    result = transform({ filename: file, code, errorRecovery: true });
  } catch (err) {
    console.error(`[check-css] ${file}: ${err.message}`);
    failed = true;
    continue;
  }
  for (const w of result.warnings) {
    console.error(`[check-css] ${file}:${w.loc?.line ?? "?"}:${w.loc?.column ?? "?"} ${w.message}`);
    failed = true;
  }
  // Dodatna zamka: "*/" unutar komentara ne ruši parser, ali ostatak teksta
  // postane "pravilo" — tražimo komentare koji počinju usred riječi tipa "-*/".
  const text = code.toString();
  const suspicious = /[\w-]\*\/[\w-]/g;
  let m;
  while ((m = suspicious.exec(text))) {
    const line = text.slice(0, m.index).split("\n").length;
    console.error(`[check-css] ${file}:${line} sumnjivo "*/" usred teksta — komentar se tu zatvara.`);
    failed = true;
  }
}

if (failed) {
  console.error("[check-css] CSS ima greške — popravi ih prije objave.");
  process.exit(1);
}
console.log(`[check-css] OK (${files.join(", ")})`);
