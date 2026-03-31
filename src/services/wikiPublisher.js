// src/services/wikiPublisher.js
// Client-side auto-publish service. Publishes division wiki content
// to configured targets after match approval.

import {
  calculateStandings,
  generateStandingsWiki,
  generateMatchListWiki,
  generateBracketWiki,
} from '../utils/qwikiMarkup';

/**
 * Publish a division's wiki content to all configured targets.
 * Called after match approval (debounced).
 *
 * @param {object} division - Division data (teams, schedule, bracket, wikiConfig)
 * @param {object} tournament - Tournament data (settings)
 * @param {string} [token] - Supabase session access_token for admin auth
 * @returns {Promise<Array>} Results per target
 */
export async function publishDivisionWiki(division, tournament, token) {
  if (!tournament?.settings?.wikiAutoPublish) return [];
  if (!division?.wikiConfig?.enabled) return [];

  const { targets } = division.wikiConfig;
  if (!targets?.length) return [];

  const teams = division.teams || [];
  const schedule = division.schedule || [];

  // Generators for each export type
  const generators = {
    standings: () => {
      const standings = calculateStandings(schedule, division);
      return generateStandingsWiki(standings, teams, division, {});
    },
    matches: () => generateMatchListWiki(schedule, teams, division, {}),
    bracket: () => division.bracket
      ? generateBracketWiki(division.bracket, schedule, teams, division, {})
      : null,
    full: () => {
      const standings = calculateStandings(schedule, division);
      return generateStandingsWiki(standings, teams, division, {})
        + '\n' + generateMatchListWiki(schedule, teams, division, {});
    },
  };

  const results = [];

  for (const target of targets) {
    if (!target.page) continue;

    const markup = generators[target.type]?.();
    if (!markup) continue;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/wiki?action=publish-section', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          pageName: target.page,
          sectionHeading: target.section || null,
          content: markup,
          summary: `Updated ${target.type} via QWICKY`,
        }),
      });
      const data = await res.json();
      results.push({ target, ...data });
    } catch (err) {
      results.push({ target, ok: false, error: err.message });
    }
  }

  return results;
}

// ── Debounced auto-publish ───────────────────────────────────────────────────

let wikiPublishTimer = null;
let pendingPublish = null;

/**
 * Schedule a wiki publish with debounce.
 * Multiple calls within the debounce window are coalesced.
 *
 * @param {object} division - Division to publish
 * @param {object} tournament - Tournament with settings
 * @param {function} [onResult] - Callback with publish results
 * @param {number} [debounceMs=10000] - Debounce delay
 * @param {string} [token] - Supabase session access_token for admin auth
 */
export function scheduleWikiPublish(division, tournament, onResult, debounceMs = 10000, token) {
  clearTimeout(wikiPublishTimer);

  pendingPublish = { division, tournament, token };

  wikiPublishTimer = setTimeout(async () => {
    const { division: div, tournament: t, token: tok } = pendingPublish;
    pendingPublish = null;

    try {
      const results = await publishDivisionWiki(div, t, tok);
      if (onResult) onResult(results);
    } catch (err) {
      if (onResult) onResult([{ ok: false, error: err.message }]);
    }
  }, debounceMs);
}

/**
 * Cancel any pending wiki publish.
 */
export function cancelPendingPublish() {
  clearTimeout(wikiPublishTimer);
  pendingPublish = null;
}
