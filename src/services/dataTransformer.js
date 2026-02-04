// src/services/dataTransformer.js
// Transforms Google Sheets API data into the format expected by goodwiki components

import { unicodeToAscii } from '../utils/matchLogic';

/**
 * Transform API standings to internal format
 * API format: { '#': 1, Team: 'TeamName', Games: '2-1', Maps: '5-3', Diff: '+2' }
 * Internal format: { name, played, points, mapsWon, mapsLost, matchesWon, matchesLost, matchesDraw, group }
 */
export function transformStandings(apiStandings, groupId = 'A') {
  if (!apiStandings || !Array.isArray(apiStandings)) return [];
  
  return apiStandings.map(team => {
    // Parse "W-L" format for Games
    const [matchesWon = 0, matchesLost = 0] = (team.Games || '0-0').split('-').map(Number);
    // Parse "W-L" format for Maps  
    const [mapsWon = 0, mapsLost = 0] = (team.Maps || '0-0').split('-').map(Number);
    
    return {
      name: unicodeToAscii(team.Team || '').trim(),
      group: groupId,
      played: matchesWon + matchesLost,
      points: matchesWon * 3, // Default 3 points per win
      mapsWon,
      mapsLost,
      matchesWon,
      matchesLost,
      matchesDraw: 0
    };
  });
}

/**
 * Transform API teams to internal format
 * API format: { 'Team Name': 'Full Name', 'Team Tag': 'TAG', Players: 'p1, p2, p3' }
 * Internal format: { id, name, tag, country, players }
 */
export function transformTeams(apiTeams) {
  if (!apiTeams || !Array.isArray(apiTeams)) return [];
  
  return apiTeams.map((team, idx) => ({
    id: `team-${idx}`,
    name: unicodeToAscii(team['Team Name'] || '').trim(),
    tag: unicodeToAscii(team['Team Tag'] || '').trim(),
    country: team.Country || 'eu',
    players: team.Players || ''
  }));
}

/**
 * Transform API game to internal schedule format
 * API format: { round, teamA, teamB, mapsWonA, mapsWonB, played, date, maps: [...] }
 * Internal format: { id, team1, team2, round, group, date, status, maps: [...] }
 */
export function transformGame(apiGame, isPlayoff = false) {
  const team1 = unicodeToAscii(apiGame.teamA || '').trim();
  const team2 = unicodeToAscii(apiGame.teamB || '').trim();
  
  // Determine if the match is played
  const isPlayed = apiGame.played === 1 || apiGame.played === '1' || apiGame.played === true;
  
  // Transform individual maps
  const maps = (apiGame.maps || []).map((map, idx) => ({
    id: `map-${idx}`,
    map: map.mapName || map.map || '',
    score1: map.teamAFrags || map.score1 || 0,
    score2: map.teamBFrags || map.score2 || 0,
    gameUrl: map.gameUrl || '',
    forfeit: map.forfeit || null
  }));
  
  // Calculate series scores from maps if not provided
  let mapsWonA = parseInt(apiGame.mapsWonA) || 0;
  let mapsWonB = parseInt(apiGame.mapsWonB) || 0;
  
  if (maps.length > 0 && mapsWonA === 0 && mapsWonB === 0) {
    maps.forEach(m => {
      if (m.score1 > m.score2) mapsWonA++;
      else if (m.score2 > m.score1) mapsWonB++;
    });
  }

  return {
    id: `game-${team1}-vs-${team2}-${apiGame.round || 'unknown'}`,
    team1,
    team2,
    round: isPlayoff ? (apiGame.round || 'playoff') : 'group',
    roundType: apiGame.round || '',
    group: apiGame.group || 'A',
    date: apiGame.date || '',
    status: isPlayed ? 'completed' : 'scheduled',
    mapsWonA,
    mapsWonB,
    maps
  };
}

/**
 * Transform group games to schedule format
 */
export function transformGroupGames(apiGames) {
  if (!apiGames || !Array.isArray(apiGames)) return [];
  return apiGames.map(game => transformGame(game, false));
}

/**
 * Transform playoff games to schedule format
 */
export function transformPlayoffGames(apiGames) {
  if (!apiGames || !Array.isArray(apiGames)) return [];
  return apiGames.map(game => transformGame(game, true));
}

/**
 * Transform API players to stats format
 * API format: { Rank, Player, 'Maps Played', 'Avg Frags', 'Win Rate', 'Avg Eff', 'Avg Dmg' }
 */
export function transformPlayers(apiPlayers) {
  if (!apiPlayers || !Array.isArray(apiPlayers)) return [];
  
  return apiPlayers.map(player => ({
    name: unicodeToAscii(player.Player || '').trim(),
    rank: player.Rank || 0,
    games: player['Maps Played'] || 0,
    avgFrags: parseFloat(player['Avg Frags']) || 0,
    winRate: parseFloat(player['Win Rate']) || 0,
    avgEff: parseFloat(player['Avg Eff']) || 0,
    avgDmg: parseFloat(player['Avg Dmg']) || 0
  }));
}

/**
 * Build bracket structure from playoff games
 * Attempts to detect bracket rounds: Quarter Finals, Semi Finals, Final, 3rd Place, etc.
 */
export function buildBracketFromGames(playoffGames, teams) {
  const bracket = {
    format: 'single',
    teamCount: 4,
    winners: {
      semiFinals: [
        { id: 'w-sf1', team1: '', team2: '' },
        { id: 'w-sf2', team1: '', team2: '' }
      ],
      final: { id: 'w-final', team1: '', team2: '' }
    },
    thirdPlace: { id: '3rd', team1: '', team2: '' }
  };
  
  if (!playoffGames || playoffGames.length === 0) return bracket;
  
  // Detect bracket size from games
  const uniqueTeams = new Set();
  playoffGames.forEach(g => {
    if (g.team1) uniqueTeams.add(g.team1);
    if (g.team2) uniqueTeams.add(g.team2);
  });
  
  const teamCount = uniqueTeams.size;
  bracket.teamCount = teamCount;
  
  // Categorize games by round type
  const roundMap = {
    'Round of 32': [],
    'Round of 16': [],
    'Quarter Final': [],
    'Quarter-Final': [],
    'Quarterfinal': [],
    'QF': [],
    'Semi Final': [],
    'Semi-Final': [],
    'Semifinal': [],
    'SF': [],
    'Final': [],
    'Grand Final': [],
    'Bronze': [],
    '3rd Place': [],
    'Third Place': []
  };
  
  playoffGames.forEach(game => {
    const roundType = (game.roundType || game.round || '').trim();
    for (const [key, arr] of Object.entries(roundMap)) {
      if (roundType.toLowerCase().includes(key.toLowerCase())) {
        arr.push(game);
        return;
      }
    }
    // Default categorization by position
    roundMap['Quarter Final'].push(game);
  });
  
  // Build Round of 32 (if 32+ teams)
  const r32Games = roundMap['Round of 32'];
  if (r32Games.length > 0 || teamCount >= 32) {
    bracket.winners.round32 = Array.from({ length: 16 }, (_, i) => {
      const game = r32Games[i];
      return {
        id: `w-r32-${i + 1}`,
        team1: game?.team1 || '',
        team2: game?.team2 || ''
      };
    });
  }
  
  // Build Round of 16 (if 16+ teams)
  const r16Games = roundMap['Round of 16'];
  if (r16Games.length > 0 || teamCount >= 16) {
    bracket.winners.round16 = Array.from({ length: 8 }, (_, i) => {
      const game = r16Games[i];
      return {
        id: `w-r16-${i + 1}`,
        team1: game?.team1 || '',
        team2: game?.team2 || ''
      };
    });
  }
  
  // Build Quarter Finals (if 8+ teams)
  const qfGames = [...roundMap['Quarter Final'], ...roundMap['Quarter-Final'], ...roundMap['Quarterfinal'], ...roundMap['QF']];
  if (qfGames.length > 0 || teamCount >= 8) {
    bracket.winners.quarterFinals = Array.from({ length: 4 }, (_, i) => {
      const game = qfGames[i];
      return {
        id: `w-qf${i + 1}`,
        team1: game?.team1 || '',
        team2: game?.team2 || ''
      };
    });
  }
  
  // Build Semi Finals
  const sfGames = [...roundMap['Semi Final'], ...roundMap['Semi-Final'], ...roundMap['Semifinal'], ...roundMap['SF']];
  bracket.winners.semiFinals = [
    {
      id: 'w-sf1',
      team1: sfGames[0]?.team1 || '',
      team2: sfGames[0]?.team2 || ''
    },
    {
      id: 'w-sf2',
      team1: sfGames[1]?.team1 || '',
      team2: sfGames[1]?.team2 || ''
    }
  ];
  
  // Build Final
  const finalGames = [...roundMap['Final'], ...roundMap['Grand Final']];
  if (finalGames.length > 0) {
    bracket.winners.final = {
      id: 'w-final',
      team1: finalGames[0]?.team1 || '',
      team2: finalGames[0]?.team2 || ''
    };
  }
  
  // Build 3rd Place
  const bronzeGames = [...roundMap['Bronze'], ...roundMap['3rd Place'], ...roundMap['Third Place']];
  if (bronzeGames.length > 0) {
    bracket.thirdPlace = {
      id: '3rd',
      team1: bronzeGames[0]?.team1 || '',
      team2: bronzeGames[0]?.team2 || ''
    };
  }
  
  return bracket;
}

/**
 * Transform all API data into a complete division structure
 */
export function transformToDivision(apiData, divisionName = 'Division 1') {
  const teams = transformTeams(apiData.teams);
  const standings = transformStandings(apiData.standings);
  const groupGames = transformGroupGames(apiData.groupGames);
  const playoffGames = transformPlayoffGames(apiData.playoffGames);
  const players = transformPlayers(apiData.players);
  
  // Combine all games into schedule
  const schedule = [...groupGames, ...playoffGames];
  
  // Build bracket from playoff games
  const bracket = buildBracketFromGames(playoffGames, teams);
  
  // Build rawMaps for stats calculation (if we have detailed map data with player stats)
  const rawMaps = schedule.flatMap(match => 
    (match.maps || []).filter(m => m.gameUrl).map(m => ({
      id: m.id,
      map: m.map,
      matchId: match.id,
      originalData: null // Would need to fetch ktxstats for full stats
    }))
  );
  
  return {
    id: `div-${Date.now()}`,
    name: divisionName,
    // Format settings (defaults)
    format: 'groups',
    numGroups: 1,
    teamsPerGroup: teams.length,
    advanceCount: 4,
    groupStageBestOf: 3,
    groupStageType: 'bestof',
    groupMeetings: 1,
    matchPace: 'weekly',
    // Playoff settings
    playoffFormat: 'single',
    playoffTeams: bracket.teamCount,
    playoffQFBestOf: 3,
    playoffSFBestOf: 3,
    playoffFinalBestOf: 5,
    playoff3rdBestOf: 3,
    // Points
    pointsWin: 3,
    pointsLoss: 0,
    // Data
    teams,
    schedule,
    bracket,
    rawMaps,
    // Extra data from API
    standings,
    players
  };
}
