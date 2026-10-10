import { LANG_COOKIE, LANG_COOKIE_MAX_AGE_SECONDS, LANG_STORAGE_KEY } from "./constants";
import { parseLang, type Lang } from "./lang";

/**
 * Mali spremnik izbora jezika u pregledniku (za useSyncExternalStore u lang-switch.tsx). Izbor se pamti u
 * localStorageu (svaki pristup u try/catch: u privatnom prozoru ili uz blokirane podatke može baciti grešku), u kolačiću
 * jezika (da poslužitelj idući put odmah ispiše pravi jezik) i u memoriji (da prekidač radi i kad ništa od toga ne radi).
 */
let memory: Lang | null = null;
const listeners = new Set<() => void>();

export function readSavedLang(): Lang | null {
  if (memory) return memory;
  try {
    return parseLang(window.localStorage.getItem(LANG_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function subscribeLang(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

export function saveLang(next: Lang): void {
  memory = next;
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, next);
  } catch {
    /* localStorage nedostupan */
  }
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${LANG_COOKIE}=${next}; Max-Age=${LANG_COOKIE_MAX_AGE_SECONDS}; Path=/jelovnik; SameSite=Lax${secure}`;
  } catch {
    /* kolačići blokirani */
  }
  listeners.forEach((l) => l());
}
