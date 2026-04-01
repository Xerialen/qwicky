// src/services/gameDataService.js
// Unified game data fetching — routes to qw-stats (4on4 enrichment)
// or Hub proxy (game imports for all modes).
//
// Phase 3A routing strategy:
//   Game import (for results) → always Hub proxy (/api/game/:gameId)
//   H2H / form / roster enrichment → qw-stats API (4on4 only)
//
// When ParadokS adds GET /api/game/:id to qw-stats, add a 4on4 fast-path
// in fetchGameData() to call it first before falling back to Hub.

import QWStatsService from './QWStatsService.js';

const FOUR_ON_FOUR_MODES = ['4on4', '4v4'];

function is4on4(mode) {
  return FOUR_ON_FOUR_MODES.some((m) => (mode || '').toLowerCase().includes(m));
}

/**
 * Fetch full ktxstats game data for a given Hub game ID.
 * Routes through the existing /api/game/:gameId Vercel proxy.
 *
 * @param {string} gameId - QW Hub game ID
 * @param {string} [mode] - Tournament mode (unused until qw-stats adds single-game endpoint)
 * @returns {Promise<{ status: string, data: object, source: string }>}
 */
export async function fetchGameData(gameId, _mode) {
  const base = import.meta.env.VITE_API_BASE_URL || '';
  const res = await fetch(`${base}/api/game/${encodeURIComponent(gameId)}`);
  if (!res.ok) {
    throw new Error(`Hub API error ${res.status} for game ${gameId}`);
  }
  const json = await res.json();
  return { ...json, source: 'hub' };
}

/**
 * Fetch head-to-head history between two teams (4on4 only).
 * Returns null on error — callers should handle gracefully.
 *
 * @param {string} teamA
 * @param {string} teamB
 * @param {string} [mode]
 * @param {object} [opts] - { months, limit, map }
 */
export async function fetchH2H(teamA, teamB, mode, opts = {}) {
  if (!is4on4(mode)) return null;
  try {
    return await QWStatsService.getH2H(teamA, teamB, opts);
  } catch {
    return null;
  }
}

/**
 * Fetch recent form for a team (4on4 only).
 *
 * @param {string} team
 * @param {string} [mode]
 * @param {object} [opts]
 */
export async function fetchForm(team, mode, opts = {}) {
  if (!is4on4(mode)) return null;
  try {
    return await QWStatsService.getForm(team, opts);
  } catch {
    return null;
  }
}

/**
 * Fetch roster for a team (4on4 only).
 * Used in Phase 4 to validate that submitted player names belong to the claimed team.
 *
 * @param {string} team
 * @param {string} [mode]
 * @param {object} [opts]
 */
export async function fetchRoster(team, mode, opts = {}) {
  if (!is4on4(mode)) return null;
  try {
    return await QWStatsService.getRoster(team, opts);
  } catch {
    return null;
  }
}
