// src/utils/teamResolver.js
// Smart team name resolver with multi-tier confidence scoring.
// Replaces the duplicated alias logic scattered across 5+ components.
//
// Resolution priority (confidence score):
//   100 — exact match (case-insensitive, after color-code stripping)
//    95 — normalized match (full pipeline without leet)
//    90 — tag match (with bracket variants: [sr], sr, (sr), .sr.)
//    85 — core name match (after stripping clan tags from both sides)
//    80 — alias match (from team_aliases table)
//    70 — fuzzy high (Jaro-Winkler ≥ 0.92 on normalized names)
//    60 — fuzzy medium (Jaro-Winkler ≥ 0.80 or Dice coefficient ≥ 0.70)
//     0 — no match

import {
  normalize,
  normalizeFull,
  normalizeToCore,
  describe,
  generateTagVariants,
} from './nameNormalizer.js';

// ── Jaro-Winkler distance ─────────────────────────────────────────────────────

function jaro(s1, s2) {
  if (s1 === s2) return 1.0;
  const len1 = s1.length;
  const len2 = s2.length;
  if (!len1 || !len2) return 0.0;

  const matchDist = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0);
  const s1m = new Array(len1).fill(false);
  const s2m = new Array(len2).fill(false);
  let matches = 0;

  for (let i = 0; i < len1; i++) {
    const lo = Math.max(0, i - matchDist);
    const hi = Math.min(i + matchDist + 1, len2);
    for (let j = lo; j < hi; j++) {
      if (!s2m[j] && s1[i] === s2[j]) {
        s1m[i] = s2m[j] = true;
        matches++;
        break;
      }
    }
  }

  if (!matches) return 0.0;

  let t = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1m[i]) continue;
    while (!s2m[k]) k++;
    if (s1[i] !== s2[k]) t++;
    k++;
  }

  return (matches / len1 + matches / len2 + (matches - t / 2) / matches) / 3;
}

/**
 * Jaro-Winkler similarity (0–1). Higher = more similar.
 * Prefix weighting suits QW aliases that share recognizable prefixes
 * but differ in suffixes (e.g., "xantom" vs "xantom4ever").
 */
export function jaroWinkler(s1, s2) {
  const j = jaro(s1, s2);
  let prefix = 0;
  const limit = Math.min(4, s1.length, s2.length);
  for (let i = 0; i < limit; i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return j + prefix * 0.1 * (1 - j);
}

/**
 * Sørensen–Dice coefficient on character bigrams (0–1).
 * Complements Jaro-Winkler for names with transpositions.
 */
function dice(s1, s2) {
  if (!s1.length || !s2.length) return 0;
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return s1 === s2 ? 1 : 0;

  const bigrams1 = new Map();
  for (let i = 0; i < s1.length - 1; i++) {
    const bg = s1.slice(i, i + 2);
    bigrams1.set(bg, (bigrams1.get(bg) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bg = s2.slice(i, i + 2);
    const count = bigrams1.get(bg) || 0;
    if (count > 0) {
      intersection++;
      bigrams1.set(bg, count - 1);
    }
  }

  return (2 * intersection) / (s1.length - 1 + s2.length - 1);
}

// ── Team resolution ───────────────────────────────────────────────────────────

/**
 * Resolve a raw QW team name to a known team in the division.
 *
 * @param {string} rawName - Name as received from Hub/Discord (may have color codes, high-bit chars, etc.)
 * @param {Array}  divisionTeams - Teams from the current division (each has id, name, tag, …)
 * @param {Array}  [globalAliases] - Alias rows from team_aliases table
 *   Each: { alias: string, canonical: string, is_global: boolean, tournament_id: string }
 *
 * @returns {{
 *   match: object|null,   // matched team object, or null
 *   confidence: number,   // 0–100
 *   method: string,       // how it was resolved
 *   normalized: string,   // the cleaned name that was matched against
 * }}
 */
export function resolveTeamName(rawName, divisionTeams, globalAliases = []) {
  if (!rawName || !divisionTeams?.length) {
    return { match: null, confidence: 0, method: 'no-input', normalized: '' };
  }

  const desc = describe(rawName);
  const { normalized, normalizedFull, core, tag, tagVariants } = desc;

  // ── Build lookup maps from division teams ──────────────────────────────────
  const teamsByName = new Map();   // normalizedName → team
  const teamsByTag  = new Map();   // normalizedTag (and variants) → team
  const teamsByCore = new Map();   // normalizedCore → team

  for (const team of divisionTeams) {
    const normName = normalize(team.name);
    teamsByName.set(normName, team);

    if (team.tag) {
      const normTag = normalize(team.tag);
      teamsByTag.set(normTag, team);
      for (const v of generateTagVariants(normTag)) {
        teamsByTag.set(v, team);
      }
    }

    // Also index by core (tag-stripped) name
    const coreTeam = normalizeToCore(team.name);
    if (coreTeam && coreTeam !== normName) {
      teamsByCore.set(coreTeam, team);
    }
  }

  // ── Build alias lookup map ─────────────────────────────────────────────────
  // alias (lowercased) → canonical team name
  const aliasByKey = new Map();
  for (const a of globalAliases) {
    aliasByKey.set(a.alias.toLowerCase().trim(), a.canonical);
  }

  // ── Resolution tiers ───────────────────────────────────────────────────────

  // Tier 1: Exact match (case-insensitive, color codes stripped)
  const exactMatch = teamsByName.get(normalized);
  if (exactMatch) {
    return { match: exactMatch, confidence: 100, method: 'exact', normalized };
  }

  // Tier 2: Normalized match (full pipeline, no leet)
  // Catches high-bit chars, diacritics, decorators
  if (normalizedFull !== normalized) {
    const normMatch = teamsByName.get(normalizedFull);
    if (normMatch) {
      return { match: normMatch, confidence: 95, method: 'normalized', normalized: normalizedFull };
    }
  }

  // Tier 3: Tag match (with all bracket variants: [sr], sr, (sr), .sr., -sr-)
  if (tag) {
    const tagMatch = teamsByTag.get(tag);
    if (tagMatch) {
      return { match: tagMatch, confidence: 90, method: 'tag', normalized };
    }
    for (const v of tagVariants) {
      const variantMatch = teamsByTag.get(v);
      if (variantMatch) {
        return { match: variantMatch, confidence: 90, method: 'tag-variant', normalized };
      }
    }
  }

  // Also try matching the raw team's tag against normalized incoming name
  for (const team of divisionTeams) {
    if (team.tag) {
      const normTag = normalize(team.tag);
      if (normalized === normTag || normalizedFull === normTag) {
        return { match: team, confidence: 90, method: 'tag-direct', normalized };
      }
    }
  }

  // Tier 4: Core name match (strip clan tags from both sides before comparing)
  if (core && core !== normalized) {
    const coreMatchByCore = teamsByCore.get(core);
    if (coreMatchByCore) {
      return { match: coreMatchByCore, confidence: 85, method: 'core', normalized: core };
    }
    const coreMatchByName = teamsByName.get(core);
    if (coreMatchByName) {
      return { match: coreMatchByName, confidence: 85, method: 'core-name', normalized: core };
    }
  }

  // Tier 5: Alias match
  const aliasCanonical =
    aliasByKey.get(normalized) ||
    aliasByKey.get(normalizedFull) ||
    (core ? aliasByKey.get(core) : undefined);

  if (aliasCanonical) {
    const aliasMatch =
      teamsByName.get(normalize(aliasCanonical)) ||
      divisionTeams.find(t => t.name.toLowerCase() === aliasCanonical.toLowerCase());
    if (aliasMatch) {
      return { match: aliasMatch, confidence: 80, method: 'alias', normalized };
    }
  }

  // Tier 6+7: Fuzzy matching — find best Jaro-Winkler score across all teams
  let bestJW = 0;
  let bestJWTeam = null;
  let secondBestJW = 0;

  for (const team of divisionTeams) {
    const teamNorm = normalize(team.name);
    const teamCore = normalizeToCore(team.name);

    // Score against multiple forms to maximise match chance
    const scores = [
      jaroWinkler(normalized, teamNorm),
      jaroWinkler(normalizedFull, teamNorm),
      core ? jaroWinkler(core, teamCore) : 0,
    ];
    const best = Math.max(...scores);

    if (best > bestJW) {
      secondBestJW = bestJW;
      bestJW = best;
      bestJWTeam = team;
    } else if (best > secondBestJW) {
      secondBestJW = best;
    }
  }

  // Tier 6: High-confidence fuzzy (JW ≥ 0.92)
  if (bestJWTeam && bestJW >= 0.92) {
    return { match: bestJWTeam, confidence: 70, method: 'fuzzy-high', normalized };
  }

  // Tier 7: Medium-confidence fuzzy (JW ≥ 0.80 or Dice ≥ 0.70)
  if (bestJWTeam && bestJW >= 0.80) {
    return { match: bestJWTeam, confidence: 60, method: 'fuzzy-jw', normalized };
  }

  // Dice coefficient fallback
  let bestDice = 0;
  let bestDiceTeam = null;
  for (const team of divisionTeams) {
    const teamCore = normalizeToCore(team.name);
    const d = dice(core || normalized, teamCore);
    if (d > bestDice) {
      bestDice = d;
      bestDiceTeam = team;
    }
  }
  if (bestDiceTeam && bestDice >= 0.70) {
    return { match: bestDiceTeam, confidence: 60, method: 'fuzzy-dice', normalized };
  }

  return { match: null, confidence: 0, method: 'no-match', normalized };
}

/**
 * Resolve both teams in a game at once.
 * Returns array of two resolution results.
 */
export function resolveTeams(rawNames, divisionTeams, globalAliases = []) {
  return rawNames.map(name => resolveTeamName(name, divisionTeams, globalAliases));
}

/**
 * Check if a resolution result is confident enough for auto-approval.
 * @param {object} resolution - Result from resolveTeamName
 * @param {number} [threshold=80] - Minimum confidence
 */
export function isAutoApprovable(resolution, threshold = 80) {
  return resolution.match !== null && resolution.confidence >= threshold;
}
