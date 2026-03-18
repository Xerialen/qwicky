// src/utils/bracketSeeder.js
import { calculateStandings } from '../components/division/DivisionStandings';

/**
 * Check if group stage is complete (all group matches played).
 * A match is considered played if it has at least one map with scores.
 * @param {object} division
 * @returns {boolean}
 */
export function isGroupStageComplete(division) {
  const schedule = division.schedule || [];
  const groupMatches = schedule.filter(m => m.round === 'group');

  // No group matches means group stage isn't even set up
  if (groupMatches.length === 0) return false;

  // Every group match must have at least one map with a score
  return groupMatches.every(m =>
    m.maps && m.maps.length > 0 && m.maps.some(map => (map.score1 || 0) > 0 || (map.score2 || 0) > 0)
  );
}

/**
 * Seed a bracket from completed group standings.
 * Uses serpentine seeding: #1 seeds go to top half, #2 seeds alternate, etc.
 * For multi-group: interleaves groups so same-group teams don't meet early.
 *
 * @param {Array} standings - array of {name, group, position} sorted by rank
 * @param {object} bracket - existing bracket structure to fill
 * @param {number} advanceCount - teams advancing per group
 * @returns {object} - new bracket with teams filled in
 */
export function seedBracket(standings, bracket, advanceCount) {
  // Deep clone bracket to avoid mutation
  const newBracket = JSON.parse(JSON.stringify(bracket));

  // Determine the first round to fill
  const firstRound = getFirstRound(newBracket);
  if (!firstRound) return newBracket;

  const { key, matches } = firstRound;
  const slotCount = matches.length * 2; // Each match has 2 teams

  // Group standings by group
  const groups = {};
  standings.forEach(team => {
    const g = team.group || 'A';
    if (!groups[g]) groups[g] = [];
    groups[g].push(team);
  });

  const groupNames = Object.keys(groups).sort();
  const numGroups = groupNames.length;

  // Get top N teams per group
  const qualifiers = [];
  groupNames.forEach(g => {
    const topTeams = groups[g].slice(0, advanceCount);
    topTeams.forEach((team, idx) => {
      qualifiers.push({
        name: team.name,
        group: g,
        position: idx + 1 // 1-based position within group
      });
    });
  });

  // Generate seeded matchups
  let seededPairs;

  if (numGroups === 1) {
    // Single group: classic 1v8, 2v7, 3v6, 4v5 seeding
    seededPairs = seedSingleGroup(qualifiers, matches.length);
  } else {
    // Multi-group: serpentine cross-group seeding
    seededPairs = seedMultiGroup(qualifiers, groupNames, advanceCount, matches.length);
  }

  // Fill matches with seeded pairs
  seededPairs.forEach((pair, idx) => {
    if (idx < matches.length) {
      matches[idx].team1 = pair[0] || '';
      matches[idx].team2 = pair[1] || '';
    }
  });

  // Write back into the bracket
  newBracket.winners[key] = matches;

  return newBracket;
}

/**
 * Find the first (earliest) round in the winners bracket.
 */
function getFirstRound(bracket) {
  if (!bracket.winners) return null;

  // Check rounds in order from earliest to latest
  const roundOrder = ['round32', 'round16', 'round12', 'quarterFinals', 'semiFinals'];

  for (const key of roundOrder) {
    if (bracket.winners[key] && Array.isArray(bracket.winners[key]) && bracket.winners[key].length > 0) {
      return { key, matches: bracket.winners[key] };
    }
  }

  return null;
}

/**
 * Single-group seeding: 1v8, 2v7, 3v6, 4v5 pattern.
 * Teams are sorted by position (best first).
 */
function seedSingleGroup(qualifiers, matchCount) {
  // Sort by position
  const sorted = [...qualifiers].sort((a, b) => a.position - b.position);
  const pairs = [];

  for (let i = 0; i < matchCount; i++) {
    const top = sorted[i];
    const bottom = sorted[sorted.length - 1 - i];

    if (top && bottom && top !== bottom) {
      pairs.push([top.name, bottom.name]);
    } else if (top) {
      pairs.push([top.name, '']);
    } else {
      pairs.push(['', '']);
    }
  }

  return pairs;
}

/**
 * Multi-group serpentine seeding.
 * For 2 groups with 4 advancing each (8-team bracket):
 *   QF1: A#1 vs B#4
 *   QF2: B#2 vs A#3
 *   QF3: A#2 vs B#3  (crossed so same-group don't meet until SF)
 *   QF4: B#1 vs A#4
 *
 * For >2 groups, generalizes the serpentine pattern:
 * - Seed slots are filled by interleaving groups
 * - Odd seed positions: Group A first, then B, C...
 * - Even seed positions: reversed group order
 * - Then pair seed 1 vs seed N, seed 2 vs seed N-1, etc.
 */
function seedMultiGroup(qualifiers, groupNames, advanceCount, matchCount) {
  const numGroups = groupNames.length;

  if (numGroups === 2) {
    return seedTwoGroups(qualifiers, groupNames, advanceCount, matchCount);
  }

  // General case: create a seeded list via serpentine interleaving
  const seededList = [];

  for (let pos = 1; pos <= advanceCount; pos++) {
    // Get all teams at this position across groups
    const teamsAtPosition = groupNames.map(g => {
      const team = qualifiers.find(q => q.group === g && q.position === pos);
      return team ? team.name : '';
    });

    // Serpentine: odd positions normal order, even positions reversed
    if (pos % 2 === 1) {
      seededList.push(...teamsAtPosition);
    } else {
      seededList.push(...teamsAtPosition.reverse());
    }
  }

  // Pair 1st vs last, 2nd vs second-to-last, etc.
  const pairs = [];
  for (let i = 0; i < matchCount; i++) {
    const top = seededList[i] || '';
    const bottom = seededList[seededList.length - 1 - i] || '';
    pairs.push([top, bottom]);
  }

  return pairs;
}

/**
 * Specific 2-group seeding with cross-group matchups.
 * Ensures same-group teams don't meet until as late as possible.
 *
 * For 4 advancing per group (8-team QF):
 *   QF1: A#1 vs B#4
 *   QF2: B#2 vs A#3
 *   QF3: A#2 vs B#3
 *   QF4: B#1 vs A#4
 */
function seedTwoGroups(qualifiers, groupNames, advanceCount, matchCount) {
  const gA = groupNames[0];
  const gB = groupNames[1];

  const teamA = {};
  const teamB = {};

  qualifiers.forEach(q => {
    if (q.group === gA) teamA[q.position] = q.name;
    if (q.group === gB) teamB[q.position] = q.name;
  });

  const pairs = [];
  const totalTeams = advanceCount * 2;
  const numMatches = Math.min(matchCount, Math.floor(totalTeams / 2));

  // Cross-group serpentine:
  // Match i (0-based): alternate which group provides the "top" seed
  // Top half (i < numMatches/2): A's top seeds vs B's bottom seeds
  // Bottom half: B's top seeds vs A's bottom seeds (crossed)
  for (let i = 0; i < numMatches; i++) {
    let team1, team2;

    if (i % 2 === 0) {
      // A seed vs B seed (cross seeded)
      const aPos = Math.floor(i / 2) + 1;
      const bPos = advanceCount - Math.floor(i / 2);
      team1 = teamA[aPos] || '';
      team2 = teamB[bPos] || '';
    } else {
      // B seed vs A seed (cross seeded)
      const bPos = Math.floor(i / 2) + 1;
      const aPos = advanceCount - Math.floor(i / 2);
      team1 = teamB[bPos] || '';
      team2 = teamA[aPos] || '';
    }

    pairs.push([team1, team2]);
  }

  return pairs;
}

/**
 * Get standings formatted for bracket seeding.
 * Returns an array of { name, group, position } objects.
 *
 * @param {object} division
 * @returns {Array}
 */
export function getStandingsForSeeding(division) {
  const schedule = division.schedule || [];
  const { standings } = calculateStandings(schedule, division);

  // Group standings by group
  const groups = {};
  standings.forEach(team => {
    const g = team.group || 'A';
    if (!groups[g]) groups[g] = [];
    groups[g].push(team);
  });

  // Add position within each group
  const result = [];
  Object.entries(groups).sort().forEach(([groupName, groupTeams]) => {
    groupTeams.forEach((team, idx) => {
      result.push({
        name: team.name,
        group: groupName,
        position: idx + 1
      });
    });
  });

  return result;
}
