import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./recenzije.css";

export const metadata: Metadata = {
  title: { default: "NOVO Recenzije", template: "%s · NOVO Recenzije" },
  description: "Automatski SMS nakon svakog posla, praćenje klikova, podsjetnici i više Google recenzija za vaš obrt ili tvrtku.",
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RecenzijeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="nr">
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#000",
            color: "#fff",
            border: "none",
            borderRadius: 0,
            fontFamily: "var(--font-space-grotesk), sans-serif",
          },
        }}
      />
    </div>
  );
}
