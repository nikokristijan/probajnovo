/**
 * Zajednički oblik AI sažetka recenzija. Bez server-only uvoza da ga smiju
 * koristiti i server action (actions/reviews.ts) i klijentska kartica.
 */
export type ReviewSentiment = "positive" | "mixed" | "negative";

export type ReviewSummaryPayload = {
  praises: string[];
  complaints: string[];
  suggestion: string;
  sentiment: ReviewSentiment;
  /** Koliko je recenzija ušlo u sažetak i koliko od njih ima napisan tekst. */
  reviewCount: number;
  withTextCount: number;
  /** Prosjek ocjena upravo tih recenzija, izračunan iz baze (ne od AI-ja). */
  averageRating: number;
  /** ISO vrijeme nastanka sažetka. */
  generatedAt: string;
};

export const SENTIMENT_LABEL: Record<ReviewSentiment, string> = {
  positive: "Pretežno pozitivno",
  mixed: "Mješovito",
  negative: "Pretežno negativno",
};

/** Ispod ovoga sažetak nije pouzdan pa kartica to izričito kaže. */
export const SUMMARY_MIN_TEXT_REVIEWS = 5;

/** Koliko zadnjih recenzija ulazi u sažetak. */
export const REVIEW_SUMMARY_MAX_REVIEWS = 50;
