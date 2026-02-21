// src/utils/casterStats.js
// Statistical calculations for the Caster View, operating on division.rawMaps.
//
// rawMaps items are produced by parseMatch() in matchLogic.js and have the shape:
// {
//   id: string,
//   date: string,         // "2026-01-15 20:00:00 +0000"
//   timestamp: number | null,
//   map: string,          // "dm3"
//   teams: string[],      // [teamA, teamB] — Unicode-cleaned, alphabetically sorted
//   scores: { [teamName]: number },  // keyed by original team name
//   originalData: object  // raw ktxstats JSON (contains .players array)
// }
//
// All team comparisons are case-insensitive via normalizeTeam().

/**
 * Lowercase + trim for safe team name comparison.
 * @param {string} name
 */
export const normalizeTeam = (name) => (name || '').toString().toLowerCase().trim();

/**
 * Extract the score for a specific team from a rawMap entry.
 * rawMap.scores is keyed by original team name, so we find the matching key
 * case-insensitively.
 * @param {Object} rawMap
 * @param {string} team - normalized team name
 * @returns {number}
 */
const getScore = (rawMap, team) => {
  if (!rawMap.scores) return 0;
  const key = Object.keys(rawMap.scores).find(k => normalizeTeam(k) === team);
  return key !== undefined ? (rawMap.scores[key] ?? 0) : 0;
};

/**
 * Find maps that involve both teams (in either slot).
 * @param {string} t1 - normalized team name
 * @param {string} t2 - normalized team name
 * @param {Object[]} rawMaps
 */
const findH2HMaps = (t1, t2, rawMaps) =>
  rawMaps.filter(m => {
    if (!Array.isArray(m.teams) || m.teams.length < 2) return false;
    const a = normalizeTeam(m.teams[0]);
    const b = normalizeTeam(m.teams[1]);
    return (a === t1 && b === t2) || (a === t2 && b === t1);
  });

// ─── Head to Head ─────────────────────────────────────────────────────────────

/**
 * Calculate head-to-head stats between two teams from local rawMaps.
 * @param {string} team1
 * @param {string} team2
 * @param {Object[]} rawMaps
 */
export const calculateHeadToHead = (team1, team2, rawMaps) => {
  const t1 = normalizeTeam(team1);
  const t2 = normalizeTeam(team2);
  const maps = findH2HMaps(t1, t2, rawMaps);

  let team1Wins = 0, team2Wins = 0, team1Frags = 0, team2Frags = 0;
  const mapRows = maps.map(m => {
    const s1 = getScore(m, t1);
    const s2 = getScore(m, t2);
    team1Frags += s1;
    team2Frags += s2;
    if (s1 > s2) team1Wins++;
    else if (s2 > s1) team2Wins++;
    return { map: m.map, date: m.date, score1: s1, score2: s2 };
  });

  return { totalMaps: maps.length, team1Wins, team2Wins, team1Frags, team2Frags, maps: mapRows };
};

// ─── Common Opponents ─────────────────────────────────────────────────────────

/**
 * Get the set of normalized opponent names a team has faced.
 * @param {string} team
 * @param {Object[]} rawMaps
 * @returns {Set<string>}
 */
const getOpponents = (team, rawMaps) => {
  const t = normalizeTeam(team);
  const opp = new Set();
  for (const m of rawMaps) {
    if (!Array.isArray(m.teams) || m.teams.length < 2) continue;
    const a = normalizeTeam(m.teams[0]);
    const b = normalizeTeam(m.teams[1]);
    if (a === t) opp.add(b);
    else if (b === t) opp.add(a);
  }
  return opp;
};

/**
 * Calculate performance metrics for one team vs a specific opponent.
 * @param {string} team
 * @param {string} opponent - normalized opponent name
 * @param {Object[]} rawMaps
 */
const getPerformanceVsOpponent = (team, opponent, rawMaps) => {
  const t = normalizeTeam(team);
  const maps = rawMaps.filter(m => {
    if (!Array.isArray(m.teams) || m.teams.length < 2) return false;
    const a = normalizeTeam(m.teams[0]);
    const b = normalizeTeam(m.teams[1]);
    return (a === t && b === opponent) || (a === opponent && b === t);
  });

  let wins = 0, losses = 0, fragsFor = 0, fragsAgainst = 0;
  for (const m of maps) {
    const sf = getScore(m, t);
    const sa = getScore(m, opponent);
    fragsFor += sf;
    fragsAgainst += sa;
    if (sf > sa) wins++;
    else if (sa > sf) losses++;
  }

  const total = maps.length;
  return {
    wins,
    losses,
    total,
    winRate: total > 0 ? wins / total : 0,
    fragDiff: fragsFor - fragsAgainst,
    avgScore: total > 0 ? Math.round(fragsFor / total) : 0,
    dominance: total > 0 ? wins / total : 0,
  };
};

// Minimum dominance gap to declare an advantage (15%)
const ADVANTAGE_THRESHOLD = 0.15;

/**
 * Full common-opponent analysis with advantage detection.
 * @param {string} team1
 * @param {string} team2
 * @param {Object[]} rawMaps
 */
export const analyzeCommonOpponents = (team1, team2, rawMaps) => {
  const t1 = normalizeTeam(team1);
  const t2 = normalizeTeam(team2);
  const opp1 = getOpponents(team1, rawMaps);
  const opp2 = getOpponents(team2, rawMaps);
  const common = [...opp1].filter(o => opp2.has(o) && o !== t1 && o !== t2);

  const breakdown = common.map(opponent => {
    const r1 = getPerformanceVsOpponent(team1, opponent, rawMaps);
    const r2 = getPerformanceVsOpponent(team2, opponent, rawMaps);
    const diff = r1.dominance - r2.dominance;
    const advantage = Math.abs(diff) >= ADVANTAGE_THRESHOLD
      ? (diff > 0 ? 'team1' : 'team2')
      : 'even';
    return { opponent, team1Result: r1, team2Result: r2, advantage };
  });

  const team1Advantages = breakdown.filter(b => b.advantage === 'team1').length;
  const team2Advantages = breakdown.filter(b => b.advantage === 'team2').length;
  const team1AvgDom = breakdown.length > 0
    ? breakdown.reduce((s, b) => s + b.team1Result.dominance, 0) / breakdown.length : 0.5;
  const team2AvgDom = breakdown.length > 0
    ? breakdown.reduce((s, b) => s + b.team2Result.dominance, 0) / breakdown.length : 0.5;

  return {
    breakdown,
    summary: { commonCount: common.length, team1Advantages, team2Advantages, team1AvgDominance: team1AvgDom, team2AvgDominance: team2AvgDom },
  };
};

// ─── Recent Form ──────────────────────────────────────────────────────────────

/**
 * Analyze the last N maps for a team — momentum, trend, streak.
 * @param {string} team
 * @param {Object[]} rawMaps
 * @param {number} [lastN=5]
 */
export const analyzeRecentForm = (team, rawMaps, lastN = 5) => {
  const t = normalizeTeam(team);

  const teamMaps = rawMaps
    .filter(m => {
      if (!Array.isArray(m.teams) || m.teams.length < 2) return false;
      return normalizeTeam(m.teams[0]) === t || normalizeTeam(m.teams[1]) === t;
    })
    .sort((a, b) => {
      // Undated maps treated as oldest (epoch 0) so they don't pollute recent slice
      const da = a.timestamp ?? (a.date ? new Date(a.date).getTime() : 0);
      const db = b.timestamp ?? (b.date ? new Date(b.date).getTime() : 0);
      return da - db; // ascending: oldest first, recent at end
    });

  const recent = teamMaps.slice(-lastN);

  const results = recent.map(m => {
    const sf = getScore(m, t);
    // Opponent is whichever team is not us
    const opponentRaw = normalizeTeam(m.teams[0]) === t ? m.teams[1] : m.teams[0];
    const sa = getScore(m, normalizeTeam(opponentRaw));
    return {
      map: m.map,
      date: m.date,
      opponent: opponentRaw,
      sf,
      sa,
      result: sf > sa ? 'W' : sf < sa ? 'L' : 'D',
    };
  });

  const wins   = results.filter(r => r.result === 'W').length;
  const losses = results.filter(r => r.result === 'L').length;
  const draws  = results.filter(r => r.result === 'D').length;

  // Weighted momentum: later maps carry more weight (linear ramp)
  // e.g. 5 maps → weights [0.2, 0.4, 0.6, 0.8, 1.0], normalised to sum=1
  const weights = results.map((_, i) => (i + 1) / results.length);
  const weightSum = weights.reduce((s, w) => s + w, 0);
  const momentum = weightSum > 0
    ? results.reduce((s, r, i) => {
        const v = r.result === 'W' ? 1 : r.result === 'D' ? 0.5 : 0;
        return s + v * weights[i];
      }, 0) / weightSum
    : 0.5;

  // Trend: compare first half vs second half win counts
  const half = Math.floor(results.length / 2);
  const firstHalfWins  = results.slice(0, half).filter(r => r.result === 'W').length;
  const secondHalfWins = results.slice(half).filter(r => r.result === 'W').length;
  const trend =
    secondHalfWins > firstHalfWins + 1 ? 'rising' :
    secondHalfWins < firstHalfWins - 1 ? 'falling' :
    'stable';

  // Current streak
  let streak = 0;
  let streakType = null;
  for (let i = results.length - 1; i >= 0; i--) {
    if (streakType === null) { streakType = results[i].result; streak = 1; }
    else if (results[i].result === streakType) streak++;
    else break;
  }

  return {
    team, totalMaps: teamMaps.length, last5Maps: results,
    record: `${wins}W-${losses}L${draws > 0 ? `-${draws}D` : ''}`,
    wins, losses, draws, momentum, trend, streak, streakType,
  };
};

// ─── Map Statistics ───────────────────────────────────────────────────────────

/**
 * Per-map win rate and frag differential for a team.
 * @param {string} team
 * @param {Object[]} rawMaps
 * @returns {Object} mapName → { wins, losses, played, winRate, avgFragDiff }
 */
export const calculateMapStats = (team, rawMaps) => {
  const t = normalizeTeam(team);
  const stats = {};

  for (const m of rawMaps) {
    if (!Array.isArray(m.teams) || m.teams.length < 2) continue;
    const isT1 = normalizeTeam(m.teams[0]) === t;
    const isT2 = normalizeTeam(m.teams[1]) === t;
    if (!isT1 && !isT2) continue;

    const mapName = m.map || 'unknown';
    if (!stats[mapName]) stats[mapName] = { wins: 0, losses: 0, fragsFor: 0, fragsAgainst: 0, played: 0 };

    const sf = isT1 ? getScore(m, t) : getScore(m, t);
    const opponentNorm = isT1 ? normalizeTeam(m.teams[1]) : normalizeTeam(m.teams[0]);
    const sa = getScore(m, opponentNorm);

    stats[mapName].fragsFor += sf;
    stats[mapName].fragsAgainst += sa;
    stats[mapName].played++;
    if (sf > sa) stats[mapName].wins++;
    else if (sa > sf) stats[mapName].losses++;
  }

  for (const s of Object.values(stats)) {
    s.winRate = s.played > 0 ? s.wins / s.played : 0;
    s.avgFragDiff = s.played > 0 ? Math.round((s.fragsFor - s.fragsAgainst) / s.played) : 0;
  }

  return stats;
};

// ─── Player Statistics ────────────────────────────────────────────────────────

const safeDiv = (n, d) => (d > 0 ? n / d : 0);

/**
 * Aggregate per-player stats from rawMaps — includes K/D, trend, weapon T/K/D,
 * damage, efficiency, speed, item pickups, and LG accuracy.
 * Player data lives at rawMap.originalData.players (ktxstats format).
 * @param {Object[]} rawMaps
 * @returns {Object} lowercaseName → player stats
 */
export const calculatePlayerStats = (rawMaps) => {
  const players = {};

  for (const m of rawMaps) {
    const rawPlayers = m.originalData?.players;
    if (!Array.isArray(rawPlayers)) continue;

    for (const p of rawPlayers) {
      const name = p.name || p.nick;
      if (!name) continue;
      const key = name.toLowerCase();

      if (!players[key]) {
        players[key] = {
          name,
          team: p.team || '',
          mapsPlayed: 0,
          totalFrags: 0,
          totalDeaths: 0,
          totalKills: 0,
          recentFrags: [],
          // Damage
          totalDmgGiven: 0,
          totalDmgToDie: 0,
          // Speed
          totalSpeed: 0,
          // RL (always available)
          rl: { t: 0, k: 0, d: 0 },
          // LG (map-dependent)
          lg: { t: 0, k: 0, d: 0, accHits: 0, accAtk: 0 },
          lgMaps: 0,
          // Items
          raTotal: 0, raMaps: 0,
          quadTotal: 0, quadMaps: 0,
        };
      }

      const pl = players[key];
      pl.mapsPlayed++;

      const stats = p.stats || {};
      const frags  = stats.frags  ?? p.frags  ?? 0;
      const deaths = stats.deaths ?? p.deaths ?? 0;
      const kills  = stats.kills  ?? 0;

      pl.totalFrags  += frags;
      pl.totalDeaths += deaths;
      pl.totalKills  += kills;
      pl.recentFrags.push(frags);
      if (p.team) pl.team = p.team;

      // Damage
      const dmg = p.dmg || {};
      pl.totalDmgGiven += dmg.given || 0;
      pl.totalDmgToDie += dmg['taken-to-die'] || dmg['taken_to_die'] || 0;

      // Speed
      pl.totalSpeed += (p.speed?.avg || 0);

      // Weapons
      const weap = p.weapons || {};

      // RL
      if (weap.rl) {
        const rl = weap.rl;
        pl.rl.t += rl.pickups?.['total-taken'] || 0;
        pl.rl.k += rl.kills?.enemy || 0;
        pl.rl.d += rl.pickups?.dropped || 0;
      }

      // LG (opportunity-tracked — only on maps with LG)
      if (weap.lg) {
        pl.lgMaps++;
        const lg = weap.lg;
        pl.lg.t += lg.pickups?.['total-taken'] || 0;
        pl.lg.k += lg.kills?.enemy || 0;
        pl.lg.d += lg.pickups?.dropped || 0;
        pl.lg.accHits += lg.acc?.hits || 0;
        pl.lg.accAtk  += lg.acc?.attacks || 0;
      }

      // Items
      const items = p.items || {};
      if (items.ra) {
        pl.raMaps++;
        pl.raTotal += items.ra.took || items.ra.taken || 0;
      }
      if (items.q) {
        pl.quadMaps++;
        pl.quadTotal += items.q.took || items.q.taken || 0;
      }
    }
  }

  // Calculate derived metrics
  for (const p of Object.values(players)) {
    const g = p.mapsPlayed;

    // K/D and frags/map
    p.kdRatio = p.totalDeaths > 0
      ? parseFloat((p.totalFrags / p.totalDeaths).toFixed(2))
      : p.totalFrags;
    p.fragsPerMap = g > 0
      ? parseFloat((p.totalFrags / g).toFixed(1))
      : 0;

    // Hot/cold: compare last 3 maps vs tournament average
    const last3 = p.recentFrags.slice(-3);
    const last3Avg = last3.length > 0 ? last3.reduce((s, f) => s + f, 0) / last3.length : p.fragsPerMap;
    p.trend = last3Avg > p.fragsPerMap * 1.1 ? 'hot' : last3Avg < p.fragsPerMap * 0.9 ? 'cold' : 'steady';

    // Efficiency (kills / (kills + deaths))
    const engagements = p.totalKills + p.totalDeaths;
    p.effPct = engagements > 0 ? parseFloat((p.totalKills / engagements * 100).toFixed(1)) : 0;

    // Averages per game
    p.avgDmg   = g > 0 ? Math.round(p.totalDmgGiven / g) : 0;
    p.avgToDie = g > 0 ? Math.round(p.totalDmgToDie / g) : 0;
    p.avgSpeed = g > 0 ? Math.round(p.totalSpeed / g) : 0;

    // RL per game (always available)
    p.rlTaken = parseFloat(safeDiv(p.rl.t, g).toFixed(1));
    p.rlKills = parseFloat(safeDiv(p.rl.k, g).toFixed(1));
    p.rlDrop  = parseFloat(safeDiv(p.rl.d, g).toFixed(1));

    // LG per opportunity (maps where LG existed)
    const lgO = p.lgMaps;
    p.lgTaken = parseFloat(safeDiv(p.lg.t, lgO).toFixed(1));
    p.lgKills = parseFloat(safeDiv(p.lg.k, lgO).toFixed(1));
    p.lgDrop  = parseFloat(safeDiv(p.lg.d, lgO).toFixed(1));
    p.lgAcc   = p.lg.accAtk > 0 ? parseFloat((p.lg.accHits / p.lg.accAtk * 100).toFixed(1)) : 0;

    // Items per opportunity
    p.ra   = parseFloat(safeDiv(p.raTotal, p.raMaps).toFixed(1));
    p.quad = parseFloat(safeDiv(p.quadTotal, p.quadMaps).toFixed(1));

    // Flag: does this player have detailed ktxstats weapon/damage data?
    p.hasDetailedStats = p.totalDmgGiven > 0 || p.rl.t > 0 || p.rl.k > 0 || p.lg.t > 0;
  }

  return players;
};

/**
 * Pick top and bottom performers by K/D from a pre-filtered player set.
 * @param {Object[]} playerList - array of player stat objects (already filtered to relevant teams)
 * @param {number} [minMaps=2]
 */
export const getPlayerSpotlight = (playerList, minMaps = 2) => {
  const eligible = playerList.filter(p => p.mapsPlayed >= minMaps);
  const sorted = [...eligible].sort((a, b) => b.kdRatio - a.kdRatio);
  return {
    hotHands:   sorted.slice(0, 3),
    struggling: sorted.length > 0 ? sorted.slice(-3).reverse() : [],
  };
};

// ─── Caster Insights ──────────────────────────────────────────────────────────

/**
 * Generate talking-point strings from statistical analysis.
 * @param {string} team1
 * @param {string} team2
 * @param {Object[]} rawMaps
 * @returns {Array<{ type: string, text: string }>}
 */
export const generateCasterInsights = (team1, team2, rawMaps) => {
  const insights = [];

  const { summary, breakdown } = analyzeCommonOpponents(team1, team2, rawMaps);

  if (summary.commonCount > 0) {
    if (summary.team1Advantages > summary.team2Advantages) {
      insights.push({
        type: 'advantage',
        text: `${team1} has shown stronger form against common opponents — ${summary.team1Advantages} vs ${summary.team2Advantages} clear advantages.`,
      });
    } else if (summary.team2Advantages > summary.team1Advantages) {
      insights.push({
        type: 'advantage',
        text: `${team2} has the edge in common-opponent matchups — ${summary.team2Advantages} vs ${summary.team1Advantages} clear advantages.`,
      });
    }

    if (breakdown.length >= 2) {
      const t1Std = Math.sqrt(breakdown.reduce((s, b) =>
        s + Math.pow(b.team1Result.winRate - summary.team1AvgDominance, 2), 0) / breakdown.length);
      const t2Std = Math.sqrt(breakdown.reduce((s, b) =>
        s + Math.pow(b.team2Result.winRate - summary.team2AvgDominance, 2), 0) / breakdown.length);
      if (t1Std < t2Std - 0.15) {
        insights.push({ type: 'consistency', text: `${team1} brings higher consistency — their results vs common opponents show less variance than ${team2}'s.` });
      } else if (t2Std < t1Std - 0.15) {
        insights.push({ type: 'consistency', text: `${team2} are the more consistent side; ${team1}'s form has been more unpredictable.` });
      }
    }
  }

  const form1 = analyzeRecentForm(team1, rawMaps);
  const form2 = analyzeRecentForm(team2, rawMaps);

  if (form1.totalMaps >= 3 && form2.totalMaps >= 3) {
    const m1Hot  = form1.momentum > 0.7;
    const m2Hot  = form2.momentum > 0.7;
    const m1Cold = form1.momentum < 0.4;
    const m2Cold = form2.momentum < 0.4;

    if (m1Hot && m2Cold) {
      insights.push({ type: 'momentum', text: `${team1} are riding strong momentum into this match, while ${team2} have struggled recently.` });
    } else if (m2Hot && m1Cold) {
      insights.push({ type: 'momentum', text: `${team2} come in with excellent recent form; ${team1} will be looking to arrest a difficult patch.` });
    } else if (form1.trend === 'rising' && form2.trend === 'falling') {
      insights.push({ type: 'momentum', text: `${team1} are trending upward heading into this match; ${team2} have seen their form dip recently.` });
    } else if (form2.trend === 'rising' && form1.trend === 'falling') {
      insights.push({ type: 'momentum', text: `${team2} are the in-form side right now, with ${team1} looking to turn things around.` });
    }

    if (form1.streakType === 'W' && form1.streak >= 3) {
      insights.push({ type: 'momentum', text: `${team1} enter on a ${form1.streak}-map winning streak — confidence should be high.` });
    }
    if (form2.streakType === 'W' && form2.streak >= 3) {
      insights.push({ type: 'momentum', text: `${team2} bring a ${form2.streak}-map winning streak into this matchup.` });
    }
  }

  const h2h = calculateHeadToHead(team1, team2, rawMaps);
  if (h2h.totalMaps > 0) {
    if (h2h.team1Wins > h2h.team2Wins) {
      insights.push({ type: 'history', text: `${team1} leads the head-to-head ${h2h.team1Wins}–${h2h.team2Wins} in tournament maps played.` });
    } else if (h2h.team2Wins > h2h.team1Wins) {
      insights.push({ type: 'history', text: `${team2} has the historical edge, leading ${h2h.team2Wins}–${h2h.team1Wins} in previous meetings.` });
    } else {
      insights.push({ type: 'history', text: `These teams are perfectly matched: ${h2h.team1Wins} maps each in previous encounters.` });
    }
  } else {
    insights.push({ type: 'history', text: `No prior meetings between these teams in tournament data — this matchup is an open book.` });
  }

  return insights;
};

/** Human-readable momentum label. */
export const getMomentumLabel = (momentum) => {
  if (momentum > 0.7) return 'Strong';
  if (momentum > 0.5) return 'Moderate';
  if (momentum > 0.3) return 'Weak';
  return 'Poor';
};

/** Tailwind colour class for a momentum score. */
export const getMomentumColor = (momentum) => {
  if (momentum > 0.7) return 'text-qw-win';
  if (momentum > 0.4) return 'text-yellow-400';
  return 'text-qw-loss';
};
