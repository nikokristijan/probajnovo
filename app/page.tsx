import Link from "next/link";
import { getAgency, listProperties } from "@/lib/db/queries";

export const revalidate = 0; // uvijek svježe iz baze (admin izmjene odmah vidljive)

function pad(n: number) {
return String(n + 1).padStart(3, "0");
}

export default async function HomePage() {
const [agencyData, propertiesData] = await Promise.all([
getAgency(),
listProperties({ onlyPublished: true }),
]);

const heroTitle =
agencyData?.heroTitle ??
"NOVO is a creative agency working across brand identity, digital design, and film.";
const officeText = agencyData?.officeText ?? "";
const contactEmail = agencyData?.contactEmail ?? "hello@novo.studio";
const instagramHandle = agencyData?.instagramHandle ?? "@novo.hr";
const city = agencyData?.city ?? "Slavonski Brod, Croatia";

return (
<div className="novo">
<header className="novo-header">
<Link href="/" className="novo-logo">
NOVO
</Link>
<nav className="novo-nav">
<a href="#studies">STUDIES</a>
<a href="#office">OFFICE</a>
</nav>
</header>

<section className="hero">
<h1>{heroTitle}</h1>
</section>

<section className="section" id="studies">
<h2 className="section-title">STUDIES</h2>
<div className="studies-head">
<span>NO.</span>
<span>NAME</span>
<span className="col-cat">CATEGORY</span>
<span>YEAR</span>
</div>
{propertiesData.length === 0 && (
<p className="studies-empty">Još nema dodanih vikendica — dodaj prvu u /admin.</p>
)}
{propertiesData.map((p, i) => (
<Link key={p.id} href={`/${p.slug}`} className="studies-row">
<div className="studies-row-grid">
<span className="proj-no">{pad(i)}</span>
<span className="proj-name">{p.name.toUpperCase()}</span>
<span className="proj-cat col-cat">Web platforma / Vikendica</span>
<span className="proj-year">{p.createdAt.getFullYear()}</span>
</div>
</Link>
))}
</section>

<section className="section" id="office" style={{ borderTop: "1px solid rgba(0,0,0,0.1)" }}>
<h2 className="section-title">OFFICE</h2>
<div className="office-grid">
<p className="office-text">{officeText}</p>
<div className="office-contacts">
<a href={`mailto:${contactEmail}`}>{contactEmail}</a>
<a
href={`https://instagram.com/${instagramHandle.replace(/^@/, "")}`}
target="_blank"
rel="noreferrer"
>
{instagramHandle}
</a>
<span>{city}</span>
</div>
</div>
</section>

<footer className="novo-footer">
<span>© {new Date().getFullYear()} NOVO</span>
<span>Slavonski Brod</span>
</footer>
</div>
);
}
