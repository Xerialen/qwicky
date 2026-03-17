// src/utils/nameNormalizer.js
// Multi-stage QuakeWorld name normalization pipeline.
// Each stage feeds the next. Used by teamResolver for matching and by the
// auto-approval engine to clean names before comparison.

// ── Stage 1: QW color code stripping ─────────────────────────────────────────
// ^0-^9 standard color codes; ^h dim, ^d dark, ^i italic, ^r reset, ^b blink.
// Some clients also emit ^{hex3} extended codes — strip those too.
const QW_COLOR_REGEX = /\^[0-9a-zA-Z]|\^{[0-9a-fA-F]{3}}/g;

// ── Stage 2: QW special character table (codes 0x00–0x1F) ────────────────────
// Quake's character set encodes special graphics in 0–31 and their high-bit
// mirrors in 128–159. This table is the authoritative mapping used by qw-stats.
const QW_CHAR_TABLE = {
  0: '',  1: '_', 2: '_', 3: '_', 4: '_',
  5: '.', 6: '*', 7: '.', 8: '=', 9: '=',
  10: ' ', 11: ' ', 12: ' ', 13: '.', 14: '.', 15: '.',
  16: '[', 17: ']',
  18: '0', 19: '1', 20: '2', 21: '3', 22: '4',
  23: '5', 24: '6', 25: '7', 26: '8', 27: '9',
  28: '.', 29: '-', 30: '^', 31: 'v',
};

/**
 * Stage 1: Strip QW color codes (^0–^9, ^h, ^d, extended variants).
 * This is the single biggest cause of name-match failures.
 */
export function stripColorCodes(name) {
  if (typeof name !== 'string') return '';
  return name.replace(QW_COLOR_REGEX, '');
}

/**
 * Stage 2: Normalize high-bit characters (Quake mod-128 encoding).
 * Chars 128–255 are high-bit mirrors of 0–127; subtract 128 to decode.
 * Chars 0–31 are QW graphics; map to ASCII equivalents via QW_CHAR_TABLE.
 */
export function normalizeHighBit(name) {
  if (typeof name !== 'string') return name;
  return name.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code < 128) {
      return code < 32 ? (QW_CHAR_TABLE[code] ?? '') : char;
    }
    const normalized = code - 128;
    if (normalized < 32) return QW_CHAR_TABLE[normalized] ?? '';
    return String.fromCharCode(normalized);
  }).join('');
}

/**
 * Stage 3: Normalize diacritics.
 * NFD decomposition strips combining accent marks.
 * å→a, ö→o, ä→a, ü→u, é→e, ł→l, ś→s, etc.
 * Common for Scandinavian and Polish players in QW.
 */
export function normalizeDiacritics(name) {
  if (typeof name !== 'string') return name;
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Stage 4: Strip decorators.
 * xXnameXx → name, .name. → name, _name_ → name, xxxnameyyy → name.
 * Strips leading/trailing x/X padding, underscores, dots.
 */
export function stripDecorators(name) {
  if (typeof name !== 'string') return name;
  return name
    .replace(/^[xX]{2,}([^xX].+[^xX])[xX]{2,}$/, '$1') // xXfooXx → foo
    .replace(/^_+|_+$/g, '')                              // strip outer underscores
    .replace(/^\.+|\.+$/g, '')                            // strip outer dots
    .trim();
}

/**
 * Stage 5: Normalize leetspeak substitutions.
 * Applied on the matching copy only — never to display names.
 * 4→a, 3→e, 0→o, 1→i, 5→s, 7→t, @→a, $→s.
 */
export function normalizeLeet(name) {
  if (typeof name !== 'string') return name;
  return name
    .replace(/4/g, 'a')
    .replace(/3/g, 'e')
    .replace(/0/g, 'o')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/1/g, 'i')
    .replace(/5/g, 's')
    .replace(/7/g, 't');
}

// ── Stage 6: Clan tag extraction ─────────────────────────────────────────────
// Matches: [tag]name, .tag.name, -tag-name, (tag)name, |tag|name
// Also reversed: name[tag], name(tag).
// Tag length 1–8 chars is typical for QW clans.
const CLAN_TAG_PATTERNS = [
  /^\[([^\]]{1,8})\]/,   // [TAG] prefix
  /^\(([^)]{1,8})\)/,    // (TAG) prefix
  /^\.([^.]{1,8})\./,    // .tag. prefix
  /^-([^-]{1,8})-/,      // -tag- prefix
  /^\|([^|]{1,8})\|/,    // |tag| prefix
  /\[([^\]]{1,8})\]$/,   // [TAG] suffix
  /\(([^)]{1,8})\)$/,    // (TAG) suffix
];

/**
 * Stage 6: Extract clan tag and core name.
 * Returns { core, tag } where core is the name with the clan tag removed.
 */
export function extractCoreAndTag(name) {
  if (typeof name !== 'string') return { core: name, tag: null };
  const trimmed = name.trim();

  for (const pattern of CLAN_TAG_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const tag = match[1].toLowerCase();
      const core = trimmed.replace(match[0], '').trim();
      return { core: core || trimmed, tag };
    }
  }

  return { core: trimmed, tag: null };
}

/**
 * Stage 7: Generate bracket variants of a tag.
 * "[SR]" → ["[sr]", "sr", "(sr)", ".sr.", "-sr-"]
 */
export function generateTagVariants(tag) {
  if (!tag) return [];
  const t = tag.toLowerCase().replace(/[[\]().|_-]/g, '');
  if (!t) return [];
  return [
    `[${t}]`,
    t,
    `(${t})`,
    `.${t}.`,
    `-${t}-`,
  ];
}

// ── Pipeline compositions ─────────────────────────────────────────────────────

/**
 * Base normalization pipeline (stages 1–4 + lowercase).
 * Use for exact/normalized matching. Does NOT apply leet normalization.
 */
export function normalize(rawName) {
  if (typeof rawName !== 'string') return '';
  let name = stripColorCodes(rawName);  // Stage 1
  name = normalizeHighBit(name);        // Stage 2
  name = normalizeDiacritics(name);     // Stage 3
  name = stripDecorators(name);         // Stage 4
  return name.toLowerCase().trim();
}

/**
 * Full normalization including leet (stages 1–5 + lowercase).
 * More aggressive — use for fuzzy matching only, not display.
 */
export function normalizeFull(rawName) {
  let name = normalize(rawName);
  name = normalizeLeet(name);           // Stage 5
  return name;
}

/**
 * Normalize and strip clan tag — returns just the core player/team name.
 */
export function normalizeToCore(rawName) {
  const base = normalize(rawName);
  const { core } = extractCoreAndTag(base);
  return core;
}

/**
 * Describe a raw name — returns all matching-relevant forms.
 * Used by teamResolver to avoid running the pipeline multiple times.
 *
 * @param {string} rawName
 * @returns {{
 *   raw: string,
 *   colorStripped: string,
 *   normalized: string,
 *   core: string,
 *   tag: string|null,
 *   tagVariants: string[],
 *   normalizedFull: string,
 * }}
 */
export function describe(rawName) {
  const colorStripped = stripColorCodes(rawName || '');
  const normalized = normalize(rawName);
  const { core, tag } = extractCoreAndTag(normalized);
  const normalizedFull = normalizeFull(rawName);
  const tagVariants = tag ? generateTagVariants(tag) : [];

  return {
    raw: rawName,
    colorStripped,
    normalized,
    core,
    tag,
    tagVariants,
    normalizedFull,
  };
}
