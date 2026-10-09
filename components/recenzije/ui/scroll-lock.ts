/*
 * Zaključavanje pomicanja stranice dok je otvorena ladica ili prozor.
 *
 * Brojač umjesto "spremi staro pa vrati": ako su dvije stvari otvorene istodobno (prozor iz prozora)
 * ili se zatvaraju obrnutim redom, stranica se ne smije zaglaviti na overflow:hidden.
 *
 * scrollbar-gutter: kad klasična (ne preklapajuća) traka za pomicanje nestane, stranica bi se
 * proširila za ~15px i sadržaj iza prozora bi poskočio. Zato se mjesto trake zadrži, ali samo ako
 * traka trenutno postoji (na mobitelu je preklapajuća, širine 0, pa se tamo ništa ne mijenja).
 */
let locks = 0;
let saved: { html: string; body: string; overscroll: string; gutter: string } | null = null;

export function lockPageScroll(): () => void {
  const html = document.documentElement;
  const body = document.body;
  if (locks++ === 0) {
    saved = { html: html.style.overflow, body: body.style.overflow, overscroll: html.style.overscrollBehavior, gutter: html.style.scrollbarGutter };
    if (window.innerWidth - html.clientWidth > 0) html.style.scrollbarGutter = "stable";
    // html + body: iOS Safari ponekad gleda samo jedan od njih.
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0 && saved) {
      html.style.overflow = saved.html;
      body.style.overflow = saved.body;
      html.style.overscrollBehavior = saved.overscroll;
      html.style.scrollbarGutter = saved.gutter;
      saved = null;
    }
  };
}
