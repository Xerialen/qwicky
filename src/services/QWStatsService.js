// src/services/QWStatsService.js
// Browser-callable public API — no auth headers, no CORS issues, no Vercel proxy needed.
// Base: https://qw-api.poker-affiliate.org
// Note: 4on4 only. No SLA — keep Supabase/ktxstats as authoritative source for imports.

const BASE_URL = 'https://qw-api.poker-affiliate.org';
const FETCH_TIMEOUT_MS = 8000;

/**
 * Normalize a team tag for API use: lowercase + trimmed.
 * URLSearchParams handles percent-encoding, so we must NOT call
 * encodeURIComponent here (that would double-encode).
 * @param {string} tag
 */
const normalizeTag = (tag) => (tag || '').toLowerCase().trim();

/**
 * Fetch helper — returns parsed JSON or throws with a descriptive message.
 * Includes an 8-second timeout so the UI never hangs indefinitely.
 * @param {string} path - URL path + query string
 */
async function qwFetch(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`QW Stats API ${res.status}: ${path}`);
    }
    return res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`QW Stats API timeout after ${FETCH_TIMEOUT_MS / 1000}s: ${path}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const QWStatsService = {
  /**
   * Health check.
   * @returns {Promise<Object>}
   */
  checkHealth: () => qwFetch('/health'),

  /**
   * Head-to-head history between two teams.
   * @param {string} teamA
   * @param {string} teamB
   * @param {{ months?: number, limit?: number, map?: string }} [opts]
   * @returns {Promise<Object>}
   */
  getH2H: (teamA, teamB, opts = {}) => {
    const p = new URLSearchParams({ teamA: normalizeTag(teamA), teamB: normalizeTag(teamB) });
    if (opts.months) p.set('months', opts.months);
    if (opts.limit)  p.set('limit',  opts.limit);
    if (opts.map)    p.set('map',    opts.map);
    return qwFetch(`/api/h2h?${p}`);
  },

  /**
   * Recent form for a single team.
   * @param {string} team
   * @param {{ months?: number, limit?: number, map?: string }} [opts]
   * @returns {Promise<Object>}
   */
  getForm: (team, opts = {}) => {
    const p = new URLSearchParams({ team: normalizeTag(team) });
    if (opts.months) p.set('months', opts.months);
    if (opts.limit)  p.set('limit',  opts.limit);
    if (opts.map)    p.set('map',    opts.map);
    return qwFetch(`/api/form?${p}`);
  },

  /**
   * Per-map statistics for a team, optionally vs a specific opponent.
   * @param {string} team
   * @param {{ vsTeam?: string, months?: number }} [opts]
   * @returns {Promise<Object>}
   */
  getMapStats: (team, opts = {}) => {
    const p = new URLSearchParams({ team: normalizeTag(team) });
    if (opts.vsTeam) p.set('vsTeam', normalizeTag(opts.vsTeam));
    if (opts.months) p.set('months', opts.months);
    return qwFetch(`/api/maps?${p}`);
  },

  /**
   * Roster / player stats for a team.
   * @param {string} team
   * @param {{ months?: number }} [opts]
   * @returns {Promise<Object>}
   */
  getRoster: (team, opts = {}) => {
    const p = new URLSearchParams({ team: normalizeTag(team) });
    if (opts.months) p.set('months', opts.months);
    return qwFetch(`/api/roster?${p}`);
  },
};

export default QWStatsService;
