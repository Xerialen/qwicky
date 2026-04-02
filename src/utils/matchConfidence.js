// src/utils/matchConfidence.js
// Phase 5: Confidence scoring for linking a game submission to a scheduled match.
// Replaces hardcoded 2-hour series gap with a multi-factor model.
//
// Score 0–100 = teamMatch(0–40) + scheduleProximity(0–30) + bestOfFit(0–15) + seriesAffinity(0–15)

/**
 * Score how well a game submission matches a scheduled match.
 *
 * @param {object} game — parsed game data { team1, team2, map, date, ... }
 * @param {object} match — scheduled match { id, team1, team2, date, bestOf, maps, status, ... }
 * @param {object} [opts]
 * @param {number} [opts.teamConfidence1] — resolver confidence for team1 (0–100)
 * @param {number} [opts.teamConfidence2] — resolver confidence for team2 (0–100)
 * @param {Array}  [opts.existingMaps] — maps already linked to this match
 * @returns {{ score: number, breakdown: {teamMatch, scheduleProximity, bestOfFit, seriesAffinity} }}
 */
export function scoreMatch(game, match, opts = {}) {
  const teamMatch = scoreTeamMatch(game, match, opts);
  const scheduleProximity = scoreScheduleProximity(game, match);
  const bestOfFit = scoreBestOfFit(match, opts.existingMaps);
  const seriesAffinity = scoreSeriesAffinity(game, match, opts.existingMaps);

  return {
    score: teamMatch + scheduleProximity + bestOfFit + seriesAffinity,
    breakdown: { teamMatch, scheduleProximity, bestOfFit, seriesAffinity },
  };
}

/**
 * Team match component (0–40).
 * Based on resolver confidence for both teams.
 */
function scoreTeamMatch(game, match, opts) {
  const c1 = opts.teamConfidence1 ?? 0;
  const c2 = opts.teamConfidence2 ?? 0;

  if (c1 === 0 || c2 === 0) return 0;

  // Average of both confidences, scaled to 0–40
  const avg = (c1 + c2) / 2;
  return Math.round((avg / 100) * 40);
}

/**
 * Schedule proximity component (0–30).
 * How close the game date is to the scheduled match date.
 */
function scoreScheduleProximity(game, match) {
  if (!game.date || !match.date) return 15; // No date info — neutral score

  const gameDate = new Date(game.date);
  const matchDate = new Date(match.date);

  if (isNaN(gameDate.getTime()) || isNaN(matchDate.getTime())) return 15;

  const diffDays = Math.abs(gameDate - matchDate) / (1000 * 60 * 60 * 24);

  // Same day = 30, within 1 day = 25, within 3 days = 20, within 7 = 10, beyond = 0
  if (diffDays < 0.5) return 30;
  if (diffDays < 1.5) return 25;
  if (diffDays < 3.5) return 20;
  if (diffDays < 7.5) return 10;
  if (diffDays < 14.5) return 5;
  return 0;
}

/**
 * Best-of fit component (0–15).
 * Does adding this map make sense for the match's bestOf setting?
 */
function scoreBestOfFit(match, existingMaps) {
  const bestOf = match.bestOf || 3;
  const currentMaps = existingMaps?.length || 0;

  // If match already has enough maps, adding more doesn't fit well
  if (currentMaps >= bestOf) return 0;

  // If match has no maps yet, any map fits
  if (currentMaps === 0) return 15;

  // Still within bestOf range
  const remaining = bestOf - currentMaps;
  if (remaining > 0) return 12;

  return 5;
}

/**
 * Series affinity component (0–15).
 * Is this game part of the same series as existing maps on this match?
 * Uses timestamp proximity to existing maps.
 */
function scoreSeriesAffinity(game, match, existingMaps) {
  if (!existingMaps || existingMaps.length === 0) return 10; // No existing maps — neutral

  if (!game.date) return 8;

  const gameTime = new Date(game.date).getTime();
  if (isNaN(gameTime)) return 8;

  // Check if any existing map is close in time (within 2 hours = same series)
  const SERIES_GAP_MS = 2 * 60 * 60 * 1000;

  const hasCloseSibling = existingMaps.some((m) => {
    if (!m.date) return false;
    const mapTime = new Date(m.date).getTime();
    if (isNaN(mapTime)) return false;
    return Math.abs(gameTime - mapTime) < SERIES_GAP_MS;
  });

  if (hasCloseSibling) return 15;

  // Check if within same day
  const hasSameDayMap = existingMaps.some((m) => {
    if (!m.date) return false;
    const mapDate = new Date(m.date);
    const gameDate = new Date(game.date);
    return mapDate.toDateString() === gameDate.toDateString();
  });

  if (hasSameDayMap) return 10;

  return 3; // Exists but far apart
}

/**
 * Find the best matching scheduled match for a game submission.
 *
 * @param {object} game — { team1, team2, map, date }
 * @param {Array} schedule — division schedule array
 * @param {object} [opts]
 * @param {Function} [opts.resolveTeam] — (rawName) => { team, confidence } or null
 * @param {number} [opts.minScore] — minimum score threshold (default 40)
 * @returns {{ match, score, breakdown } | null}
 */
export function findBestMatch(game, schedule, opts = {}) {
  const minScore = opts.minScore ?? 40;
  const resolveTeam = opts.resolveTeam;

  // Resolve teams if resolver provided
  let tc1 = 100,
    tc2 = 100;
  if (resolveTeam) {
    const r1 = resolveTeam(game.team1);
    const r2 = resolveTeam(game.team2);
    tc1 = r1?.confidence ?? 0;
    tc2 = r2?.confidence ?? 0;
  }

  let best = null;

  for (const match of schedule) {
    // Skip completed matches that are already full
    // (but allow adding maps to in-progress matches)
    if (match.status === 'completed' && match.maps?.length >= (match.bestOf || 3)) {
      continue;
    }

    const result = scoreMatch(game, match, {
      teamConfidence1: tc1,
      teamConfidence2: tc2,
      existingMaps: match.maps,
    });

    if (result.score >= minScore && (!best || result.score > best.score)) {
      best = { match, score: result.score, breakdown: result.breakdown };
    }
  }

  return best;
}

/**
 * Get a human-readable confidence label.
 * @param {number} score — 0–100
 * @returns {string}
 */
export function confidenceLabel(score) {
  if (score >= 85) return 'Very High';
  if (score >= 70) return 'High';
  if (score >= 55) return 'Medium';
  if (score >= 40) return 'Low';
  return 'Very Low';
}

/**
 * Get Tailwind color class for a confidence score.
 * @param {number} score — 0–100
 * @returns {string}
 */
export function confidenceColor(score) {
  if (score >= 85) return 'text-qw-win';
  if (score >= 70) return 'text-green-400';
  if (score >= 55) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-qw-loss';
}
