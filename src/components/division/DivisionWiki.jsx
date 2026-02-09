// src/components/division/DivisionWiki.jsx
import React, { useState, useMemo } from 'react';
import { calculateStats, generateWikiTable } from '../../utils/statsLogic';
import { unicodeToAscii } from '../../utils/matchLogic';
import EmptyState from '../EmptyState';

function getTeamInfo(teams, teamName) {
  const lowerName = (teamName || '').toLowerCase();
  const team = teams.find(t => t.name.toLowerCase() === lowerName);
  return team || { name: teamName, tag: '', country: '', players: '' };
}

function calculateStandings(schedule, division) {
  const standings = {};
  const isPlayAll = (division.groupStageType || 'bestof') === 'playall';
  const pointsWin = division.pointsWin ?? 3;
  const pointsLoss = division.pointsLoss ?? 0;

  // Initialize ALL teams from division.teams first
  const teams = division.teams || [];
  teams.forEach(team => {
    standings[team.name] = {
      name: team.name,
      group: team.group || 'A',
      played: 0,
      points: 0,
      mapsWon: 0,
      mapsLost: 0,
      matchesWon: 0,
      matchesLost: 0
    };
  });

  const groupMatches = schedule.filter(m => m.round === 'group' && m.maps?.length > 0);

  groupMatches.forEach(match => {
    const { team1, team2, maps, group } = match;
    // Ensure teams exist (in case schedule has teams not in teams list)
    [team1, team2].forEach(t => {
      if (!standings[t]) standings[t] = {
        name: t, group: group || 'A', played: 0, points: 0,
        mapsWon: 0, mapsLost: 0, matchesWon: 0, matchesLost: 0
      };
    });

    let t1 = 0, t2 = 0;
    maps.forEach(m => {
      if (m.score1 > m.score2) { 
        t1++; 
        standings[team1].mapsWon++; 
        standings[team2].mapsLost++;
        if (isPlayAll) {
          standings[team1].points += pointsWin;
          standings[team2].points += pointsLoss;
        }
      } else if (m.score2 > m.score1) { 
        t2++; 
        standings[team2].mapsWon++; 
        standings[team1].mapsLost++;
        if (isPlayAll) {
          standings[team2].points += pointsWin;
          standings[team1].points += pointsLoss;
        }
      }
    });

    if (t1 > 0 || t2 > 0) {
      standings[team1].played++; standings[team2].played++;
      if (t1 > t2) { 
        standings[team1].matchesWon++;
        standings[team2].matchesLost++;
        if (!isPlayAll) {
          standings[team1].points += pointsWin;
          standings[team2].points += pointsLoss;
        }
      } else if (t2 > t1) { 
        standings[team2].matchesWon++;
        standings[team1].matchesLost++;
        if (!isPlayAll) {
          standings[team2].points += pointsWin;
          standings[team1].points += pointsLoss;
        }
      }
    }
  });

  return Object.values(standings).sort((a, b) => 
    b.points - a.points || 
    (b.mapsWon - b.mapsLost) - (a.mapsWon - a.mapsLost) || 
    b.mapsWon - a.mapsWon
  );
}

// Helper function to determine which tier a position falls into (for multi-tier playoffs)
function getTierForPosition(position, playoffTiers) {
  if (!playoffTiers || playoffTiers.length === 0) return null;

  for (const tier of playoffTiers) {
    const [start, end] = tier.positions.split('-').map(n => parseInt(n.trim()));
    if (position >= start && position <= end) {
      return tier;
    }
  }
  return null;
}

// Helper function to map tier ID to Liquipedia background color
function getTierBackgroundColor(tierId, isFirst) {
  if (isFirst) return 'up'; // First place always gets 'up' (green)

  const tierBgColors = {
    gold: 'up',       // Green background for gold tier
    silver: 'stayup', // Light green/teal for silver tier
    bronze: 'stay',   // Yellow/neutral for bronze tier
    copper: 'stay',
    iron: 'staydown',
    wood: 'staydown',
    stone: 'down'
  };
  return tierBgColors[tierId] || 'stay';
}

// Generate Liquipedia GroupTableStart format
function generateStandingsWiki(standings, teams, division, options) {
  const groups = {};
  standings.forEach(t => {
    const g = t.group || 'A';
    if (!groups[g]) groups[g] = [];
    groups[g].push(t);
  });

  let wiki = '';

  Object.entries(groups).sort().forEach(([groupName, gs]) => {
    // Build info message based on format
    let info = '';
    if (division.format === 'multi-tier' && division.playoffTiers) {
      const tierDescriptions = division.playoffTiers.map(tier =>
        `${tier.positions}: ${tier.name}`
      ).join(', ');
      info = `Playoff Tiers: ${tierDescriptions}`;
    } else {
      info = options.advanceCount ? `Top ${options.advanceCount} advance to Playoffs.` : '';
    }

    wiki += `{{GroupTableStart|${options.title || division.name} - Group ${groupName}|width=100%|finished=|date=|info=${info}}}\n`;
    wiki += `{{GroupTableColHeader|Team|games=1|maps=1|diff=1}}\n`;

    gs.forEach((t, i) => {
      const teamInfo = getTeamInfo(teams, t.name);
      const cleanName = unicodeToAscii(t.name).trim();
      const diff = t.mapsWon - t.mapsLost;
      const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
      const position = i + 1;

      // Determine background based on format
      let bg = 'stay';

      if (division.format === 'multi-tier' && division.playoffTiers) {
        // Multi-tier playoffs: use tier-based coloring
        const tier = getTierForPosition(position, division.playoffTiers);
        if (tier) {
          bg = getTierBackgroundColor(tier.id, i === 0);
        } else {
          bg = 'stay'; // Not in any tier
        }
      } else {
        // Standard playoffs: use advanceCount
        if (i < (options.advanceCount || 2)) bg = 'up';
        else if (i < (options.advanceCount || 2) + 2) bg = 'stayup';
        else if (i >= gs.length - 2) bg = 'staydown';
      }
      
      const players = teamInfo.players || '';
      const flag = teamInfo.country || 'eu';
      
      wiki += `{{GroupTableSlot|{{TeamAbbr|link=false|${cleanName}|${players}|flag=${flag}}}|place=${i + 1}|win_m=${t.matchesWon}|lose_m=${t.matchesLost}|win_g=${t.mapsWon}|lose_g=${t.mapsLost}|diff=${diffStr}|bg=${bg}}}\n`;
    });
    
    wiki += `{{GroupTableEnd}}\n\n`;
  });
  
  return wiki;
}

// Generate Liquipedia MatchList format
function generateMatchListWiki(schedule, teams, division, options) {
  const groupMatches = schedule.filter(m => m.round === 'group' && m.maps?.length > 0);
  if (!groupMatches.length) return '';

  // Group matches by week/date
  const weeks = {};
  groupMatches.forEach(m => {
    const weekKey = m.date || 'TBD';
    if (!weeks[weekKey]) weeks[weekKey] = [];
    weeks[weekKey].push(m);
  });

  let wiki = `{{MatchList\n|width=100%\n|title=Detailed Results\n|uncollapsed-maps=false\n\n`;
  
  let matchNum = 1;
  Object.entries(weeks).sort((a, b) => a[0].localeCompare(b[0])).forEach(([weekDate, matches], weekIdx) => {
    matches.forEach((match, matchIdx) => {
      const team1Info = getTeamInfo(teams, match.team1);
      const team2Info = getTeamInfo(teams, match.team2);
      const cleanTeam1 = unicodeToAscii(match.team1).trim();
      const cleanTeam2 = unicodeToAscii(match.team2).trim();
      
      // Calculate series score
      let s1 = 0, s2 = 0;
      (match.maps || []).forEach(map => {
        if (map.score1 > map.score2) s1++;
        else if (map.score2 > map.score1) s2++;
      });
      
      const winner = s1 > s2 ? 1 : s2 > s1 ? 2 : '';
      
      // Add week title for first match of each week
      const titleLine = matchIdx === 0 ? `|title=Week ${weekIdx + 1}\n|date=${weekDate} 23:59 {{Abbr/CET}}\n` : '';
      
      wiki += `|match${matchNum}={{MatchMaps\n`;
      if (titleLine) wiki += titleLine;
      wiki += `|player1={{Abbr|${cleanTeam1}|${team1Info.players || ''}}}|player1flag=${team1Info.country || 'eu'}\n`;
      wiki += `|player2={{Abbr|${cleanTeam2}|${team2Info.players || ''}}}|player2flag=${team2Info.country || 'eu'}\n`;
      wiki += `|winner=${winner}\n`;
      wiki += `|games1=${s1} |games2=${s2}\n`;
      wiki += `|details={{BracketMatchSummary\n`;
      wiki += `|date=\n`;
      
      // Add individual maps
      (match.maps || []).forEach((map, mapIdx) => {
        const mapWinner = map.score1 > map.score2 ? 1 : map.score2 > map.score1 ? 2 : '';
        const mapName = (map.map || '').toUpperCase();
        wiki += `|map${mapIdx + 1}win=${mapWinner}|map${mapIdx + 1}=${mapName}|map${mapIdx + 1}p1frags=${map.score1 || ''}|map${mapIdx + 1}p2frags=${map.score2 || ''}|map${mapIdx + 1}p1lineup=|map${mapIdx + 1}p2lineup=\n`;
      });
      
      wiki += `}}\n}}\n\n`;
      matchNum++;
    });
  });
  
  wiki += `}}\n`;
  return wiki;
}

// Generate Liquipedia bracket format for playoffs
function generateBracketWiki(bracket, schedule, teams, division, options) {
  // Check if this is multi-tier format
  if (division.format === 'multi-tier' && division.playoffTiers) {
    return generateMultiTierBracketWiki(division.playoffTiers, schedule, teams, division, options);
  }

  if (!bracket?.winners) return '';

  const teamCount = bracket.teamCount || 4;
  const isDoubleElim = bracket.format === 'double';

  // Route to appropriate generator based on team count
  if (isDoubleElim) {
    return generateDoubleElimBracket(bracket, schedule, teams, division, options);
  }

  if (teamCount >= 32) {
    return generate32SEBracket(bracket, schedule, teams, division, options);
  } else if (teamCount >= 16) {
    return generate16SEBracket(bracket, schedule, teams, division, options);
  } else if (teamCount >= 8) {
    return generate8SEBracket(bracket, schedule, teams, division, options);
  } else {
    return generate4SEBracket(bracket, schedule, teams, division, options);
  }
}

// Generate wiki markup for multi-tier playoffs
function generateMultiTierBracketWiki(tiers, schedule, teams, division, options) {
  if (!tiers || tiers.length === 0) {
    return `== ${options.title || 'Playoffs'} ==\n\n''No playoff tiers configured.''\n`;
  }

  let wiki = `== ${options.title || 'Playoffs'} ==\n\n`;

  // Sort tiers by priority (Gold first, then Silver, then Bronze, etc.)
  const tierOrder = { gold: 0, silver: 1, bronze: 2, copper: 3, iron: 4, wood: 5, stone: 6 };
  const sortedTiers = [...tiers].sort((a, b) => {
    const orderA = tierOrder[a.id] !== undefined ? tierOrder[a.id] : 999;
    const orderB = tierOrder[b.id] !== undefined ? tierOrder[b.id] : 999;
    return orderA - orderB;
  });

  sortedTiers.forEach(tier => {
    // Generate subsection header
    wiki += `=== ${tier.name} (Positions ${tier.positions}) ===\n\n`;

    const tierBracket = tier.bracket || {};
    const teamCount = tier.teams || 4;
    const isDoubleElim = tier.type === 'double';

    // Check if bracket has proper structure
    if (!tierBracket.winners) {
      wiki += `''Bracket not yet configured.''\n\n`;
      return;
    }

    // Generate bracket markup using existing functions
    const tierOptions = {
      ...options,
      title: tier.name, // Use tier name as title
      skipSectionHeader: true // Flag to skip section header in generators
    };

    if (isDoubleElim) {
      wiki += generateTierDoubleElimBracket(tierBracket, schedule, teams, tier, tierOptions);
    } else {
      // Single elimination
      if (teamCount >= 32) {
        wiki += generateTier32SEBracket(tierBracket, schedule, teams, tier, tierOptions);
      } else if (teamCount >= 16) {
        wiki += generateTier16SEBracket(tierBracket, schedule, teams, tier, tierOptions);
      } else if (teamCount >= 8) {
        wiki += generateTier8SEBracket(tierBracket, schedule, teams, tier, tierOptions);
      } else {
        wiki += generateTier4SEBracket(tierBracket, schedule, teams, tier, tierOptions);
      }
    }

    wiki += '\n';
  });

  return wiki;
}

// Tier-specific bracket generators (without section headers)
function generateTier4SEBracket(bracket, schedule, teams, tier, options) {
  const getMatchResult = (t1, t2) => getMatchResultHelper(t1, t2, schedule);
  const formatTeamData = (t, score, isWinner) => formatTeamHelper(t, teams, score, isWinner);
  const getDetails = (t1, t2) => generateMatchDetailsHelper(t1, t2, schedule);

  let wiki = `{{4SEBracket\n`;
  wiki += `|game=quake\n`;
  wiki += ` \n`;
  wiki += `|column-width=200\n`;

  // Semi-final 1
  const sf1t1 = bracket.winners?.semiFinals?.[0]?.team1 || '';
  const sf1t2 = bracket.winners?.semiFinals?.[0]?.team2 || '';
  const sf1result = getMatchResult(sf1t1, sf1t2);
  const sf1t1info = formatTeamData(sf1t1, sf1result.s1, sf1result.s1 > sf1result.s2);
  const sf1t2info = formatTeamData(sf1t2, sf1result.s2, sf1result.s2 > sf1result.s1);

  wiki += `|R1D1=${sf1t1info.name} |R1D1race= |R1D1flag=${sf1t1info.flag} |R1D1score=${sf1t1info.score} |R1D1win=${sf1t1info.win}\n`;
  wiki += `|R1D2=${sf1t2info.name} |R1D2race= |R1D2flag=${sf1t2info.flag} |R1D2score=${sf1t2info.score} |R1D2win=${sf1t2info.win}\n`;
  wiki += `|R1G1details=${getDetails(sf1t1, sf1t2)}\n`;

  // Semi-final 2
  const sf2t1 = bracket.winners?.semiFinals?.[1]?.team1 || '';
  const sf2t2 = bracket.winners?.semiFinals?.[1]?.team2 || '';
  const sf2result = getMatchResult(sf2t1, sf2t2);
  const sf2t1info = formatTeamData(sf2t1, sf2result.s1, sf2result.s1 > sf2result.s2);
  const sf2t2info = formatTeamData(sf2t2, sf2result.s2, sf2result.s2 > sf2result.s1);

  wiki += `|R1D3=${sf2t1info.name} |R1D3race= |R1D3flag=${sf2t1info.flag} |R1D3score=${sf2t1info.score} |R1D3win=${sf2t1info.win}\n`;
  wiki += `|R1D4=${sf2t2info.name} |R1D4race= |R1D4flag=${sf2t2info.flag} |R1D4score=${sf2t2info.score} |R1D4win=${sf2t2info.win}\n`;
  wiki += `|R1G2details=${getDetails(sf2t1, sf2t2)}\n`;

  wiki += `\n \n`;

  // Final
  const ft1 = bracket.winners?.final?.team1 || '';
  const ft2 = bracket.winners?.final?.team2 || '';
  const fresult = getMatchResult(ft1, ft2);
  const ft1info = formatTeamData(ft1, fresult.s1, fresult.s1 > fresult.s2);
  const ft2info = formatTeamData(ft2, fresult.s2, fresult.s2 > fresult.s1);

  wiki += `|R2W1=${ft1info.name} |R2W1race= |R2W1flag=${ft1info.flag} |R2W1score=${ft1info.score} |R2W1win=${ft1info.win}\n`;
  wiki += `|R2W2=${ft2info.name} |R2W2race= |R2W2flag=${ft2info.flag} |R2W2score=${ft2info.score} |R2W2win=${ft2info.win}\n`;
  wiki += `|R2G1details=${getDetails(ft1, ft2)}\n`;

  wiki += `\n \n`;

  // 3rd place (if present)
  const thrd1 = bracket.thirdPlace?.team1 || '';
  const thrd2 = bracket.thirdPlace?.team2 || '';
  if (thrd1 || thrd2) {
    const thrdResult = getMatchResult(thrd1, thrd2);
    const thrd1info = formatTeamData(thrd1, thrdResult.s1, thrdResult.s1 > thrdResult.s2);
    const thrd2info = formatTeamData(thrd2, thrdResult.s2, thrdResult.s2 > thrdResult.s1);

    wiki += `|R2D1=${thrd1info.name} |R2D1race= |R2D1flag=${thrd1info.flag} |R2D1score=${thrd1info.score} |R2D1win=${thrd1info.win}\n`;
    wiki += `|R2D2=${thrd2info.name} |R2D2race= |R2D2flag=${thrd2info.flag} |R2D2score=${thrd2info.score} |R2D2win=${thrd2info.win}\n`;
    wiki += `|R2G2details=${getDetails(thrd1, thrd2) || '{{BracketMatchSummary\n|date=\n|finished=\n|stream=\n}}'}\n`;
  }

  wiki += `}}\n`;
  return wiki;
}

function generateTier8SEBracket(bracket, schedule, teams, tier, options) {
  const getMatchResult = (t1, t2) => getMatchResultHelper(t1, t2, schedule);
  const formatTeamData = (t, score, isWinner) => formatTeamHelper(t, teams, score, isWinner);
  const getDetails = (t1, t2) => generateMatchDetailsHelper(t1, t2, schedule);

  let wiki = `{{8SEBracket\n`;
  wiki += `|game=quake\n`;
  wiki += `|column-width=200\n`;

  // Quarter Finals
  wiki += ` \n`;
  for (let i = 0; i < 4; i++) {
    const qf = bracket.winners?.quarterFinals?.[i];
    const t1 = qf?.team1 || '';
    const t2 = qf?.team2 || '';
    const result = getMatchResult(t1, t2);
    const t1info = formatTeamData(t1, result.s1, result.s1 > result.s2);
    const t2info = formatTeamData(t2, result.s2, result.s2 > result.s1);

    const idx1 = i * 2 + 1;
    const idx2 = i * 2 + 2;

    wiki += `|R1D${idx1}=${t1info.name} |R1D${idx1}race= |R1D${idx1}flag=${t1info.flag} |R1D${idx1}score=${t1info.score} |R1D${idx1}win=${t1info.win}\n`;
    wiki += `|R1D${idx2}=${t2info.name} |R1D${idx2}race= |R1D${idx2}flag=${t2info.flag} |R1D${idx2}score=${t2info.score} |R1D${idx2}win=${t2info.win}\n`;
    wiki += `|R1G${i + 1}details=${getDetails(t1, t2)}\n`;
  }

  // Semi Finals
  wiki += `\n \n`;
  for (let i = 0; i < 2; i++) {
    const sf = bracket.winners?.semiFinals?.[i];
    const t1 = sf?.team1 || '';
    const t2 = sf?.team2 || '';
    const result = getMatchResult(t1, t2);
    const t1info = formatTeamData(t1, result.s1, result.s1 > result.s2);
    const t2info = formatTeamData(t2, result.s2, result.s2 > result.s1);

    const idx1 = i * 2 + 1;
    const idx2 = i * 2 + 2;

    wiki += `|R2W${idx1}=${t1info.name} |R2W${idx1}race= |R2W${idx1}flag=${t1info.flag} |R2W${idx1}score=${t1info.score} |R2W${idx1}win=${t1info.win}\n`;
    wiki += `|R2W${idx2}=${t2info.name} |R2W${idx2}race= |R2W${idx2}flag=${t2info.flag} |R2W${idx2}score=${t2info.score} |R2W${idx2}win=${t2info.win}\n`;
    wiki += `|R2G${i + 1}details=${getDetails(t1, t2)}\n`;
  }

  // Final
  wiki += `\n \n`;
  const ft1 = bracket.winners?.final?.team1 || '';
  const ft2 = bracket.winners?.final?.team2 || '';
  const fresult = getMatchResult(ft1, ft2);
  const ft1info = formatTeamData(ft1, fresult.s1, fresult.s1 > fresult.s2);
  const ft2info = formatTeamData(ft2, fresult.s2, fresult.s2 > fresult.s1);

  wiki += `|R3W1=${ft1info.name} |R3W1race= |R3W1flag=${ft1info.flag} |R3W1score=${ft1info.score} |R3W1win=${ft1info.win}\n`;
  wiki += `|R3W2=${ft2info.name} |R3W2race= |R3W2flag=${ft2info.flag} |R3W2score=${ft2info.score} |R3W2win=${ft2info.win}\n`;
  wiki += `|R3G1details=${getDetails(ft1, ft2)}\n`;

  // 3rd place
  wiki += `\n \n`;
  const thrd1 = bracket.thirdPlace?.team1 || '';
  const thrd2 = bracket.thirdPlace?.team2 || '';
  if (thrd1 || thrd2) {
    const thrdResult = getMatchResult(thrd1, thrd2);
    const thrd1info = formatTeamData(thrd1, thrdResult.s1, thrdResult.s1 > thrdResult.s2);
    const thrd2info = formatTeamData(thrd2, thrdResult.s2, thrdResult.s2 > thrdResult.s1);

    wiki += `|R3D1=${thrd1info.name} |R3D1race= |R3D1flag=${thrd1info.flag} |R3D1score=${thrd1info.score} |R3D1win=${thrd1info.win}\n`;
    wiki += `|R3D2=${thrd2info.name} |R3D2race= |R3D2flag=${thrd2info.flag} |R3D2score=${thrd2info.score} |R3D2win=${thrd2info.win}\n`;
    wiki += `|R3G2details=${getDetails(thrd1, thrd2) || '{{BracketMatchSummary\n|date=\n|finished=\n|stream=\n}}'}\n`;
  }

  wiki += `}}\n`;
  return wiki;
}

function generateTier16SEBracket(bracket, schedule, teams, tier, options) {
  const getMatchResult = (t1, t2) => getMatchResultHelper(t1, t2, schedule);
  const formatTeamData = (t, score, isWinner) => formatTeamHelper(t, teams, score, isWinner);
  const getDetails = (t1, t2) => generateMatchDetailsHelper(t1, t2, schedule);

  let wiki = `{{16SEBracket\n`;
  wiki += `|game=quake\n`;
  wiki += `|column-width=200\n`;

  // Round of 16
  wiki += ` \n`;
  for (let i = 0; i < 8; i++) {
    const r16 = bracket.winners?.round16?.[i];
    const t1 = r16?.team1 || '';
    const t2 = r16?.team2 || '';
    const result = getMatchResult(t1, t2);
    const t1info = formatTeamData(t1, result.s1, result.s1 > result.s2);
    const t2info = formatTeamData(t2, result.s2, result.s2 > result.s1);

    const idx1 = i * 2 + 1;
    const idx2 = i * 2 + 2;

    wiki += `|R1D${idx1}=${t1info.name} |R1D${idx1}race= |R1D${idx1}flag=${t1info.flag} |R1D${idx1}score=${t1info.score} |R1D${idx1}win=${t1info.win}\n`;
    wiki += `|R1D${idx2}=${t2info.name} |R1D${idx2}race= |R1D${idx2}flag=${t2info.flag} |R1D${idx2}score=${t2info.score} |R1D${idx2}win=${t2info.win}\n`;
    wiki += `|R1G${i + 1}details=${getDetails(t1, t2)}\n`;
  }

  // Quarter Finals
  wiki += `\n \n`;
  for (let i = 0; i < 4; i++) {
    const qf = bracket.winners?.quarterFinals?.[i];
    const t1 = qf?.team1 || '';
    const t2 = qf?.team2 || '';
    const result = getMatchResult(t1, t2);
    const t1info = formatTeamData(t1, result.s1, result.s1 > result.s2);
    const t2info = formatTeamData(t2, result.s2, result.s2 > result.s1);

    const idx1 = i * 2 + 1;
    const idx2 = i * 2 + 2;

    wiki += `|R2W${idx1}=${t1info.name} |R2W${idx1}race= |R2W${idx1}flag=${t1info.flag} |R2W${idx1}score=${t1info.score} |R2W${idx1}win=${t1info.win}\n`;
    wiki += `|R2W${idx2}=${t2info.name} |R2W${idx2}race= |R2W${idx2}flag=${t2info.flag} |R2W${idx2}score=${t2info.score} |R2W${idx2}win=${t2info.win}\n`;
    wiki += `|R2G${i + 1}details=${getDetails(t1, t2)}\n`;
  }

  // Semi Finals
  wiki += `\n \n`;
  for (let i = 0; i < 2; i++) {
    const sf = bracket.winners?.semiFinals?.[i];
    const t1 = sf?.team1 || '';
    const t2 = sf?.team2 || '';
    const result = getMatchResult(t1, t2);
    const t1info = formatTeamData(t1, result.s1, result.s1 > result.s2);
    const t2info = formatTeamData(t2, result.s2, result.s2 > result.s1);

    const idx1 = i * 2 + 1;
    const idx2 = i * 2 + 2;

    wiki += `|R3W${idx1}=${t1info.name} |R3W${idx1}race= |R3W${idx1}flag=${t1info.flag} |R3W${idx1}score=${t1info.score} |R3W${idx1}win=${t1info.win}\n`;
    wiki += `|R3W${idx2}=${t2info.name} |R3W${idx2}race= |R3W${idx2}flag=${t2info.flag} |R3W${idx2}score=${t2info.score} |R3W${idx2}win=${t2info.win}\n`;
    wiki += `|R3G${i + 1}details=${getDetails(t1, t2)}\n`;
  }

  // Final
  wiki += `\n \n`;
  const ft1 = bracket.winners?.final?.team1 || '';
  const ft2 = bracket.winners?.final?.team2 || '';
  const fresult = getMatchResult(ft1, ft2);
  const ft1info = formatTeamData(ft1, fresult.s1, fresult.s1 > fresult.s2);
  const ft2info = formatTeamData(ft2, fresult.s2, fresult.s2 > fresult.s1);

  wiki += `|R4W1=${ft1info.name} |R4W1race= |R4W1flag=${ft1info.flag} |R4W1score=${ft1info.score} |R4W1win=${ft1info.win}\n`;
  wiki += `|R4W2=${ft2info.name} |R4W2race= |R4W2flag=${ft2info.flag} |R4W2score=${ft2info.score} |R4W2win=${ft2info.win}\n`;
  wiki += `|R4G1details=${getDetails(ft1, ft2)}\n`;

  // 3rd place
  wiki += `\n \n`;
  const thrd1 = bracket.thirdPlace?.team1 || '';
  const thrd2 = bracket.thirdPlace?.team2 || '';
  if (thrd1 || thrd2) {
    const thrdResult = getMatchResult(thrd1, thrd2);
    const thrd1info = formatTeamData(thrd1, thrdResult.s1, thrdResult.s1 > thrdResult.s2);
    const thrd2info = formatTeamData(thrd2, thrdResult.s2, thrdResult.s2 > thrdResult.s1);

    wiki += `|R4D1=${thrd1info.name} |R4D1race= |R4D1flag=${thrd1info.flag} |R4D1score=${thrd1info.score} |R4D1win=${thrd1info.win}\n`;
    wiki += `|R4D2=${thrd2info.name} |R4D2race= |R4D2flag=${thrd2info.flag} |R4D2score=${thrd2info.score} |R4D2win=${thrd2info.win}\n`;
    wiki += `|R4G2details=${getDetails(thrd1, thrd2) || '{{BracketMatchSummary\n|date=\n|finished=\n|stream=\n}}'}\n`;
  }

  wiki += `}}\n`;
  return wiki;
}

function generateTier32SEBracket(bracket, schedule, teams, tier, options) {
  // For 32-team tiers, we use a simplified listing approach
  // Full 32SE bracket is quite large
  let wiki = `{{32SEBracket\n`;
  wiki += `|game=quake\n`;
  wiki += `|column-width=180\n`;
  wiki += `<!-- 32-team bracket - configure matches as needed -->\n`;
  wiki += `}}\n`;
  return wiki;
}

function generateTierDoubleElimBracket(bracket, schedule, teams, tier, options) {
  // For double elim tiers, output a structured list
  let wiki = `\n`;
  wiki += `'''Winners Bracket'''\n`;

  if (bracket.winners?.quarterFinals) {
    wiki += `* Quarter Finals:\n`;
    bracket.winners.quarterFinals.forEach((m, i) => {
      wiki += `** Match ${i + 1}: ${m.team1 || 'TBD'} vs ${m.team2 || 'TBD'}\n`;
    });
  }

  wiki += `* Semi Finals:\n`;
  bracket.winners?.semiFinals?.forEach((m, i) => {
    wiki += `** Match ${i + 1}: ${m.team1 || 'TBD'} vs ${m.team2 || 'TBD'}\n`;
  });

  wiki += `* Winners Final: ${bracket.winners?.final?.team1 || 'TBD'} vs ${bracket.winners?.final?.team2 || 'TBD'}\n\n`;

  wiki += `'''Losers Bracket'''\n`;
  wiki += `* (Losers bracket matches configured per tournament)\n\n`;

  wiki += `'''Grand Final'''\n`;
  wiki += `* ${bracket.grandFinal?.team1 || 'TBD'} vs ${bracket.grandFinal?.team2 || 'TBD'}\n`;

  if (tier.bracketReset !== false) {
    wiki += `* (Bracket reset available if losers bracket winner wins Grand Final)\n`;
  }

  wiki += `\n`;
  return wiki;
}

// Helper functions for bracket generation
function getMatchResultHelper(team1, team2, schedule) {
  if (!team1 || !team2) return { maps: [], s1: 0, s2: 0 };

  const t1Lower = team1.toLowerCase();
  const t2Lower = team2.toLowerCase();
  const match = schedule.find(m =>
    (m.team1.toLowerCase() === t1Lower && m.team2.toLowerCase() === t2Lower) ||
    (m.team1.toLowerCase() === t2Lower && m.team2.toLowerCase() === t1Lower)
  );

  if (!match?.maps?.length) return { maps: [], s1: 0, s2: 0 };

  let s1 = 0, s2 = 0;
  const isNormal = match.team1.toLowerCase() === t1Lower;
  
  match.maps.forEach(map => {
    // Handle forfeit - team that forfeited loses the map
    if (map.forfeit) {
      if (isNormal) {
        if (map.forfeit === 'team1') s2++;  // team1 forfeited, team2 wins
        else s1++;  // team2 forfeited, team1 wins
      } else {
        if (map.forfeit === 'team2') s2++;  // team2 forfeited, team1 (swapped) wins
        else s1++;  // team1 forfeited, team2 (swapped) wins
      }
    } else {
      // Normal scoring
      if (isNormal) {
        if (map.score1 > map.score2) s1++; 
        else if (map.score2 > map.score1) s2++;
      } else {
        if (map.score2 > map.score1) s1++; 
        else if (map.score1 > map.score2) s2++;
      }
    }
  });
  
  return { 
    maps: match.maps.map(m => ({
      map: m.map,
      p1frags: isNormal ? m.score1 : m.score2,
      p2frags: isNormal ? m.score2 : m.score1,
      winner: (() => {
        if (m.forfeit) {
          // If forfeited, determine winner based on who forfeited
          if (isNormal) {
            return m.forfeit === 'team1' ? 2 : 1;  // team1 FF -> team2 wins (2), team2 FF -> team1 wins (1)
          } else {
            return m.forfeit === 'team2' ? 2 : 1;  // reversed
          }
        } else {
          // Normal winner determination
          return isNormal ? 
            (m.score1 > m.score2 ? 1 : m.score2 > m.score1 ? 2 : '') : 
            (m.score2 > m.score1 ? 1 : m.score1 > m.score2 ? 2 : '');
        }
      })(),
      forfeit: m.forfeit,  // Pass through forfeit info
      isNormal: isNormal  // Pass through team order
    })),
    s1, 
    s2 
  };
}

function formatTeamHelper(teamName, teams, score, isWinner) {
  if (!teamName) return { name: 'TBD', flag: '', score: '', win: '' };
  // Clean the team name for wiki output
  const cleanName = unicodeToAscii(teamName).trim();
  const info = getTeamInfo(teams, teamName);
  return {
    name: cleanName,
    flag: info.country || 'eu',
    score: score !== undefined && score !== null ? score : '',
    win: isWinner ? '1' : ''
  };
}

function generateMatchDetailsHelper(team1, team2, schedule) {
  const result = getMatchResultHelper(team1, team2, schedule);
  const t1Lower = team1.toLowerCase();
  const t2Lower = team2.toLowerCase();
  const match = schedule.find(m =>
    (m.team1.toLowerCase() === t1Lower && m.team2.toLowerCase() === t2Lower) ||
    (m.team1.toLowerCase() === t2Lower && m.team2.toLowerCase() === t1Lower)
  );
  
  if (!result.maps.length) return '';
  
  let details = `{{BracketMatchSummary\n|date=\n|finished=\n|stream=\n`;
  
  // Check if any maps have forfeits
  const hasMapForfeits = result.maps.some(m => m.forfeit);
  const forfeitedMaps = [];
  
  result.maps.forEach((m, i) => {
    const mapNum = i + 1;
    
    if (m.forfeit) {
      // Map forfeited - show W/L instead of frags
      const isNormal = m.isNormal;
      let p1display, p2display;
      
      if (isNormal) {
        // Normal order: team1 vs team2
        p1display = m.forfeit === 'team1' ? 'L' : 'W';
        p2display = m.forfeit === 'team1' ? 'W' : 'L';
      } else {
        // Reversed order: team2 vs team1
        p1display = m.forfeit === 'team2' ? 'L' : 'W';
        p2display = m.forfeit === 'team2' ? 'W' : 'L';
      }
      
      details += `|map${mapNum}=${(m.map || '').toLowerCase()} |map${mapNum}win=${m.winner} |map${mapNum}p1frags=${p1display} |map${mapNum}p2frags=${p2display}\n`;
      
      // Track which map was forfeited for comment
      // m.forfeit stores which team in the MATCH forfeited ('team1' or 'team2')
      // We need to map this to the actual team name from match object
      let forfeitTeam;
      if (m.forfeit === 'team1') {
        forfeitTeam = match.team1;
      } else if (m.forfeit === 'team2') {
        forfeitTeam = match.team2;
      }
      forfeitedMaps.push(`Map ${mapNum} forfeited by ${unicodeToAscii(forfeitTeam)}`);
    } else {
      // Normal map - show frags
      details += `|map${mapNum}=${(m.map || '').toLowerCase()} |map${mapNum}win=${m.winner} |map${mapNum}p1frags=${m.p1frags || ''} |map${mapNum}p2frags=${m.p2frags || ''}\n`;
    }
  });
  
  // Add forfeit comments
  if (match?.forfeit) {
    const forfeitTeam = match.forfeit === 'team1' ? match.team1 : match.team2;
    details += `|comment=${unicodeToAscii(forfeitTeam)} forfeited (Match Level)\n`;
  } else if (forfeitedMaps.length > 0) {
    details += `|comment=${forfeitedMaps.join('; ')}\n`;
  }
  
  details += `}}`;
  return details;
}

// Generate 4-team bracket (Semi-Finals → Final)
function generate4SEBracket(bracket, schedule, teams, division, options) {
  const getMatchResult = (t1, t2) => getMatchResultHelper(t1, t2, schedule);
  const formatTeamData = (t, score, isWinner) => formatTeamHelper(t, teams, score, isWinner);
  const getDetails = (t1, t2) => generateMatchDetailsHelper(t1, t2, schedule);
  
  let wiki = `== ${options.title || 'Playoffs'} ==\n`;
  wiki += `{{4SEBracket\n`;
  wiki += `|game=quake\n`;
  wiki += ` \n`;
  wiki += `|column-width=200\n`;
  
  // Semi-final 1
  const sf1t1 = bracket.winners?.semiFinals?.[0]?.team1 || '';
  const sf1t2 = bracket.winners?.semiFinals?.[0]?.team2 || '';
  const sf1result = getMatchResult(sf1t1, sf1t2);
  const sf1t1info = formatTeamData(sf1t1, sf1result.s1, sf1result.s1 > sf1result.s2);
  const sf1t2info = formatTeamData(sf1t2, sf1result.s2, sf1result.s2 > sf1result.s1);
  
  wiki += `|R1D1=${sf1t1info.name} |R1D1race= |R1D1flag=${sf1t1info.flag} |R1D1score=${sf1t1info.score} |R1D1win=${sf1t1info.win}\n`;
  wiki += `|R1D2=${sf1t2info.name} |R1D2race= |R1D2flag=${sf1t2info.flag} |R1D2score=${sf1t2info.score} |R1D2win=${sf1t2info.win}\n`;
  wiki += `|R1G1details=${getDetails(sf1t1, sf1t2)}\n`;
  
  // Semi-final 2
  const sf2t1 = bracket.winners?.semiFinals?.[1]?.team1 || '';
  const sf2t2 = bracket.winners?.semiFinals?.[1]?.team2 || '';
  const sf2result = getMatchResult(sf2t1, sf2t2);
  const sf2t1info = formatTeamData(sf2t1, sf2result.s1, sf2result.s1 > sf2result.s2);
  const sf2t2info = formatTeamData(sf2t2, sf2result.s2, sf2result.s2 > sf2result.s1);
  
  wiki += `|R1D3=${sf2t1info.name} |R1D3race= |R1D3flag=${sf2t1info.flag} |R1D3score=${sf2t1info.score} |R1D3win=${sf2t1info.win}\n`;
  wiki += `|R1D4=${sf2t2info.name} |R1D4race= |R1D4flag=${sf2t2info.flag} |R1D4score=${sf2t2info.score} |R1D4win=${sf2t2info.win}\n`;
  wiki += `|R1G2details=${getDetails(sf2t1, sf2t2)}\n`;
  
  wiki += `\n \n`;
  
  // Final
  const ft1 = bracket.winners?.final?.team1 || '';
  const ft2 = bracket.winners?.final?.team2 || '';
  const fresult = getMatchResult(ft1, ft2);
  const ft1info = formatTeamData(ft1, fresult.s1, fresult.s1 > fresult.s2);
  const ft2info = formatTeamData(ft2, fresult.s2, fresult.s2 > fresult.s1);
  
  wiki += `|R2W1=${ft1info.name} |R2W1race= |R2W1flag=${ft1info.flag} |R2W1score=${ft1info.score} |R2W1win=${ft1info.win}\n`;
  wiki += `|R2W2=${ft2info.name} |R2W2race= |R2W2flag=${ft2info.flag} |R2W2score=${ft2info.score} |R2W2win=${ft2info.win}\n`;
  wiki += `|R2G1details=${getDetails(ft1, ft2)}\n`;
  
  wiki += `\n \n`;
  
  // 3rd place
  const thrd1 = bracket.thirdPlace?.team1 || '';
  const thrd2 = bracket.thirdPlace?.team2 || '';
  const thrdResult = getMatchResult(thrd1, thrd2);
  const thrd1info = formatTeamData(thrd1, thrdResult.s1, thrdResult.s1 > thrdResult.s2);
  const thrd2info = formatTeamData(thrd2, thrdResult.s2, thrdResult.s2 > thrdResult.s1);
  
  wiki += `|R2D1=${thrd1info.name} |R2D1race= |R2D1flag=${thrd1info.flag} |R2D1score=${thrd1info.score} |R2D1win=${thrd1info.win}\n`;
  wiki += `|R2D2=${thrd2info.name} |R2D2race= |R2D2flag=${thrd2info.flag} |R2D2score=${thrd2info.score} |R2D2win=${thrd2info.win}\n`;
  wiki += `|R2G2details=${getDetails(thrd1, thrd2) || '{{BracketMatchSummary\n|date=\n|finished=\n|stream=\n}}'}\n`;
  
  wiki += `}}\n`;
  
  return wiki;
}

// Generate 8-team bracket (Quarter-Finals → Semi-Finals → Final)
function generate8SEBracket(bracket, schedule, teams, division, options) {
  const getMatchResult = (t1, t2) => getMatchResultHelper(t1, t2, schedule);
  const formatTeamData = (t, score, isWinner) => formatTeamHelper(t, teams, score, isWinner);
  const getDetails = (t1, t2) => generateMatchDetailsHelper(t1, t2, schedule);
  
  let wiki = `== ${options.title || 'Playoffs'} ==\n`;
  wiki += `{{8SEBracket\n`;
  wiki += `|game=quake\n`;
  wiki += `|column-width=200\n`;
  
  // Quarter Finals (R1 in 8SE template)
  wiki += ` \n`;
  for (let i = 0; i < 4; i++) {
    const qf = bracket.winners?.quarterFinals?.[i];
    const t1 = qf?.team1 || '';
    const t2 = qf?.team2 || '';
    const result = getMatchResult(t1, t2);
    const t1info = formatTeamData(t1, result.s1, result.s1 > result.s2);
    const t2info = formatTeamData(t2, result.s2, result.s2 > result.s1);
    
    const idx1 = i * 2 + 1;
    const idx2 = i * 2 + 2;
    
    wiki += `|R1D${idx1}=${t1info.name} |R1D${idx1}race= |R1D${idx1}flag=${t1info.flag} |R1D${idx1}score=${t1info.score} |R1D${idx1}win=${t1info.win}\n`;
    wiki += `|R1D${idx2}=${t2info.name} |R1D${idx2}race= |R1D${idx2}flag=${t2info.flag} |R1D${idx2}score=${t2info.score} |R1D${idx2}win=${t2info.win}\n`;
    wiki += `|R1G${i + 1}details=${getDetails(t1, t2)}\n`;
  }
  
  // Semi Finals (R2 in 8SE template)
  wiki += `\n \n`;
  for (let i = 0; i < 2; i++) {
    const sf = bracket.winners?.semiFinals?.[i];
    const t1 = sf?.team1 || '';
    const t2 = sf?.team2 || '';
    const result = getMatchResult(t1, t2);
    const t1info = formatTeamData(t1, result.s1, result.s1 > result.s2);
    const t2info = formatTeamData(t2, result.s2, result.s2 > result.s1);
    
    const idx1 = i * 2 + 1;
    const idx2 = i * 2 + 2;
    
    // CHANGED: R2D -> R2W
    wiki += `|R2W${idx1}=${t1info.name} |R2W${idx1}race= |R2W${idx1}flag=${t1info.flag} |R2W${idx1}score=${t1info.score} |R2W${idx1}win=${t1info.win}\n`;
    wiki += `|R2W${idx2}=${t2info.name} |R2W${idx2}race= |R2W${idx2}flag=${t2info.flag} |R2W${idx2}score=${t2info.score} |R2W${idx2}win=${t2info.win}\n`;
    wiki += `|R2G${i + 1}details=${getDetails(t1, t2)}\n`;
  }
  
  // Final (R3 in 8SE template)
  wiki += `\n \n`;
  const ft1 = bracket.winners?.final?.team1 || '';
  const ft2 = bracket.winners?.final?.team2 || '';
  const fresult = getMatchResult(ft1, ft2);
  const ft1info = formatTeamData(ft1, fresult.s1, fresult.s1 > fresult.s2);
  const ft2info = formatTeamData(ft2, fresult.s2, fresult.s2 > fresult.s1);
  
  wiki += `|R3W1=${ft1info.name} |R3W1race= |R3W1flag=${ft1info.flag} |R3W1score=${ft1info.score} |R3W1win=${ft1info.win}\n`;
  wiki += `|R3W2=${ft2info.name} |R3W2race= |R3W2flag=${ft2info.flag} |R3W2score=${ft2info.score} |R3W2win=${ft2info.win}\n`;
  wiki += `|R3G1details=${getDetails(ft1, ft2)}\n`;
  
  // 3rd place (R3 bronze)
  wiki += `\n \n`;
  const thrd1 = bracket.thirdPlace?.team1 || '';
  const thrd2 = bracket.thirdPlace?.team2 || '';
  const thrdResult = getMatchResult(thrd1, thrd2);
  const thrd1info = formatTeamData(thrd1, thrdResult.s1, thrdResult.s1 > thrdResult.s2);
  const thrd2info = formatTeamData(thrd2, thrdResult.s2, thrdResult.s2 > thrdResult.s1);
  
  wiki += `|R3D1=${thrd1info.name} |R3D1race= |R3D1flag=${thrd1info.flag} |R3D1score=${thrd1info.score} |R3D1win=${thrd1info.win}\n`;
  wiki += `|R3D2=${thrd2info.name} |R3D2race= |R3D2flag=${thrd2info.flag} |R3D2score=${thrd2info.score} |R3D2win=${thrd2info.win}\n`;
  wiki += `|R3G2details=${getDetails(thrd1, thrd2) || '{{BracketMatchSummary\n|date=\n|finished=\n|stream=\n}}'}\n`;
  
  wiki += `}}\n`;
  
  return wiki;
}

// Generate 16-team bracket (R16 → QF → SF → F)
function generate16SEBracket(bracket, schedule, teams, division, options) {
  const getMatchResult = (t1, t2) => getMatchResultHelper(t1, t2, schedule);
  const formatTeamData = (t, score, isWinner) => formatTeamHelper(t, teams, score, isWinner);
  const getDetails = (t1, t2) => generateMatchDetailsHelper(t1, t2, schedule);
  
  let wiki = `== ${options.title || 'Playoffs'} ==\n`;
  wiki += `{{16SEBracket\n`;
  wiki += `|game=quake\n`;
  wiki += `|column-width=200\n`;
  
  // Round of 16 (R1 in 16SE template)
  wiki += ` \n`;
  for (let i = 0; i < 8; i++) {
    const r16 = bracket.winners?.round16?.[i];
    const t1 = r16?.team1 || '';
    const t2 = r16?.team2 || '';
    const result = getMatchResult(t1, t2);
    const t1info = formatTeamData(t1, result.s1, result.s1 > result.s2);
    const t2info = formatTeamData(t2, result.s2, result.s2 > result.s1);
    
    const idx1 = i * 2 + 1;
    const idx2 = i * 2 + 2;
    
    wiki += `|R1D${idx1}=${t1info.name} |R1D${idx1}race= |R1D${idx1}flag=${t1info.flag} |R1D${idx1}score=${t1info.score} |R1D${idx1}win=${t1info.win}\n`;
    wiki += `|R1D${idx2}=${t2info.name} |R1D${idx2}race= |R1D${idx2}flag=${t2info.flag} |R1D${idx2}score=${t2info.score} |R1D${idx2}win=${t2info.win}\n`;
    wiki += `|R1G${i + 1}details=${getDetails(t1, t2)}\n`;
  }
  
  // Quarter Finals (R2 in 16SE template)
  wiki += `\n \n`;
  for (let i = 0; i < 4; i++) {
    const qf = bracket.winners?.quarterFinals?.[i];
    const t1 = qf?.team1 || '';
    const t2 = qf?.team2 || '';
    const result = getMatchResult(t1, t2);
    const t1info = formatTeamData(t1, result.s1, result.s1 > result.s2);
    const t2info = formatTeamData(t2, result.s2, result.s2 > result.s1);
    
    const idx1 = i * 2 + 1;
    const idx2 = i * 2 + 2;
    
    // CHANGED: R2D -> R2W
    wiki += `|R2W${idx1}=${t1info.name} |R2W${idx1}race= |R2W${idx1}flag=${t1info.flag} |R2W${idx1}score=${t1info.score} |R2W${idx1}win=${t1info.win}\n`;
    wiki += `|R2W${idx2}=${t2info.name} |R2W${idx2}race= |R2W${idx2}flag=${t2info.flag} |R2W${idx2}score=${t2info.score} |R2W${idx2}win=${t2info.win}\n`;
    wiki += `|R2G${i + 1}details=${getDetails(t1, t2)}\n`;
  }
  
  // Semi Finals (R3 in 16SE template)
  wiki += `\n \n`;
  for (let i = 0; i < 2; i++) {
    const sf = bracket.winners?.semiFinals?.[i];
    const t1 = sf?.team1 || '';
    const t2 = sf?.team2 || '';
    const result = getMatchResult(t1, t2);
    const t1info = formatTeamData(t1, result.s1, result.s1 > result.s2);
    const t2info = formatTeamData(t2, result.s2, result.s2 > result.s1);
    
    const idx1 = i * 2 + 1;
    const idx2 = i * 2 + 2;
    
    // CHANGED: R3D -> R3W
    wiki += `|R3W${idx1}=${t1info.name} |R3W${idx1}race= |R3W${idx1}flag=${t1info.flag} |R3W${idx1}score=${t1info.score} |R3W${idx1}win=${t1info.win}\n`;
    wiki += `|R3W${idx2}=${t2info.name} |R3W${idx2}race= |R3W${idx2}flag=${t2info.flag} |R3W${idx2}score=${t2info.score} |R3W${idx2}win=${t2info.win}\n`;
    wiki += `|R3G${i + 1}details=${getDetails(t1, t2)}\n`;
  }
  
  // Final (R4 in 16SE template)
  wiki += `\n \n`;
  const ft1 = bracket.winners?.final?.team1 || '';
  const ft2 = bracket.winners?.final?.team2 || '';
  const fresult = getMatchResult(ft1, ft2);
  const ft1info = formatTeamData(ft1, fresult.s1, fresult.s1 > fresult.s2);
  const ft2info = formatTeamData(ft2, fresult.s2, fresult.s2 > fresult.s1);
  
  wiki += `|R4W1=${ft1info.name} |R4W1race= |R4W1flag=${ft1info.flag} |R4W1score=${ft1info.score} |R4W1win=${ft1info.win}\n`;
  wiki += `|R4W2=${ft2info.name} |R4W2race= |R4W2flag=${ft2info.flag} |R4W2score=${ft2info.score} |R4W2win=${ft2info.win}\n`;
  wiki += `|R4G1details=${getDetails(ft1, ft2)}\n`;
  
  // 3rd place (R4 bronze)
  wiki += `\n \n`;
  const thrd1 = bracket.thirdPlace?.team1 || '';
  const thrd2 = bracket.thirdPlace?.team2 || '';
  const thrdResult = getMatchResult(thrd1, thrd2);
  const thrd1info = formatTeamData(thrd1, thrdResult.s1, thrdResult.s1 > thrdResult.s2);
  const thrd2info = formatTeamData(thrd2, thrdResult.s2, thrdResult.s2 > thrdResult.s1);
  
  wiki += `|R4D1=${thrd1info.name} |R4D1race= |R4D1flag=${thrd1info.flag} |R4D1score=${thrd1info.score} |R4D1win=${thrd1info.win}\n`;
  wiki += `|R4D2=${thrd2info.name} |R4D2race= |R4D2flag=${thrd2info.flag} |R4D2score=${thrd2info.score} |R4D2win=${thrd2info.win}\n`;
  wiki += `|R4G2details=${getDetails(thrd1, thrd2) || '{{BracketMatchSummary\n|date=\n|finished=\n|stream=\n}}'}\n`;
  
  wiki += `}}\n`;
  
  return wiki;
}

// Generate 32-team bracket (R32 → R16 → QF → SF → F)
function generate32SEBracket(bracket, schedule, teams, division, options) {
  const getMatchResult = (t1, t2) => getMatchResultHelper(t1, t2, schedule);
  const formatTeamData = (t, score, isWinner) => formatTeamHelper(t, teams, score, isWinner);
  const getDetails = (t1, t2) => generateMatchDetailsHelper(t1, t2, schedule);
  
  let wiki = `== ${options.title || 'Playoffs'} ==\n`;
  wiki += `{{32SEBracket\n`;
  wiki += `|game=quake\n`;
  wiki += `|column-width=200\n`;
  
  // Round of 32 (R1 in 32SE template)
  wiki += ` \n`;
  for (let i = 0; i < 16; i++) {
    const r32 = bracket.winners?.round32?.[i];
    const t1 = r32?.team1 || '';
    const t2 = r32?.team2 || '';
    const result = getMatchResult(t1, t2);
    const t1info = formatTeamData(t1, result.s1, result.s1 > result.s2);
    const t2info = formatTeamData(t2, result.s2, result.s2 > result.s1);
    
    const idx1 = i * 2 + 1;
    const idx2 = i * 2 + 2;
    
    wiki += `|R1D${idx1}=${t1info.name} |R1D${idx1}race= |R1D${idx1}flag=${t1info.flag} |R1D${idx1}score=${t1info.score} |R1D${idx1}win=${t1info.win}\n`;
    wiki += `|R1D${idx2}=${t2info.name} |R1D${idx2}race= |R1D${idx2}flag=${t2info.flag} |R1D${idx2}score=${t2info.score} |R1D${idx2}win=${t2info.win}\n`;
    wiki += `|R1G${i + 1}details=${getDetails(t1, t2)}\n`;
  }
  
  // Round of 16 (R2 in 32SE template)
  wiki += `\n \n`;
  for (let i = 0; i < 8; i++) {
    const r16 = bracket.winners?.round16?.[i];
    const t1 = r16?.team1 || '';
    const t2 = r16?.team2 || '';
    const result = getMatchResult(t1, t2);
    const t1info = formatTeamData(t1, result.s1, result.s1 > result.s2);
    const t2info = formatTeamData(t2, result.s2, result.s2 > result.s1);
    
    const idx1 = i * 2 + 1;
    const idx2 = i * 2 + 2;
    
    // CHANGED: R2D -> R2W
    wiki += `|R2W${idx1}=${t1info.name} |R2W${idx1}race= |R2W${idx1}flag=${t1info.flag} |R2W${idx1}score=${t1info.score} |R2W${idx1}win=${t1info.win}\n`;
    wiki += `|R2W${idx2}=${t2info.name} |R2W${idx2}race= |R2W${idx2}flag=${t2info.flag} |R2W${idx2}score=${t2info.score} |R2W${idx2}win=${t2info.win}\n`;
    wiki += `|R2G${i + 1}details=${getDetails(t1, t2)}\n`;
  }
  
  // Quarter Finals (R3 in 32SE template)
  wiki += `\n \n`;
  for (let i = 0; i < 4; i++) {
    const qf = bracket.winners?.quarterFinals?.[i];
    const t1 = qf?.team1 || '';
    const t2 = qf?.team2 || '';
    const result = getMatchResult(t1, t2);
    const t1info = formatTeamData(t1, result.s1, result.s1 > result.s2);
    const t2info = formatTeamData(t2, result.s2, result.s2 > result.s1);
    
    const idx1 = i * 2 + 1;
    const idx2 = i * 2 + 2;
    
    // CHANGED: R3D -> R3W
    wiki += `|R3W${idx1}=${t1info.name} |R3W${idx1}race= |R3W${idx1}flag=${t1info.flag} |R3W${idx1}score=${t1info.score} |R3W${idx1}win=${t1info.win}\n`;
    wiki += `|R3W${idx2}=${t2info.name} |R3W${idx2}race= |R3W${idx2}flag=${t2info.flag} |R3W${idx2}score=${t2info.score} |R3W${idx2}win=${t2info.win}\n`;
    wiki += `|R3G${i + 1}details=${getDetails(t1, t2)}\n`;
  }
  
  // Semi Finals (R4 in 32SE template)
  wiki += `\n \n`;
  for (let i = 0; i < 2; i++) {
    const sf = bracket.winners?.semiFinals?.[i];
    const t1 = sf?.team1 || '';
    const t2 = sf?.team2 || '';
    const result = getMatchResult(t1, t2);
    const t1info = formatTeamData(t1, result.s1, result.s1 > result.s2);
    const t2info = formatTeamData(t2, result.s2, result.s2 > result.s1);
    
    const idx1 = i * 2 + 1;
    const idx2 = i * 2 + 2;
    
    // CHANGED: R4D -> R4W
    wiki += `|R4W${idx1}=${t1info.name} |R4W${idx1}race= |R4W${idx1}flag=${t1info.flag} |R4W${idx1}score=${t1info.score} |R4W${idx1}win=${t1info.win}\n`;
    wiki += `|R4W${idx2}=${t2info.name} |R4W${idx2}race= |R4W${idx2}flag=${t2info.flag} |R4W${idx2}score=${t2info.score} |R4W${idx2}win=${t2info.win}\n`;
    wiki += `|R4G${i + 1}details=${getDetails(t1, t2)}\n`;
  }
  
  // Final (R5 in 32SE template)
  wiki += `\n \n`;
  const ft1 = bracket.winners?.final?.team1 || '';
  const ft2 = bracket.winners?.final?.team2 || '';
  const fresult = getMatchResult(ft1, ft2);
  const ft1info = formatTeamData(ft1, fresult.s1, fresult.s1 > fresult.s2);
  const ft2info = formatTeamData(ft2, fresult.s2, fresult.s2 > fresult.s1);
  
  wiki += `|R5W1=${ft1info.name} |R5W1race= |R5W1flag=${ft1info.flag} |R5W1score=${ft1info.score} |R5W1win=${ft1info.win}\n`;
  wiki += `|R5W2=${ft2info.name} |R5W2race= |R5W2flag=${ft2info.flag} |R5W2score=${ft2info.score} |R5W2win=${ft2info.win}\n`;
  wiki += `|R5G1details=${getDetails(ft1, ft2)}\n`;
  
  // 3rd place (R5 bronze)
  wiki += `\n \n`;
  const thrd1 = bracket.thirdPlace?.team1 || '';
  const thrd2 = bracket.thirdPlace?.team2 || '';
  const thrdResult = getMatchResult(thrd1, thrd2);
  const thrd1info = formatTeamData(thrd1, thrdResult.s1, thrdResult.s1 > thrdResult.s2);
  const thrd2info = formatTeamData(thrd2, thrdResult.s2, thrdResult.s2 > thrdResult.s1);
  
  wiki += `|R5D1=${thrd1info.name} |R5D1race= |R5D1flag=${thrd1info.flag} |R5D1score=${thrd1info.score} |R5D1win=${thrd1info.win}\n`;
  wiki += `|R5D2=${thrd2info.name} |R5D2race= |R5D2flag=${thrd2info.flag} |R5D2score=${thrd2info.score} |R5D2win=${thrd2info.win}\n`;
  wiki += `|R5G2details=${getDetails(thrd1, thrd2) || '{{BracketMatchSummary\n|date=\n|finished=\n|stream=\n}}'}\n`;
  
  wiki += `}}\n`;
  
  return wiki;
}

// Generate double elimination bracket (basic implementation)
function generateDoubleElimBracket(bracket, schedule, teams, division, options) {
  // For now, return a note that double elim is complex
  // Full implementation would require specific Liquipedia double elim templates
  let wiki = `== ${options.title || 'Playoffs'} ==\n`;
  wiki += `\n`;
  wiki += `\n`;
  wiki += `\n`;
  wiki += `\n\n`;
  
  // List teams for manual formatting
  wiki += `=== Winners Bracket ===\n`;
  if (bracket.winners?.quarterFinals) {
    wiki += `Quarter Finals:\n`;
    bracket.winners.quarterFinals.forEach((m, i) => {
      wiki += `  Match ${i + 1}: ${m.team1 || 'TBD'} vs ${m.team2 || 'TBD'}\n`;
    });
  }
  wiki += `Semi Finals:\n`;
  bracket.winners?.semiFinals?.forEach((m, i) => {
    wiki += `  Match ${i + 1}: ${m.team1 || 'TBD'} vs ${m.team2 || 'TBD'}\n`;
  });
  wiki += `Final: ${bracket.winners?.final?.team1 || 'TBD'} vs ${bracket.winners?.final?.team2 || 'TBD'}\n\n`;
  
  wiki += `=== Losers Bracket ===\n`;
  wiki += `(Losers bracket structure varies by tournament size)\n\n`;
  
  wiki += `=== Grand Final ===\n`;
  wiki += `${bracket.grandFinal?.team1 || 'TBD'} vs ${bracket.grandFinal?.team2 || 'TBD'}\n`;
  
  return wiki;
}

export default function DivisionWiki({ division, tournamentName }) {
  const [activeExport, setActiveExport] = useState('standings');
  const [copied, setCopied] = useState(false);
  const [options, setOptions] = useState({
    title: division.name || 'Division',
    advanceCount: division.advanceCount || 2
  });

  const teams = division.teams || [];
  const schedule = division.schedule || [];
  const rawMaps = division.rawMaps || [];
  const standings = useMemo(() => calculateStandings(schedule, division), [schedule, division]);

  // Show empty state if no teams exist
  if (teams.length === 0) {
    return (
      <EmptyState
        icon="📝"
        title="Nothing to export yet"
        description="Add teams and match results before generating wiki markup. The wiki export will include standings, match results, and playoff brackets."
      />
    );
  }

  // Extract original ktxstats data for player stats calculation
  const ktxstatsData = useMemo(() => {
    if (!rawMaps || rawMaps.length === 0) return [];
    return rawMaps
      .map(m => m.originalData)
      .filter(d => d && d.players);
  }, [rawMaps]);

  // Calculate player stats
  const playersDb = useMemo(() => {
    if (!ktxstatsData || ktxstatsData.length === 0) return {};
    return calculateStats(ktxstatsData);
  }, [ktxstatsData]);

  const wikiContent = useMemo(() => {
    // DEBUG: Log schedule to see what matches exist
    console.log('=== WIKI GENERATION DEBUG ===');
    console.log('Schedule matches:', schedule.length);
    console.log('Playoff matches:', schedule.filter(m => m.round !== 'group').map(m => ({ 
      team1: m.team1, 
      team2: m.team2, 
      round: m.round,
      maps: m.maps?.length || 0
    })));
    console.log('=============================');
    
    switch (activeExport) {
      case 'standings': 
        return generateStandingsWiki(standings, teams, division, options);
      case 'matches': 
        return generateMatchListWiki(schedule, teams, division, options);
      case 'bracket': 
        return generateBracketWiki(division.bracket, schedule, teams, division, options);
      case 'stats':
        return generateWikiTable(playersDb);
      case 'full':
        return generateStandingsWiki(standings, teams, division, options) + '\n' +
               generateMatchListWiki(schedule, teams, division, options) + '\n' +
               generateBracketWiki(division.bracket, schedule, teams, division, { ...options, title: 'Playoffs' });
      default: 
        return '';
    }
  }, [activeExport, standings, schedule, division.bracket, teams, options, playersDb]);

const handleCopy = async () => {
    // Check if the modern Clipboard API is available (requires HTTPS)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(wikiContent);
        setCopied(true);
      } catch (err) {
        console.warn('Clipboard API failed, trying fallback...', err);
        fallbackCopy();
      }
    } else {
      // Fallback for non-secure contexts (HTTP/LAN)
      fallbackCopy();
    }
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper function for the "Old School" copy method
  const fallbackCopy = () => {
    const textArea = document.createElement("textarea");
    textArea.value = wikiContent;
    
    // Prevent scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed"; 

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) setCopied(true);
    } catch (err) {
      console.error('Fallback copy failed', err);
    }

    document.body.removeChild(textArea);
  };

  const handleDownload = () => {
    const blob = new Blob([wikiContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${division.name.replace(/\s+/g, '_')}_${activeExport}.wiki.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {['standings', 'matches', 'bracket', 'stats', 'full'].map(type => (
          <button 
            key={type} 
            onClick={() => setActiveExport(type)} 
            className={`px-4 py-2 rounded font-body font-semibold capitalize ${activeExport === type ? 'bg-qw-accent text-qw-dark' : 'bg-qw-panel border border-qw-border text-qw-muted hover:text-white'}`}
          >
            {type === 'full' ? 'Full Page' : type === 'stats' ? 'Player Stats' : type}
          </button>
        ))}
      </div>

      <div className="qw-panel p-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-qw-muted text-sm mb-1">Division Title</label>
            <input 
              type="text" 
              value={options.title} 
              onChange={(e) => setOptions({ ...options, title: e.target.value })} 
              className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white text-sm" 
            />
          </div>
          <div>
            <label className="block text-qw-muted text-sm mb-1">Teams Advancing</label>
            <select 
              value={options.advanceCount} 
              onChange={(e) => setOptions({ ...options, advanceCount: parseInt(e.target.value) })}
              className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white text-sm"
            >
              {[1, 2, 3, 4, 6, 8].map(n => <option key={n} value={n}>Top {n}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <p className="text-xs text-qw-muted">
              Uses Liquipedia templates: GroupTableStart, MatchMaps, 4SEBracket
            </p>
          </div>
        </div>
      </div>

      <div className="qw-panel overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-qw-dark border-b border-qw-border">
          <div>
            <h3 className="font-display text-sm text-qw-accent">WIKI OUTPUT</h3>
            <span className="text-xs text-zinc-500">
              {wikiContent.split('\n').length} lines · {wikiContent.length.toLocaleString()} characters
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className={`px-3 py-1.5 rounded text-xs transition-all duration-200 ${
                copied
                  ? 'bg-qw-win/20 text-qw-win'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {copied ? '✓ Copied!' : 'Copy to Clipboard'}
            </button>
            <button onClick={handleDownload} className="px-3 py-1.5 rounded text-xs bg-qw-accent text-qw-dark hover:bg-qw-accent-dim transition-colors">
              ⬇ Download
            </button>
          </div>
        </div>
        <div className="p-4 max-h-[500px] overflow-auto">
          <pre className="font-mono text-xs text-qw-text whitespace-pre-wrap">{wikiContent || ''}</pre>
        </div>
      </div>

      {/* Help section */}
      <div className="qw-panel p-4">
        <h4 className="font-display text-sm text-qw-accent mb-2">TEAM PLAYERS</h4>
        <p className="text-xs text-qw-muted mb-2">
          To include player names in wiki output, add them to each team in the Teams tab. 
          The wiki templates use the format: <code className="bg-qw-dark px-1 rounded">TeamName|player1, player2, player3</code>
        </p>
        {teams.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {teams.slice(0, 4).map(t => (
              <span key={t.id} className="px-2 py-1 bg-qw-dark rounded">
                {t.name}: {t.players || <span className="text-qw-muted italic">no players</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}