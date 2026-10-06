/** Dopušteni oblici Google linka za recenzije (g.page, writereview, maps…). */
export const GOOGLE_REVIEW_URL_RE =
  /^https:\/\/(g\.page|search\.google\.com|www\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl|maps\.google\.[a-z.]+)\//;

export const GOOGLE_REVIEW_URL_HINT =
  "Upišite Google link za recenzije (https://g.page/r/… ili https://search.google.com/local/writereview?placeid=…)";
