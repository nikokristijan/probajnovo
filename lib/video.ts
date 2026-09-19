/**
 * Pretvara YouTube/Vimeo "watch"/"share" poveznicu (kakvu admin obično
 * kopira iz preglednika) u <iframe>-friendly embed URL — vidi
 * app/proizvodi/[slug]/page.tsx. Ako format nije prepoznat, vraća poveznicu
 * kakva je (embed vjerojatno neće raditi, ali barem ne baca grešku).
 */
export function toVideoEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return url;
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/")[2];
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      return url;
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
      return url;
    }
    if (u.hostname.includes("vimeo.com")) {
      if (u.hostname.startsWith("player.")) return url;
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
      return url;
    }
    return url;
  } catch {
    return url;
  }
}
