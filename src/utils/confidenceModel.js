// src/utils/confidenceModel.js
// Confidence model for automatic tournament game discovery.
// Pure scoring logic — no API calls, no side effects.
//
// Used by:
//   - api/discover-games.mjs (server-side discovery)
//   - E2E tests (validation)

/**
 * Normalize a QuakeWorld in-game name to plain ASCII.
 * Handles high-bit encoding, QW special chars (digits 18-27, brackets 16-17),
 * control chars, soft hyphens, and bracket/decorator patterns.
 */
export function normalizeQW(name) {
  if (!name || typeof name !== 'string') return '';

  // Step 1: Strip high-bit QW encoding (bytes 128-255 → 0-127)
  let s = [...name]
    .map((c) => {
      const code = c.charCodeAt(0);
      return code > 127 ? String.fromCharCode(code & 0x7f) : c;
    })
    .join('');

  // Step 2: Handle QW special chars (bytes 0-31)
  // 16-17 → [ ], 18-27 → 0-9, others → strip
  s = [...s]
    .map((c) => {
      const code = c.charCodeAt(0);
      if (code >= 18 && code <= 27) return String(code - 18);
      if (code === 16) return '[';
      if (code === 17) return ']';
      if (code < 32 || code === 127) return '';
      return c;
    })
    .join('');

  // Step 3: Strip soft hyphens
  s = s.replace(/\u00AD/g, '');

  // Step 4: Lowercase + trim
  s = s.toLowerCase().trim();

  // Step 5: Strip bracket/decorator patterns
  s = s.replace(/^\[([^\]]*)\]$/, '$1'); // [tag]
  s = s.replace(/^\]([^[]*)\[$/, '$1'); // ]tag[
  s = s.replace(/^\(([^)]*)\)$/, '$1'); // (tag)
  s = s.replace(/^\.([^.]*)\.$/, '$1'); // .tag.
  s = s.replace(/^-([^-]*)-$/, '$1'); // -tag-
  s = s.replace(/^\|([^|]*)\|$/, '$1'); // |tag|

  // Step 6: Strip leading/trailing decorators (brackets, quotes, angle brackets)
  s = s.replace(/^[[\](){}.|'`"<>]+|[[\](){}.|'`"<>]+$/g, '');

  return s.trim();
}

/**
 * Resolve a raw in-game team name to a registered team.
 * Returns the team object or null if no match.
 *
 * @param {string} rawName - Raw in-game team name
 * @param {Array} teams - Registered teams [{name, tag, aliases}]
 * @param {Object} [aliasMap] - Additional alias → tag mappings
 * @returns {{ team: Object, confidence: number } | null}
 */
export function resolveTeamTag(rawName, teams, aliasMap = {}) {
  const norm = normalizeQW(rawName);
  if (!norm) return null;

  // Build lookup maps
  const byTag = {};
  const byAlias = {};
  for (const team of teams) {
    const normTag = normalizeQW(team.tag || '');
    if (normTag) byTag[normTag] = team;
    for (const alias of team.aliases || []) {
      const normAlias = normalizeQW(alias);
      if (normAlias) byAlias[normAlias] = team;
    }
    // Also match by team name (lowercased)
    byAlias[team.name.toLowerCase()] = team;
  }

  // Direct tag match
  if (byTag[norm]) return { team: byTag[norm], confidence: 100 };

  // Alias match
  if (byAlias[norm]) return { team: byAlias[norm], confidence: 90 };

  // Additional alias map (e.g., QW-encoded forms like "0151" → "ving")
  if (aliasMap[norm]) {
    const resolved = teams.find(
      (t) => normalizeQW(t.tag) === aliasMap[norm] || t.name.toLowerCase() === aliasMap[norm]
    );
    if (resolved) return { team: resolved, confidence: 80 };
  }

  // Pre-strip form (before decorator removal) for aliases like "'><>"
  const preStrip = [...(rawName || '')]
    .map((c) => {
      const code = c.charCodeAt(0);
      if (code > 127) return String.fromCharCode(code & 0x7f);
      if (code >= 18 && code <= 27) return String(code - 18);
      if (code < 32 || code === 127) return '';
      return c;
    })
    .join('')
    .toLowerCase()
    .trim();

  if (aliasMap[preStrip]) {
    const resolved = teams.find(
      (t) =>
        normalizeQW(t.tag) === aliasMap[preStrip] || t.name.toLowerCase() === aliasMap[preStrip]
    );
    if (resolved) return { team: resolved, confidence: 80 };
  }

  return null;
}

const REJECT_NAMES = new Set(['mix', 'blue', 'red', 'team1', 'team2']);

/**
 * Apply the 11 hard gates to a game.
 * Returns { pass: true } or { pass: false, rejectedBy: string }.
 *
 * @param {Object} game - Game data from Hub/API
 * @param {Object} game.teams - [{name, frags}]
 * @param {Object} game.players - [{name, team, is_bot}]
 * @param {string} game.map
 * @param {string} game.matchtag
 * @param {string} game.mode
 * @param {Object} config - Tournament config
 * @param {Array} config.teams - Registered teams
 * @param {Set} config.mapPool - Valid maps
 * @param {string} config.mode - Expected mode (e.g., "4on4")
 * @param {Array} config.schedule - [{team1, team2, ...}] or null for playoffs
 * @param {boolean} config.isPlayoffs - Whether this is a playoff round
 * @param {Set} config.processedIds - Already imported game IDs
 * @param {Object} config.aliasMap - Additional tag aliases
 */
export function applyHardGates(game, config) {
  const { teams: regTeams, mapPool, mode, schedule, isPlayoffs, processedIds, aliasMap } = config;

  // Gate 1: Mode must match
  if (game.mode && game.mode !== mode) {
    return { pass: false, rejectedBy: 'wrong mode' };
  }

  // Gate 2: Both team names must resolve to registered teams
  const gameTeams = (game.teams || []).map((t) => (typeof t === 'object' ? t.name : t));
  if (gameTeams.length < 2) return { pass: false, rejectedBy: 'fewer than 2 teams' };

  const r1 = resolveTeamTag(gameTeams[0], regTeams, aliasMap);
  const r2 = resolveTeamTag(gameTeams[1], regTeams, aliasMap);
  if (!r1) return { pass: false, rejectedBy: `team not resolved: ${gameTeams[0]}` };
  if (!r2) return { pass: false, rejectedBy: `team not resolved: ${gameTeams[1]}` };

  // Gate 10: Both teams must be different
  if (r1.team.name === r2.team.name) return { pass: false, rejectedBy: 'same team' };

  // Gate 3: Teams must be a valid matchup
  if (!isPlayoffs && schedule) {
    const isScheduled = schedule.some(
      (m) =>
        (m.team1 === r1.team.name && m.team2 === r2.team.name) ||
        (m.team1 === r2.team.name && m.team2 === r1.team.name)
    );
    if (!isScheduled) return { pass: false, rejectedBy: 'not scheduled matchup' };
  }
  // For playoffs: both teams being in the same division/group is enough (checked by caller)

  // Gate 4: Map in pool
  if (mapPool && !mapPool.has(game.map)) {
    return { pass: false, rejectedBy: `invalid map: ${game.map}` };
  }

  // Gate 5: Matchtag not "prac"
  const tag = (game.matchtag || '').toLowerCase().trim();
  if (tag === 'prac' || tag === 'practice') {
    return { pass: false, rejectedBy: 'practice tag' };
  }

  // Gate 6: Correct player count
  const players = game.players || [];
  const team1Players = players.filter((p) => {
    const pTeamNorm = normalizeQW(p.team || '');
    const t1Norm = normalizeQW(gameTeams[0]);
    return pTeamNorm === t1Norm || p.team === gameTeams[0];
  });
  const team2Players = players.filter((p) => {
    const pTeamNorm = normalizeQW(p.team || '');
    const t2Norm = normalizeQW(gameTeams[1]);
    return pTeamNorm === t2Norm || p.team === gameTeams[1];
  });

  if (team1Players.length < 4 || team1Players.length > 5) {
    return { pass: false, rejectedBy: `team1 player count: ${team1Players.length}` };
  }
  if (team2Players.length < 4 || team2Players.length > 5) {
    return { pass: false, rejectedBy: `team2 player count: ${team2Players.length}` };
  }

  // Gate 9: Not already processed
  if (processedIds && processedIds.has(String(game.id))) {
    return { pass: false, rejectedBy: 'already processed' };
  }

  // Gate 11: No bots, no generic names
  if (players.some((p) => p.is_bot)) return { pass: false, rejectedBy: 'has bots' };
  const n1 = normalizeQW(gameTeams[0]);
  const n2 = normalizeQW(gameTeams[1]);
  if (REJECT_NAMES.has(n1) || REJECT_NAMES.has(n2)) {
    return { pass: false, rejectedBy: 'generic team name' };
  }

  return { pass: true, team1: r1, team2: r2 };
}

/**
 * Score a game with the 5 confidence factors.
 * Returns { total, roster, schedule, series, tag, timeOfDay, breakdown }.
 *
 * @param {Object} game - Game data
 * @param {Object} gateResult - Result from applyHardGates (must have pass=true)
 * @param {Object} config - Tournament config
 * @param {Array} config.schedule - Scheduled matches with dates
 * @param {number} config.seriesMapCount - Number of maps in this game's series
 * @param {number} config.expectedBestOf - Expected best-of for this round (3 or 5)
 * @param {Array} config.tagPatterns - Tournament tag patterns to match against
 */
export function scoreConfidence(game, gateResult, config) {
  const { team1: r1, team2: r2 } = gateResult;
  const { schedule, seriesMapCount, expectedBestOf = 3, tagPatterns = [] } = config;

  // Factor 1: Roster fidelity (0-40)
  const rosterScore = scoreRoster(game, r1, r2);

  // Factor 2: Schedule proximity (0-25)
  const scheduleScore = scoreScheduleProximity(game, r1.team, r2.team, schedule);

  // Factor 3: Series map count (0-15)
  const seriesScore = scoreSeriesCount(seriesMapCount, expectedBestOf);

  // Factor 4: Matchtag relevance (0-10)
  const tagScore = scoreMatchtag(game.matchtag, tagPatterns);

  // Factor 5: Time of day (0-10)
  const timeScore = scoreTimeOfDay(game.timestamp || game.date);

  const total = rosterScore + scheduleScore + seriesScore + tagScore + timeScore;

  return {
    total,
    roster: rosterScore,
    schedule: scheduleScore,
    series: seriesScore,
    tag: tagScore,
    timeOfDay: timeScore,
  };
}

// ── Factor scoring helpers ──────────────────────────────────────────────────

function scoreRoster(game, r1, r2) {
  const players = game.players || [];
  const gameTeams = (game.teams || []).map((t) => (typeof t === 'object' ? t.name : t));

  const t1Players = players.filter(
    (p) => p.team === gameTeams[0] || normalizeQW(p.team) === normalizeQW(gameTeams[0])
  );
  const t2Players = players.filter(
    (p) => p.team === gameTeams[1] || normalizeQW(p.team) === normalizeQW(gameTeams[1])
  );

  const match1 = countRosterMatches(t1Players, r1.team.roster || r1.team.players || []);
  const match2 = countRosterMatches(t2Players, r2.team.roster || r2.team.players || []);

  const count = Math.min(t1Players.length, 4);
  const count2 = Math.min(t2Players.length, 4);

  // Scoring: 4/4 both = 40, 4/4+3/4 = 32, 3/3 both = 24, etc.
  if (match1 >= count && match2 >= count2) return 40;
  if (match1 >= count && match2 >= count2 - 1) return 32;
  if (match2 >= count2 && match1 >= count - 1) return 32;
  if (match1 >= count - 1 && match2 >= count2 - 1) return 24;
  if (match1 >= count && match2 >= count2 - 2) return 20;
  if (match2 >= count2 && match1 >= count - 2) return 20;
  if (match1 >= count - 1 && match2 >= count2 - 2) return 14;
  if (match2 >= count2 - 1 && match1 >= count - 2) return 14;
  if (match1 >= 1 || match2 >= 1) return 8;
  return 0;
}

function countRosterMatches(gamePlayers, roster) {
  const rosterNorm = roster.map((p) => normalizeQW(p).toLowerCase());
  let matched = 0;
  for (const gp of gamePlayers) {
    const gpNorm = normalizeQW(gp.name).toLowerCase();
    // Also try without common suffixes (e.g., "rusti FU" → "rusti")
    const gpBase = gpNorm.replace(/\s+\S{1,4}$/, ''); // strip short suffix
    if (
      rosterNorm.some(
        (r) => r === gpNorm || r === gpBase || gpNorm.includes(r) || r.includes(gpNorm)
      )
    ) {
      matched++;
    }
  }
  return matched;
}

function scoreScheduleProximity(game, team1, team2, schedule) {
  if (!schedule || !schedule.length) return 15; // No schedule = neutral

  const gameDate = new Date(game.timestamp || game.date);
  if (isNaN(gameDate.getTime())) return 15;

  // Find scheduled match for this team pair
  const match = schedule.find(
    (m) =>
      (m.team1 === team1.name && m.team2 === team2.name) ||
      (m.team1 === team2.name && m.team2 === team1.name)
  );
  if (!match) return 5; // Teams in tournament but no specific scheduled date

  const start = match.start ? new Date(match.start) : null;
  const end = match.end ? new Date(match.end) : null;
  if (!start) return 15;

  // Check if game falls within the scheduled week
  if (end && gameDate >= start && gameDate <= new Date(end.getTime() + 7 * 24 * 60 * 60 * 1000)) {
    return 25;
  }

  const diffDays = Math.abs(gameDate - start) / (1000 * 60 * 60 * 24);
  if (diffDays <= 7) return 25;
  if (diffDays <= 14) return 15;
  if (diffDays <= 21) return 10;
  return 5;
}

function scoreSeriesCount(mapCount, expectedBestOf) {
  if (!mapCount) return 8;

  const expectedMin = Math.ceil(expectedBestOf / 2);
  const expectedMax = expectedBestOf;

  if (mapCount >= expectedMin && mapCount <= expectedMax) return 15;
  if (mapCount === 1) return 8;
  if (mapCount > expectedMax) return 5; // Flag: exceeds format
  return 8;
}

function scoreMatchtag(matchtag, tagPatterns) {
  if (!matchtag || matchtag.trim() === '') return 5; // Empty = neutral

  const tag = matchtag.toLowerCase().trim();

  // Check against tournament-specific patterns
  for (const pattern of tagPatterns) {
    if (tag.includes(pattern.toLowerCase())) return 10;
  }

  // Check for known other tournament tags
  const otherTournaments = ['eql', 'nqr', 'qhlan', 'draft', 'qwsl', 'ss19', 'rqwl'];
  for (const other of otherTournaments) {
    if (tag.includes(other)) return 0;
  }

  return 3;
}

function scoreTimeOfDay(timestamp) {
  if (!timestamp) return 7;

  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return 7;

  // Convert to CET (UTC+1, rough — ignoring DST for simplicity)
  const hourCET = (d.getUTCHours() + 1) % 24;

  if (hourCET >= 17 || hourCET < 1) return 10; // 17:00-01:00
  if (hourCET >= 1 && hourCET < 5) return 3; // 01:00-05:00
  return 7; // 05:00-17:00
}

/**
 * Group games into series by team pair and time proximity.
 * Games between the same two teams within 3 hours = one series.
 */
export function groupIntoSeries(games) {
  const SERIES_GAP_MS = 3 * 60 * 60 * 1000;

  // Sort by timestamp
  const sorted = [...games].sort(
    (a, b) => new Date(a.timestamp || a.date) - new Date(b.timestamp || b.date)
  );

  const series = [];
  let currentSeries = null;

  for (const game of sorted) {
    const gameTime = new Date(game.timestamp || game.date).getTime();
    const teamKey = [game._resolved1, game._resolved2].sort().join(' vs ');

    if (
      currentSeries &&
      currentSeries.key === teamKey &&
      gameTime - currentSeries.lastTime < SERIES_GAP_MS
    ) {
      currentSeries.games.push(game);
      currentSeries.lastTime = gameTime;
    } else {
      if (currentSeries) series.push(currentSeries);
      currentSeries = {
        key: teamKey,
        team1: game._resolved1,
        team2: game._resolved2,
        games: [game],
        lastTime: gameTime,
      };
    }
  }
  if (currentSeries) series.push(currentSeries);

  return series;
}
