// src/utils/teamIdentity.js
// Convenience layer over teamResolver.js — the single API for all team name
// resolution in QWICKY. Every component, utility, and API endpoint should use
// this instead of hand-rolling its own alias lookups.
//
// Three-layer architecture:
//   nameNormalizer.js — pure string normalization (no team knowledge)
//   teamResolver.js  — 7-tier confidence scoring (the brain)
//   teamIdentity.js  — simple API: resolveTeam(name, ctx) → canonical name

import { normalize } from './nameNormalizer.js';
import { resolveTeamName } from './teamResolver.js';

/**
 * Build a reusable lookup context for a division's teams.
 * Create once per render/calculation, reuse for all lookups.
 *
 * @param {Array} teams - Division teams array (each has name, tag, country, players, aliases)
 * @param {Array} [globalAliases] - Alias rows from Supabase team_aliases table
 * @returns {object} Team context for use with resolveTeam/getTeamMeta/etc.
 */
export function createTeamContext(teams, globalAliases = []) {
  if (!teams?.length)
    return {
      teams: [],
      globalAliases,
      byNormName: new Map(),
      byNormTag: new Map(),
      byAlias: new Map(),
    };

  const byNormName = new Map();
  const byNormTag = new Map();
  const byAlias = new Map();

  for (const team of teams) {
    byNormName.set(normalize(team.name), team);

    if (team.tag) {
      const normTag = normalize(team.tag);
      byNormTag.set(normTag, team);
      // Bracket variants: [sr], (sr), .sr., -sr-
      const cleanTag = normTag.replace(/[[\]().|_-]/g, '');
      if (cleanTag && cleanTag !== normTag) byNormTag.set(cleanTag, team);
      for (const v of [`[${cleanTag}]`, `(${cleanTag})`, `.${cleanTag}.`, `-${cleanTag}-`]) {
        byNormTag.set(v, team);
      }
    }

    if (team.aliases && Array.isArray(team.aliases)) {
      for (const alias of team.aliases) {
        if (alias?.trim()) byAlias.set(normalize(alias), team);
      }
    }
  }

  return { teams, globalAliases, byNormName, byNormTag, byAlias };
}

/**
 * Resolve a raw team name to its canonical form.
 * Returns the canonical team name string, or the original name if no match.
 *
 * Fast path: tries map lookups first (O(1)), only falls through to the full
 * 7-tier resolver (with fuzzy matching) if deterministic tiers fail.
 *
 * @param {string} rawName - Team name from ktxstats, schedule, or user input
 * @param {object} ctx - Team context from createTeamContext()
 * @returns {string} Canonical team name, or original name if unresolved
 */
export function resolveTeam(rawName, ctx) {
  if (!rawName || !ctx) return rawName || '';
  const norm = normalize(rawName);

  // Fast path: exact normalized name match
  const exact = ctx.byNormName.get(norm);
  if (exact) return exact.name;

  // Tag match (includes bracket variants)
  const tag = ctx.byNormTag.get(norm);
  if (tag) return tag.name;

  // Alias match (from team.aliases arrays)
  const alias = ctx.byAlias.get(norm);
  if (alias) return alias.name;

  // Full resolver — fuzzy matching, core name, global aliases
  const result = resolveTeamName(rawName, ctx.teams, ctx.globalAliases);
  return result.match ? result.match.name : rawName;
}

/**
 * Resolve with full confidence info.
 * Use when you need to know HOW good the match is (auto-approve, diagnostics).
 *
 * @returns {{ match: object|null, confidence: number, method: string, normalized: string }}
 */
export function resolveTeamFull(rawName, ctx) {
  if (!ctx) return { match: null, confidence: 0, method: 'no-context', normalized: '' };
  return resolveTeamName(rawName, ctx.teams, ctx.globalAliases);
}

/**
 * Get team metadata (flag, players, tag) for wiki/display purposes.
 * Returns the full team object if found, or a fallback with just the name.
 *
 * @returns {object} Team object with name, tag, country, players (at minimum)
 */
export function getTeamMeta(rawName, ctx) {
  if (!rawName || !ctx) return { name: rawName || '', tag: '', country: '', players: '' };
  const norm = normalize(rawName);

  const team = ctx.byNormName.get(norm) || ctx.byNormTag.get(norm) || ctx.byAlias.get(norm);

  if (team) return team;

  // Fuzzy fallback
  const result = resolveTeamName(rawName, ctx.teams, ctx.globalAliases);
  return result.match || { name: rawName, tag: '', country: '', players: '' };
}

/**
 * Check if two team names refer to the same team.
 */
export function sameTeam(name1, name2, ctx) {
  return resolveTeam(name1, ctx) === resolveTeam(name2, ctx);
}

/**
 * Build a score lookup that resolves team name variants.
 * Given rawMap.scores = { "ÇïÆ¡": 150, "pol": 100 },
 * returns a function: getScore(canonicalName) → number
 *
 * @param {object} scores - Score dictionary keyed by raw team names
 * @param {object} ctx - Team context from createTeamContext()
 * @returns {function} getScore(teamName) → number
 */
export function createScoreLookup(scores, ctx) {
  if (!scores) return () => 0;
  const resolved = new Map();
  for (const [rawKey, value] of Object.entries(scores)) {
    const canonical = resolveTeam(rawKey, ctx);
    resolved.set(normalize(canonical), value);
  }
  return (teamName) => resolved.get(normalize(teamName)) ?? 0;
}
