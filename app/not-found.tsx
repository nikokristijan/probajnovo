import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{ fontFamily: "var(--font-space-grotesk), Arial, sans-serif" }}
      className="min-h-dvh flex flex-col items-center justify-center text-center px-6 bg-white text-black"
    >
      <span className="text-xs tracking-[0.2em] font-semibold text-black/40 mb-6">
        NOVO
      </span>
      <h1
        className="text-[22vw] sm:text-[9rem] leading-none font-bold"
        style={{ color: "#0000c3" }}
      >
        404
      </h1>
      <p className="text-lg sm:text-xl font-medium mt-2 mb-1">
        Ova stranica ne postoji.
      </p>
      <p className="text-sm text-black/50 max-w-sm mb-8">
        Link je možda zastario ili je stranica uklonjena. Provjeri adresu, ili se vrati na
        početnu.
      </p>
      <Link
        href="/"
        className="text-sm font-semibold text-white rounded-full px-6 py-3 transition-opacity hover:opacity-90"
        style={{ background: "#ff7f00" }}
      >
        Natrag na početnu
      </Link>
    </div>
  );
}
