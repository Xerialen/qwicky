// src/utils/wikiExport.js

/**
 * Generate MediaWiki markup for tournament standings table
 */
export function generateStandingsWiki(standings, options = {}) {
  const { 
    title = 'Group Stage Standings',
    showHeader = true 
  } = options;

  if (standings.length === 0) {
    return '<!-- No standings data available -->';
  }

  let wiki = '';
  
  if (showHeader) {
    wiki += `=== ${title} ===\n\n`;
  }

  // Liquipedia-style standings table
  wiki += `{| class="wikitable" style="text-align:center;"\n`;
  wiki += `|-\n`;
  wiki += `! # !! Team !! {{Abbr|P|Played}} !! {{Abbr|W|Wins}} !! {{Abbr|D|Draws}} !! {{Abbr|L|Losses}} !! {{Abbr|MW|Maps Won}} !! {{Abbr|ML|Maps Lost}} !! {{Abbr|Diff|Map Difference}} !! {{Abbr|Pts|Points}}\n`;

  standings.forEach((team, idx) => {
    const mapDiff = team.mapsWon - team.mapsLost;
    const diffStr = mapDiff > 0 ? `+${mapDiff}` : `${mapDiff}`;
    const position = idx + 1;
    
    // Highlight top positions
    let rowStyle = '';
    if (position === 1) {
      rowStyle = ' style="background:#d4edda;"'; // Light green for 1st
    } else if (position === 2) {
      rowStyle = ' style="background:#e8f4ea;"'; // Lighter green for 2nd
    }

    wiki += `|-${rowStyle}\n`;
    wiki += `| '''${position}''' || {{Team|${team.name}}} || ${team.played} || ${team.matchesWon} || ${team.matchesDraw} || ${team.matchesLost} || ${team.mapsWon} || ${team.mapsLost} || ${diffStr} || '''${team.points}'''\n`;
  });

  wiki += `|}\n`;

  return wiki;
}

/**
 * Generate MediaWiki markup for match schedule
 */
export function generateScheduleWiki(matches, options = {}) {
  const { 
    title = 'Match Schedule',
    showHeader = true,
    groupByDate = true 
  } = options;

  if (matches.length === 0) {
    return '<!-- No matches available -->';
  }

  // Sort chronologically
  const sortedMatches = [...matches].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA - dateB;
  });

  let wiki = '';
  
  if (showHeader) {
    wiki += `=== ${title} ===\n\n`;
  }

  if (groupByDate) {
    // Group by date
    const groups = {};
    sortedMatches.forEach(match => {
      const dateKey = match.date ? match.date.split(' ')[0] : 'TBD';
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(match);
    });

    Object.entries(groups).forEach(([date, dateMatches]) => {
      wiki += `==== ${date} ====\n\n`;
      wiki += generateMatchTable(dateMatches);
      wiki += '\n';
    });
  } else {
    wiki += generateMatchTable(sortedMatches);
  }

  return wiki;
}

/**
 * Generate a match results table
 */
function generateMatchTable(matches) {
  let wiki = `{| class="wikitable" style="text-align:center;"\n`;
  wiki += `|-\n`;
  wiki += `! Time !! Team 1 !! Score !! Team 2 !! Map\n`;

  matches.forEach(match => {
    const team1 = match.teams[0];
    const team2 = match.teams[1];
    const score1 = match.scores[team1] || 0;
    const score2 = match.scores[team2] || 0;
    const time = match.date?.split(' ')[1] || 'TBD';
    
    // Bold the winner's score
    const score1Str = score1 > score2 ? `'''${score1}'''` : `${score1}`;
    const score2Str = score2 > score1 ? `'''${score2}'''` : `${score2}`;

    wiki += `|-\n`;
    wiki += `| ${time} || {{Team|${team1}}} || ${score1Str} - ${score2Str} || {{Team|${team2}}} || ${match.map}\n`;
  });

  wiki += `|}\n`;
  return wiki;
}

/**
 * Generate MediaWiki markup for playoff bracket
 */
export function generateBracketWiki(bracketConfig, seriesSummary, options = {}) {
  const { 
    title = 'Playoffs',
    showHeader = true,
    bracketType = '8team' // '8team' (QF+SF+F) or '4team' (SF+F)
  } = options;

  let wiki = '';
  
  if (showHeader) {
    wiki += `=== ${title} ===\n\n`;
  }

  // Helper to get score for a matchup
  const getMatchResult = (team1, team2) => {
    if (!team1 || !team2) return { score1: '', score2: '' };
    
    const sortedTeams = [team1, team2].sort((a, b) => a.localeCompare(b));
    const matchupKey = sortedTeams.join("vs");
    
    if (seriesSummary[matchupKey]) {
      const s = seriesSummary[matchupKey];
      return {
        score1: s.mapWins[team1] || 0,
        score2: s.mapWins[team2] || 0
      };
    }
    return { score1: '', score2: '' };
  };

  // Liquipedia bracket template style
  wiki += `{{Bracket|Bracket/8|id=playoffs\n\n`;

  // Quarter Finals
  if (bracketConfig.quarterFinals) {
    bracketConfig.quarterFinals.forEach((match, idx) => {
      const result = getMatchResult(match.team1, match.team2);
      const matchNum = idx + 1;
      
      wiki += `<!-- Quarter-Final ${matchNum} -->\n`;
      wiki += `|R1M${matchNum}={{Match\n`;
      wiki += `    |opponent1={{TeamOpponent|${match.team1 || 'TBD'}}}\n`;
      wiki += `    |opponent2={{TeamOpponent|${match.team2 || 'TBD'}}}\n`;
      if (result.score1 !== '' && result.score2 !== '') {
        wiki += `    |map1={{Map|map=|score1=${result.score1}|score2=${result.score2}|finished=true}}\n`;
      }
      wiki += `}}\n\n`;
    });
  }

  // Semi Finals
  if (bracketConfig.semiFinals) {
    bracketConfig.semiFinals.forEach((match, idx) => {
      const result = getMatchResult(match.team1, match.team2);
      const matchNum = idx + 1;
      
      wiki += `<!-- Semi-Final ${matchNum} -->\n`;
      wiki += `|R2M${matchNum}={{Match\n`;
      wiki += `    |opponent1={{TeamOpponent|${match.team1 || 'TBD'}}}\n`;
      wiki += `    |opponent2={{TeamOpponent|${match.team2 || 'TBD'}}}\n`;
      if (result.score1 !== '' && result.score2 !== '') {
        wiki += `    |map1={{Map|map=|score1=${result.score1}|score2=${result.score2}|finished=true}}\n`;
      }
      wiki += `}}\n\n`;
    });
  }

  // Final
  if (bracketConfig.final) {
    const result = getMatchResult(bracketConfig.final.team1, bracketConfig.final.team2);
    
    wiki += `<!-- Grand Final -->\n`;
    wiki += `|R3M1={{Match\n`;
    wiki += `    |opponent1={{TeamOpponent|${bracketConfig.final.team1 || 'TBD'}}}\n`;
    wiki += `    |opponent2={{TeamOpponent|${bracketConfig.final.team2 || 'TBD'}}}\n`;
    if (result.score1 !== '' && result.score2 !== '') {
      wiki += `    |map1={{Map|map=|score1=${result.score1}|score2=${result.score2}|finished=true}}\n`;
    }
    wiki += `}}\n`;
  }

  wiki += `}}\n`;

  return wiki;
}

/**
 * Generate simple bracket table (alternative to template)
 */
export function generateSimpleBracketWiki(bracketConfig, seriesSummary) {
  const getMatchResult = (team1, team2) => {
    if (!team1 || !team2) return null;
    
    const sortedTeams = [team1, team2].sort((a, b) => a.localeCompare(b));
    const matchupKey = sortedTeams.join("vs");
    
    if (seriesSummary[matchupKey]) {
      const s = seriesSummary[matchupKey];
      return {
        score1: s.mapWins[team1] || 0,
        score2: s.mapWins[team2] || 0
      };
    }
    return null;
  };

  const formatMatch = (match) => {
    if (!match.team1 && !match.team2) return 'TBD vs TBD';
    
    const result = getMatchResult(match.team1, match.team2);
    const team1 = match.team1 || 'TBD';
    const team2 = match.team2 || 'TBD';
    
    if (result) {
      const winner1 = result.score1 > result.score2;
      const winner2 = result.score2 > result.score1;
      return `${winner1 ? "'''" : ''}{{Team|${team1}}}${winner1 ? "'''" : ''} ${result.score1} - ${result.score2} ${winner2 ? "'''" : ''}{{Team|${team2}}}${winner2 ? "'''" : ''}`;
    }
    return `{{Team|${team1}}} vs {{Team|${team2}}}`;
  };

  let wiki = `{| class="wikitable"\n`;
  wiki += `|-\n`;
  wiki += `! Quarter-Finals !! Semi-Finals !! Grand Final\n`;
  wiki += `|-\n`;
  
  // Row 1: QF1, SF1, Final
  wiki += `| ${formatMatch(bracketConfig.quarterFinals[0])}\n`;
  wiki += `| rowspan="2" | ${formatMatch(bracketConfig.semiFinals[0])}\n`;
  wiki += `| rowspan="4" | ${formatMatch(bracketConfig.final)}\n`;
  wiki += `|-\n`;
  
  // Row 2: QF2
  wiki += `| ${formatMatch(bracketConfig.quarterFinals[1])}\n`;
  wiki += `|-\n`;
  
  // Row 3: QF3, SF2
  wiki += `| ${formatMatch(bracketConfig.quarterFinals[2])}\n`;
  wiki += `| rowspan="2" | ${formatMatch(bracketConfig.semiFinals[1])}\n`;
  wiki += `|-\n`;
  
  // Row 4: QF4
  wiki += `| ${formatMatch(bracketConfig.quarterFinals[3])}\n`;
  wiki += `|}\n`;

  return wiki;
}

/**
 * Generate complete tournament wiki page
 */
export function generateFullTournamentWiki(standings, matches, bracketConfig, seriesSummary, options = {}) {
  const { 
    tournamentName = 'Tournament',
    useSimpleBracket = true 
  } = options;

  let wiki = `== ${tournamentName} ==\n\n`;
  
  // Standings
  wiki += generateStandingsWiki(standings, { showHeader: true });
  wiki += '\n';
  
  // Schedule
  wiki += generateScheduleWiki(matches, { showHeader: true, groupByDate: true });
  wiki += '\n';
  
  // Bracket
  if (useSimpleBracket) {
    wiki += `=== Playoffs ===\n\n`;
    wiki += generateSimpleBracketWiki(bracketConfig, seriesSummary);
  } else {
    wiki += generateBracketWiki(bracketConfig, seriesSummary, { showHeader: true });
  }

  return wiki;
}
