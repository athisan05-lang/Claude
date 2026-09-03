/** Jaccard-Ähnlichkeit zweier Bezeichnungen anhand ihrer Wortmengen (0 = nichts gemeinsam, 1 = identisch). */
export function descriptionSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().match(/[a-zäöüß0-9]+/g) ?? []);
  const wordsB = new Set(b.toLowerCase().match(/[a-zäöüß0-9]+/g) ?? []);
  if (wordsA.size === 0 || wordsB.size === 0) return 1;

  let intersection = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersection++;
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/** Kleinste paarweise Ähnlichkeit unter mindestens zwei Bezeichnungen, oder null wenn nicht genug Daten. */
export function minPairwiseSimilarity(descriptions: string[]): number | null {
  const nonEmpty = descriptions.filter((d) => d.trim().length > 0);
  if (nonEmpty.length < 2) return null;
  let min = 1;
  for (let i = 0; i < nonEmpty.length; i++) {
    for (let j = i + 1; j < nonEmpty.length; j++) {
      min = Math.min(min, descriptionSimilarity(nonEmpty[i], nonEmpty[j]));
    }
  }
  return min;
}
