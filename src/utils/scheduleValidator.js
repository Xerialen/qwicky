// src/utils/scheduleValidator.js
import { normalize } from './nameNormalizer.js';

/**
 * Find scheduling conflicts where a team is double-booked.
 * A conflict = same team appears in two matches on the same date.
 * Cross-division conflicts checked if allDivisions provided.
 *
 * @param {Array} schedule - matches from current division [{id, team1, team2, date, status, ...}]
 * @param {Array} [allDivisions] - all divisions for cross-division checks
 * @returns {Array<{matchId1: string, matchId2: string, team: string, date: string, type: 'same-division'|'cross-division'}>}
 */
export function findConflicts(schedule, allDivisions = []) {
  const conflicts = [];

  // Same-division conflicts
  const sameDivMap = buildDateTeamMap(schedule);
  for (const [date, teamMap] of sameDivMap) {
    for (const [team, matchIds] of teamMap) {
      if (matchIds.length >= 2) {
        for (let i = 0; i < matchIds.length; i++) {
          for (let j = i + 1; j < matchIds.length; j++) {
            conflicts.push({
              matchId1: matchIds[i],
              matchId2: matchIds[j],
              team,
              date,
              type: 'same-division',
            });
          }
        }
      }
    }
  }

  // Cross-division conflicts
  if (allDivisions.length > 1) {
    const crossMap = new Map(); // date -> team(lower) -> [{matchId, divisionId, team}]

    for (const div of allDivisions) {
      const divSchedule = div.schedule || [];
      for (const match of divSchedule) {
        if (!match.date || match.status === 'completed') continue;

        const date = match.date;
        if (!crossMap.has(date)) crossMap.set(date, new Map());
        const teamMap = crossMap.get(date);

        for (const teamName of [match.team1, match.team2]) {
          if (!teamName) continue;
          const key = normalize(teamName);
          if (!teamMap.has(key)) teamMap.set(key, []);
          teamMap.get(key).push({ matchId: match.id, divisionId: div.id, team: teamName });
        }
      }
    }

    for (const [date, teamMap] of crossMap) {
      for (const [, entries] of teamMap) {
        // Only flag pairs from different divisions
        for (let i = 0; i < entries.length; i++) {
          for (let j = i + 1; j < entries.length; j++) {
            if (entries[i].divisionId !== entries[j].divisionId) {
              conflicts.push({
                matchId1: `${entries[i].divisionId}:${entries[i].matchId}`,
                matchId2: `${entries[j].divisionId}:${entries[j].matchId}`,
                team: entries[i].team,
                date,
                type: 'cross-division',
              });
            }
          }
        }
      }
    }
  }

  return conflicts;
}

/**
 * Get conflicts for a specific match.
 * @param {string} matchId
 * @param {Array} conflicts - output from findConflicts
 * @returns {Array} conflicts involving this match
 */
export function getMatchConflicts(matchId, conflicts) {
  return conflicts.filter((c) => c.matchId1 === matchId || c.matchId2 === matchId);
}

/**
 * Build a map of date -> team(lowercase) -> [matchIds]
 * Skips matches without a date or with status === 'completed'.
 */
function buildDateTeamMap(schedule) {
  const map = new Map(); // date -> Map(teamLower -> [matchId])

  for (const match of schedule) {
    if (!match.date || match.status === 'completed') continue;

    const date = match.date;
    if (!map.has(date)) map.set(date, new Map());
    const teamMap = map.get(date);

    for (const teamName of [match.team1, match.team2]) {
      if (!teamName) continue;
      const key = normalize(teamName);
      if (!teamMap.has(key)) teamMap.set(key, []);
      teamMap.get(key).push(match.id);
    }
  }

  return map;
}
