/**
 * Pure helpers for the charity directory (PRD section 08.2).
 */

const MAX_SEARCH_LENGTH = 60;

/**
 * Make free text safe to embed in a PostgREST `or=(...ilike...)` filter.
 *
 * Commas and parentheses are filter syntax, and `%`, `_` and `*` are wildcards;
 * left in, a search box becomes a way to rewrite the query. They are replaced
 * with spaces rather than escaped because none of them matter in a charity name.
 */
export function sanitizeSearchTerm(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/[,()%_*\\"'.:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
}

export function normaliseCategory(raw: string | null | undefined, known: readonly string[]): string | null {
  if (!raw) return null;
  return known.find((category) => category.toLowerCase() === raw.toLowerCase()) ?? null;
}

export interface CoverTheme {
  /** CSS gradient used when a charity has no photography of its own. */
  gradient: string;
  accent: string;
}

// Palette-derived, so fallback covers look designed rather than missing.
const THEMES: CoverTheme[] = [
  { gradient: "linear-gradient(135deg, #9a3412 0%, #c2410c 45%, #fdba74 100%)", accent: "#fff4ec" },
  { gradient: "linear-gradient(135deg, #1c1917 0%, #44403c 55%, #a8a29e 100%)", accent: "#faf6f0" },
  { gradient: "linear-gradient(135deg, #365314 0%, #4d7c52 50%, #bbf7d0 100%)", accent: "#f0fdf4" },
  { gradient: "linear-gradient(135deg, #78350f 0%, #b45309 50%, #fde68a 100%)", accent: "#fffbeb" },
  { gradient: "linear-gradient(135deg, #1e3a5f 0%, #3f6b8f 55%, #cfe3f0 100%)", accent: "#f0f7fb" },
  { gradient: "linear-gradient(135deg, #581c87 0%, #86198f 50%, #f5d0fe 100%)", accent: "#fdf4ff" },
];

/** Stable per charity: the same slug always gets the same cover. */
export function coverThemeFor(slug: string): CoverTheme {
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return THEMES[hash % THEMES.length];
}

export function initialsFor(name: string): string {
  const words = name.split(/\s+/).filter((word) => /^[A-Za-z]/.test(word));
  const significant = words.filter((word) => !["the", "of", "and", "for", "to"].includes(word.toLowerCase()));
  return (significant.length > 0 ? significant : words)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}
