// src/utils/matchLogic.js
import { stripColorCodes, normalizeHighBit, normalize as normalizeName } from './nameNormalizer.js';

// 1. Clean weird Quake characters (display-safe: strips color codes + high-bit decode)
// Delegates to nameNormalizer's authoritative QW_ASCII_TABLE for character mapping.
export function unicodeToAscii(name) {
  if (typeof name !== 'string') return name;
  return normalizeHighBit(stripColorCodes(name));
}

// 2. Parse the JSON from proxy - handles both formats
export function parseMatch(gameId, jsonData) {
  let rawTeams = jsonData.teams || [];

  // Normalize teams: handle both string format ["Team A"] and object format [{name: "Team A", frags: 150}]
  rawTeams = rawTeams.map((t) =>
    typeof t === 'object' && t !== null ? t.name || '' : String(t || '')
  );

  // Handle 1on1 matches: no teams array, extract from players
  if (rawTeams.length === 0 && jsonData.players && Array.isArray(jsonData.players)) {
    // For 1on1, use player names as "team" names
    const uniqueTeams = new Set();
    jsonData.players.forEach((player) => {
      const playerName = unicodeToAscii(player.name || '').trim();
      if (playerName) uniqueTeams.add(playerName);
    });
    rawTeams = Array.from(uniqueTeams);
  }

  const cleanTeams = rawTeams.map((t) => unicodeToAscii(t).trim());
  // Use full normalization pipeline for the matchup key so color-coded names,
  // diacritics, and bracket variants all resolve to the same key.
  const sortedTeams = [...cleanTeams]
    .map((t) => normalizeName(t))
    .sort((a, b) => a.localeCompare(b));
  const matchupKey = sortedTeams.join('vs');

  const teamScores = {};

  // Format 1: team_stats object (simple format)
  if (jsonData.team_stats) {
    for (const [team, stats] of Object.entries(jsonData.team_stats)) {
      const cleanName = unicodeToAscii(team).trim();
      teamScores[cleanName] = stats.frags || 0;
    }
  }
  // Format 2: players array with team assignments (ktxstats full format)
  else if (jsonData.players && Array.isArray(jsonData.players)) {
    // Initialize team scores
    cleanTeams.forEach((t) => (teamScores[t] = 0));

    // Build a case-insensitive lookup from lowercased key → canonical team name
    const teamKeyMap = {};
    cleanTeams.forEach((t) => {
      teamKeyMap[t.toLowerCase()] = t;
    });

    // Sum up frags per team from individual players
    jsonData.players.forEach((player) => {
      const playerTeam = unicodeToAscii(player.team || '').trim();
      const playerName = unicodeToAscii(player.name || '').trim();
      const playerFrags = player.stats?.frags ?? player.frags ?? 0;

      // For team matches: match by team name (case-insensitive)
      const resolvedTeam = teamKeyMap[playerTeam.toLowerCase()];
      if (resolvedTeam !== undefined) {
        teamScores[resolvedTeam] += playerFrags;
      }
      // For 1on1 matches: match by player name (case-insensitive)
      else {
        const resolvedPlayer = teamKeyMap[playerName.toLowerCase()];
        if (resolvedPlayer !== undefined) {
          teamScores[resolvedPlayer] = playerFrags;
        }
      }
    });
  }

  // Parse timestamp for series detection
  // Format: "2026-01-09 11:13:43 +0000"
  let timestamp = null;
  if (jsonData.date) {
    try {
      // Replace space before timezone with 'T' for ISO format parsing
      const isoDate = jsonData.date.replace(' ', 'T').replace(' ', '');
      timestamp = new Date(isoDate).getTime();
    } catch {
      timestamp = null;
    }
  }

  return {
    id: gameId,
    date: jsonData.date,
    timestamp, // Unix timestamp in ms for sorting/grouping
    map: jsonData.map,
    mode: jsonData.mode,
    duration: jsonData.duration || null, // Map duration in seconds
    teams: cleanTeams,
    matchupId: matchupKey,
    scores: teamScores,
    originalData: jsonData,
  };
}

// 3. Calculate Standings (For Group Stage)
export function calculateStandings(allMatches) {
  const series = {};

  // Group individual maps into Series (Matches)
  allMatches.forEach((match) => {
    if (!series[match.matchupId]) {
      series[match.matchupId] = { teams: match.teams, mapWins: {} };
      match.teams.forEach((t) => (series[match.matchupId].mapWins[t] = 0));
    }
    const t1 = match.teams[0];
    const t2 = match.teams[1];
    const s1 = match.scores[t1] || 0;
    const s2 = match.scores[t2] || 0;

    // Who won the map?
    if (s1 > s2) series[match.matchupId].mapWins[t1]++;
    if (s2 > s1) series[match.matchupId].mapWins[t2]++;
  });

  // Calculate Points based on Series results
  const standings = {};
  Object.values(series).forEach((s) => {
    const t1 = s.teams[0];
    const t2 = s.teams[1];
    const w1 = s.mapWins[t1];
    const w2 = s.mapWins[t2];

    [t1, t2].forEach((t) => {
      if (!standings[t])
        standings[t] = {
          name: t,
          played: 0,
          points: 0,
          mapsWon: 0,
          mapsLost: 0,
          matchesWon: 0,
          matchesLost: 0,
          matchesDraw: 0,
        };
    });

    standings[t1].played++;
    standings[t2].played++;
    standings[t1].mapsWon += w1;
    standings[t1].mapsLost += w2;
    standings[t2].mapsWon += w2;
    standings[t2].mapsLost += w1;

    // Logic: 3 points for win, 1 for draw
    if (w1 > w2) {
      standings[t1].matchesWon++;
      standings[t1].points += 3;
      standings[t2].matchesLost++;
    } else if (w2 > w1) {
      standings[t2].matchesWon++;
      standings[t2].points += 3;
      standings[t1].matchesLost++;
    } else {
      standings[t1].matchesDraw++;
      standings[t1].points += 1;
      standings[t2].matchesDraw++;
      standings[t2].points += 1;
    }
  });

  // Sort: Points > MapDiff > MapsWon
  return Object.values(standings).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const diffA = a.mapsWon - a.mapsLost;
    const diffB = b.mapsWon - b.mapsLost;
    if (diffB !== diffA) return diffB - diffA;
    return b.mapsWon - a.mapsWon;
  });
}

// 4. Get series summary for bracket matching
export function getSeriesSummary(allMatches) {
  const series = {};

  allMatches.forEach((match) => {
    if (!series[match.matchupId]) {
      series[match.matchupId] = {
        teams: match.teams,
        mapWins: {},
        maps: [],
      };
      match.teams.forEach((t) => (series[match.matchupId].mapWins[t] = 0));
    }

    const t1 = match.teams[0];
    const t2 = match.teams[1];
    const s1 = match.scores[t1] || 0;
    const s2 = match.scores[t2] || 0;

    series[match.matchupId].maps.push({
      map: match.map,
      date: match.date,
      scores: match.scores,
    });

    if (s1 > s2) series[match.matchupId].mapWins[t1]++;
    if (s2 > s1) series[match.matchupId].mapWins[t2]++;
  });

  return series;
}

// 5. Find bracket match from series
export function findBracketMatch(team1, team2, seriesSummary) {
  // Use full normalization for the matchup key (handles high-bit, diacritics, decorators)
  const sorted = [normalizeName(team1), normalizeName(team2)].sort((a, b) => a.localeCompare(b));
  const matchupKey = sorted.join('vs');

  // Try normalized key first, then fall back to case-insensitive search
  const resolvedKey = seriesSummary[matchupKey]
    ? matchupKey
    : Object.keys(seriesSummary).find((k) => normalizeName(k) === normalizeName(matchupKey));

  if (resolvedKey && seriesSummary[resolvedKey]) {
    const s = seriesSummary[resolvedKey];
    // Look up map wins using normalize() for key matching
    const t1Norm = normalizeName(team1);
    const t2Norm = normalizeName(team2);
    const storedT1 = Object.keys(s.mapWins).find((k) => normalizeName(k) === t1Norm);
    const storedT2 = Object.keys(s.mapWins).find((k) => normalizeName(k) === t2Norm);
    return {
      team1Score: (storedT1 && s.mapWins[storedT1]) || 0,
      team2Score: (storedT2 && s.mapWins[storedT2]) || 0,
      maps: s.maps,
    };
  }

  return null;
}
