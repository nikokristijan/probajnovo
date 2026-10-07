import { demoLoginAction } from "@/lib/recenzije/actions/auth";
import { Button } from "@/components/recenzije/ui/button";

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

export function OAuthButtons({ googleEnabled, demoEnabled }: { googleEnabled: boolean; demoEnabled: boolean }) {
  if (!googleEnabled && !demoEnabled) return null;
  return (
    <div className="space-y-2.5">
      {googleEnabled && (
        <Button asChild variant="outline" size="lg" className="w-full">
          {/* Puna navigacija: pokreće Google OAuth preusmjeravanje. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/recenzije/auth/google">
            <GoogleIcon /> Nastavi s Googleom
          </a>
        </Button>
      )}
      {demoEnabled && (
        <form action={demoLoginAction}>
          <Button type="submit" variant="secondary" size="lg" className="w-full">
            Pogledaj primjer pregleda
          </Button>
        </form>
      )}
      <div className="label flex items-center gap-3 py-2 text-subtle">
        <span className="h-px flex-1 bg-border" /> ili emailom <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
