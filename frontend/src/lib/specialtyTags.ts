export interface SpecialtyTag {
  slug: string;
  label: string;
}

export const SPECIALTY_TAGS: SpecialtyTag[] = [
  { slug: "slomljeno-srce", label: "Slomljeno srce" },
  { slug: "gubitak-smrt", label: "Gubitak / Smrt u porodici" },
  { slug: "razvod", label: "Razvod" },
  { slug: "alkoholizam", label: "Alkoholizam" },
  { slug: "nevernost", label: "Nevernost" },
  { slug: "anksioznost", label: "Anksioznost" },
  { slug: "depresija", label: "Depresija" },
  { slug: "trauma", label: "Trauma" },
  { slug: "porodicni-sukobi", label: "Porodični sukobi" },
  { slug: "stres-na-poslu", label: "Stres na poslu" },
  { slug: "problemi-u-vezi", label: "Problemi u vezi" },
  { slug: "samopouzdanje", label: "Samopouzdanje" },
  { slug: "panicni-napadi", label: "Panični napadi" },
  { slug: "usamljenost", label: "Usamljenost" },
  { slug: "roditeljstvo", label: "Roditeljstvo" },
  { slug: "nesanica", label: "Nesanica" },
];

export const TAG_LABEL_BY_SLUG: Record<string, string> = Object.fromEntries(
  SPECIALTY_TAGS.map((t) => [t.slug, t.label]),
);

// Keyword STEMS (not full words) -> tag slug, used to suggest tags as the
// client types free text. Serbian is heavily inflected (razvod/razvoda/
// razvodim...), so matching short stems as substrings catches far more
// phrasing than matching whole dictionary words would.
const SYNONYMS: Record<string, string[]> = {
  "slomljeno-srce": ["slomljeno srce", "prekid", "ljubavni jad", "ostavi", "raskid"],
  "gubitak-smrt": ["gubi", "izgubi", "umr", "premin", "sahran", "žalost", "tugu za", "tuga za"],
  razvod: ["razvod", "brak", "muž", "žen", "supružni"],
  alkoholizam: ["alkohol", "pije previše", "zavisnost od"],
  nevernost: ["prevar", "vara me", "vara ga", "vara je", "nevern", "iznever"],
  anksioznost: ["anksio", "brig", "napetost", "napeta", "napet ", "nervoz"],
  depresija: ["depres", "bezvolj", "prazninu", "nemam volje", "nema volje"],
  trauma: ["traum", "zlostavlj", "flešbek"],
  "porodicni-sukobi": ["porodic", "svađ", "roditelj", "sukob"],
  "stres-na-poslu": ["posao", "poslu", "poslom", "na poslu", "šef", "koleg", "izgorel", "burnout"],
  "problemi-u-vezi": ["vezi", "vezu", "veza", "partner"],
  samopouzdanje: ["samopouzdan", "samopoštovanj", "nesigurnost", "nesiguran", "nesigurna"],
  "panicni-napadi": ["panik", "panič"],
  usamljenost: ["usamljen", "sam sam", "sama sam", "nemam nikoga"],
  roditeljstvo: ["dete", "dec", "roditeljstv", "vaspitanj"],
  nesanica: ["nesanic", "besanic", "ne mogu da spavam", "ne spavam"],
};

export function suggestTagsFromText(text: string): string[] {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return [];

  const matches = new Set<string>();
  for (const tag of SPECIALTY_TAGS) {
    if (normalized.includes(tag.label.toLowerCase())) {
      matches.add(tag.slug);
      continue;
    }
    const keywords = SYNONYMS[tag.slug] || [];
    if (keywords.some((k) => normalized.includes(k))) {
      matches.add(tag.slug);
    }
  }
  return Array.from(matches);
}
