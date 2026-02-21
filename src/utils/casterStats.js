// src/utils/casterStats.js
// Statistical calculations for the Caster View, operating on division.rawMaps.
// All team comparisons are case-insensitive via normalizeTeam().

/**
 * Normalize a team name for case-insensitive comparison.
 * @param {string} name
 */
export const normalizeTeam = (name) => (name || '').toString().toLowerCase().trim();

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

  const maps = rawMaps.filter(m => {
    const a = normalizeTeam(m.team1);
    const b = normalizeTeam(m.team2);
    return (a === t1 && b === t2) || (a === t2 && b === t1);
  });

  let team1Wins = 0, team2Wins = 0, team1Frags = 0, team2Frags = 0;
  for (const m of maps) {
    const flipped = normalizeTeam(m.team1) === t2;
    const s1 = flipped ? (m.score2 ?? 0) : (m.score1 ?? 0);
    const s2 = flipped ? (m.score1 ?? 0) : (m.score2 ?? 0);
    team1Frags += s1;
    team2Frags += s2;
    if (s1 > s2) team1Wins++;
    else if (s2 > s1) team2Wins++;
  }

  return {
    totalMaps: maps.length,
    team1Wins,
    team2Wins,
    team1Frags,
    team2Frags,
    maps: maps.map(m => {
      const flipped = normalizeTeam(m.team1) === t2;
      return {
        map: m.map,
        date: m.date,
        score1: flipped ? (m.score2 ?? 0) : (m.score1 ?? 0),
        score2: flipped ? (m.score1 ?? 0) : (m.score2 ?? 0),
      };
    }),
  };
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
    const a = normalizeTeam(m.team1);
    const b = normalizeTeam(m.team2);
    if (a === t) opp.add(b);
    else if (b === t) opp.add(a);
  }
  return opp;
};

/**
 * Calculate performance metrics for one team vs a specific opponent.
 * @param {string} team
 * @param {string} opponent
 * @param {Object[]} rawMaps
 * @returns {{ wins, losses, total, winRate, fragDiff, avgScore, dominance }}
 */
const getPerformanceVsOpponent = (team, opponent, rawMaps) => {
  const t = normalizeTeam(team);
  const o = normalizeTeam(opponent);

  const maps = rawMaps.filter(m => {
    const a = normalizeTeam(m.team1);
    const b = normalizeTeam(m.team2);
    return (a === t && b === o) || (a === o && b === t);
  });

  let wins = 0, losses = 0, fragsFor = 0, fragsAgainst = 0;
  for (const m of maps) {
    const flipped = normalizeTeam(m.team1) === o;
    const sf = flipped ? (m.score2 ?? 0) : (m.score1 ?? 0);
    const sa = flipped ? (m.score1 ?? 0) : (m.score2 ?? 0);
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

/**
 * Full common-opponent analysis with advantage detection.
 * Advantage threshold: ≥15% dominance difference.
 * @param {string} team1
 * @param {string} team2
 * @param {Object[]} rawMaps
 */
export const analyzeCommonOpponents = (team1, team2, rawMaps) => {
  const opp1 = getOpponents(team1, rawMaps);
  const opp2 = getOpponents(team2, rawMaps);
  const t1 = normalizeTeam(team1);
  const t2 = normalizeTeam(team2);

  const common = [...opp1].filter(o => opp2.has(o) && o !== t1 && o !== t2);

  const breakdown = common.map(opponent => {
    const r1 = getPerformanceVsOpponent(team1, opponent, rawMaps);
    const r2 = getPerformanceVsOpponent(team2, opponent, rawMaps);
    const diff = r1.dominance - r2.dominance;
    const advantage = Math.abs(diff) >= 0.15 ? (diff > 0 ? 'team1' : 'team2') : 'even';
    return { opponent, team1Result: r1, team2Result: r2, advantage };
  });

  const team1Advantages = breakdown.filter(b => b.advantage === 'team1').length;
  const team2Advantages = breakdown.filter(b => b.advantage === 'team2').length;
  const team1AvgDom = breakdown.length > 0
    ? breakdown.reduce((s, b) => s + b.team1Result.dominance, 0) / breakdown.length
    : 0.5;
  const team2AvgDom = breakdown.length > 0
    ? breakdown.reduce((s, b) => s + b.team2Result.dominance, 0) / breakdown.length
    : 0.5;

  return {
    breakdown,
    summary: {
      commonCount: common.length,
      team1Advantages,
      team2Advantages,
      team1AvgDominance: team1AvgDom,
      team2AvgDominance: team2AvgDom,
    },
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
    .filter(m => normalizeTeam(m.team1) === t || normalizeTeam(m.team2) === t)
    .sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return da - db;
    });

  const recent = teamMaps.slice(-lastN);

  const results = recent.map(m => {
    const flipped = normalizeTeam(m.team1) !== t;
    const sf = flipped ? (m.score2 ?? 0) : (m.score1 ?? 0);
    const sa = flipped ? (m.score1 ?? 0) : (m.score2 ?? 0);
    return {
      map: m.map,
      date: m.date,
      opponent: flipped ? m.team1 : m.team2,
      sf,
      sa,
      result: sf > sa ? 'W' : sf < sa ? 'L' : 'D',
    };
  });

  const wins   = results.filter(r => r.result === 'W').length;
  const losses = results.filter(r => r.result === 'L').length;
  const draws  = results.filter(r => r.result === 'D').length;

  // Weighted momentum — most recent maps carry more weight
  const weights = results.map((_, i) => (i + 1) / results.length);
  const weightSum = weights.reduce((s, w) => s + w, 0);
  const momentum = weightSum > 0
    ? results.reduce((s, r, i) => {
        const v = r.result === 'W' ? 1 : r.result === 'D' ? 0.5 : 0;
        return s + v * weights[i];
      }, 0) / weightSum
    : 0.5;

  // Trend: compare first half vs second half of recent maps
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
    team,
    totalMaps: teamMaps.length,
    last5Maps: results,
    record: `${wins}W-${losses}L${draws > 0 ? `-${draws}D` : ''}`,
    wins,
    losses,
    draws,
    momentum,
    trend,
    streak,
    streakType,
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
    const isT1 = normalizeTeam(m.team1) === t;
    const isT2 = normalizeTeam(m.team2) === t;
    if (!isT1 && !isT2) continue;

    const mapName = m.map || 'unknown';
    if (!stats[mapName]) {
      stats[mapName] = { wins: 0, losses: 0, fragsFor: 0, fragsAgainst: 0, played: 0 };
    }

    const sf = isT1 ? (m.score1 ?? 0) : (m.score2 ?? 0);
    const sa = isT1 ? (m.score2 ?? 0) : (m.score1 ?? 0);
    stats[mapName].fragsFor += sf;
    stats[mapName].fragsAgainst += sa;
    stats[mapName].played++;
    if (sf > sa) stats[mapName].wins++;
    else if (sa > sf) stats[mapName].losses++;
  }

  for (const s of Object.values(stats)) {
    s.winRate = s.played > 0 ? s.wins / s.played : 0;
    s.avgFragDiff = s.played > 0
      ? Math.round((s.fragsFor - s.fragsAgainst) / s.played)
      : 0;
  }

  return stats;
};

// ─── Player Statistics ────────────────────────────────────────────────────────

/**
 * Aggregate per-player K/D and trend from rawMaps.
 * @param {Object[]} rawMaps
 * @returns {Object} lowercaseName → player stats
 */
export const calculatePlayerStats = (rawMaps) => {
  const players = {};

  for (const m of rawMaps) {
    if (!Array.isArray(m.players)) continue;
    for (const p of m.players) {
      const name = p.name || p.nick;
      if (!name) continue;
      const key = name.toLowerCase();
      if (!players[key]) {
        players[key] = { name, team: p.team || '', mapsPlayed: 0, totalFrags: 0, totalDeaths: 0, recentFrags: [] };
      }
      const frags  = p.stats?.frags  ?? p.frags  ?? 0;
      const deaths = p.stats?.deaths ?? p.deaths ?? 0;
      players[key].mapsPlayed++;
      players[key].totalFrags  += frags;
      players[key].totalDeaths += deaths;
      players[key].recentFrags.push(frags);
      if (p.team) players[key].team = p.team;
    }
  }

  for (const p of Object.values(players)) {
    p.kdRatio = p.totalDeaths > 0
      ? parseFloat((p.totalFrags / p.totalDeaths).toFixed(2))
      : p.totalFrags;
    p.fragsPerMap = p.mapsPlayed > 0
      ? parseFloat((p.totalFrags / p.mapsPlayed).toFixed(1))
      : 0;
    // Hot/cold: compare last 3 maps vs tournament average
    const last3 = p.recentFrags.slice(-3);
    const last3Avg = last3.length > 0 ? last3.reduce((s, f) => s + f, 0) / last3.length : p.fragsPerMap;
    p.trend = last3Avg > p.fragsPerMap * 1.1 ? 'hot' : last3Avg < p.fragsPerMap * 0.9 ? 'cold' : 'steady';
  }

  return players;
};

/**
 * Pick top and bottom performers by K/D.
 * @param {Object} playerStats  - output of calculatePlayerStats
 * @param {number} [minMaps=2]
 */
export const getPlayerSpotlight = (playerStats, minMaps = 2) => {
  const eligible = Object.values(playerStats).filter(p => p.mapsPlayed >= minMaps);
  const sorted = [...eligible].sort((a, b) => b.kdRatio - a.kdRatio);
  return {
    hotHands: sorted.slice(0, 3),
    struggling: sorted.slice(-3).reverse(),
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

  // Common opponent advantage
  const commonOpp = analyzeCommonOpponents(team1, team2, rawMaps);
  const { summary, breakdown } = commonOpp;

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

    // Consistency gap (standard deviation of win rates)
    if (breakdown.length >= 2) {
      const t1Std = Math.sqrt(breakdown.reduce((s, b) =>
        s + Math.pow(b.team1Result.winRate - summary.team1AvgDominance, 2), 0) / breakdown.length);
      const t2Std = Math.sqrt(breakdown.reduce((s, b) =>
        s + Math.pow(b.team2Result.winRate - summary.team2AvgDominance, 2), 0) / breakdown.length);
      if (t1Std < t2Std - 0.15) {
        insights.push({
          type: 'consistency',
          text: `${team1} brings higher consistency — their results vs common opponents show less variance than ${team2}'s.`,
        });
      } else if (t2Std < t1Std - 0.15) {
        insights.push({
          type: 'consistency',
          text: `${team2} are the more consistent side based on common-opponent data; ${team1}'s form has been more unpredictable.`,
        });
      }
    }
  }

  // Momentum and streaks
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

  // H2H history
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
