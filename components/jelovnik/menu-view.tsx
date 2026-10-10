import type { PublicCategory, PublicItem, PublicMenu, PublicMenuInfo } from "@/lib/recenzije/services/menus";
import { formatPriceCents } from "@/lib/recenzije/menu-format";
import { menuNoun } from "@/lib/recenzije/menu-noun";
import { Bi } from "./bilingual";
import { Brand } from "./brand";
import { CategoryNav } from "./category-nav";
import { Footer, Kicker } from "./chrome";
import { FlashNotice } from "./flash-notice";
import type { Lang } from "./lang";
import { LangSwitch } from "./lang-switch";

function Header({ menu, lang }: { menu: PublicMenuInfo; lang: Lang }) {
  const intro = menu.intro ?? menu.introEn;
  return (
    <header className="jl-wrap jl-head">
      {menu.hasEnglish && (
        <div className="jl-head-top">
          <LangSwitch initial={lang} />
        </div>
      )}
      <Brand name={menu.venueName} logoUrl={menu.logoUrl} />
      <Kicker>{menu.title}</Kicker>
      {intro && (
        <p className="jl-intro">
          <Bi hr={intro} en={menu.intro ? menu.introEn : null} />
        </p>
      )}
    </header>
  );
}

function Item({ item }: { item: PublicItem }) {
  return (
    <li className={item.available ? "jl-item" : "jl-item is-off"}>
      <div className="jl-item-top">
        <h3 className="jl-item-name">
          <Bi hr={item.name} en={item.nameEn} />
        </h3>
        {item.priceCents > 0 && (
          <>
            <span className="jl-leader" aria-hidden />
            <span className="jl-price">{formatPriceCents(item.priceCents)}</span>
          </>
        )}
      </div>
      {item.description && (
        <p className="jl-desc">
          <Bi hr={item.description} en={item.descriptionEn} />
        </p>
      )}
      {item.allergens && (
        <p className="jl-allergens">
          <span className="jl-allergens-label">
            <Bi hr="Alergeni" en="Allergens" />
          </span>
          {": "}
          {item.allergens}
        </p>
      )}
      {!item.available && (
        <p className="jl-off-label">
          <Bi hr="Trenutno nedostupno" en="Currently unavailable" />
        </p>
      )}
    </li>
  );
}

function Section({ category }: { category: PublicCategory }) {
  const headingId = `jl-h-${category.id}`;
  return (
    <section id={`jl-c-${category.id}`} className="jl-sec" aria-labelledby={headingId}>
      <h2 id={headingId} className="jl-sec-h">
        <Bi hr={category.name} en={category.nameEn} />
      </h2>
      <ul className="jl-items">
        {category.items.map((it) => (
          <Item key={it.id} item={it} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Jelovnik: naslov i uvod, ljepljiva traka kategorija, popis stavki i (neobavezni) HR/EN prekidač.
 * Cijeli sadržaj je u HTML-u (radi bez JavaScripta); `lang` je jezik prvog prikaza.
 */
export function MenuView({ menu, lang, flash }: { menu: PublicMenu; lang: Lang; flash: string | null }) {
  const cats = menu.categories;
  return (
    <div className="jl-menu" data-lang={lang}>
      <main className="jl-main">
        <Header menu={menu} lang={lang} />
        {cats.length > 0 ? (
          <>
            <CategoryNav categories={cats.map((c) => ({ id: c.id, name: c.name, nameEn: c.nameEn }))} kind={menu.menuKind} />
            <div className="jl-wrap jl-secs">
              {cats.map((c) => (
                <Section key={c.id} category={c} />
              ))}
            </div>
          </>
        ) : (
          <div className="jl-wrap">
            <p className="jl-empty">
              <Bi hr={`${menuNoun(menu.menuKind).Nom} se još priprema. Pitajte osoblje, rado će vam pomoći.`} en="The menu is being prepared. Please ask our staff." />
            </p>
          </div>
        )}
      </main>
      <Footer kind={menu.menuKind} />
      {flash && <FlashNotice text={flash} />}
    </div>
  );
}

/**
 * Lokal koristi vlastiti jelovnik (PDF ili stranicu): ista vrata, a nakon njih jasan gumb koji ga otvara.
 * Adresa je prethodno provjerena (samo https).
 */
export function ExternalMenuView({ menu, href, flash }: { menu: PublicMenuInfo; href: string; flash: string | null }) {
  const noun = menuNoun(menu.menuKind);
  return (
    <div className="jl-menu" data-lang="hr">
      <main className="jl-main">
        <Header menu={{ ...menu, hasEnglish: false }} lang="hr" />
        <div className="jl-wrap jl-external">
          <a href={href} target="_blank" rel="noopener noreferrer" className="jl-btn">
            Otvori {noun.acc}
          </a>
          <p className="jl-hint">{noun.Nom} se otvara u novoj kartici.</p>
        </div>
      </main>
      <Footer kind={menu.menuKind} />
      {flash && <FlashNotice text={flash} />}
    </div>
  );
}
