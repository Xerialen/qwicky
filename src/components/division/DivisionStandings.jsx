// src/components/division/DivisionStandings.jsx
import React, { useMemo } from 'react';

function calculateStandings(schedule, division) {
  const pointsWin = division.pointsWin ?? 3;
  const pointsLoss = division.pointsLoss ?? 0;
  const isPlayAll = (division.groupStageType || 'bestof') === 'playall';
  const tieBreakers = division.tieBreakers || ['mapDiff', 'fragDiff', 'headToHead'];

  const standings = {};
  const headToHead = {}; // Track head-to-head results

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
      matchesLost: 0,
      fragsFor: 0,
      fragsAgainst: 0
    };
  });

  const groupMatches = schedule.filter(m => m.round === 'group' && m.maps?.length > 0);

  groupMatches.forEach(match => {
    const { team1, team2, maps, group } = match;

    // Ensure teams exist (in case schedule has teams not in teams list)
    [team1, team2].forEach(team => {
      if (!standings[team]) {
        standings[team] = {
          name: team,
          group: group || 'A',
          played: 0,
          points: 0,
          mapsWon: 0,
          mapsLost: 0,
          matchesWon: 0,
          matchesLost: 0,
          fragsFor: 0,
          fragsAgainst: 0
        };
      }
    });

    // Initialize head-to-head tracking
    const h2hKey = [team1, team2].sort().join('|');
    if (!headToHead[h2hKey]) {
      headToHead[h2hKey] = { [team1]: 0, [team2]: 0 };
    }

    let t1Wins = 0, t2Wins = 0;
    
    // Process each map
    maps.forEach(map => {
      const s1 = map.score1 || 0;
      const s2 = map.score2 || 0;
      
      // Track frags
      standings[team1].fragsFor += s1;
      standings[team1].fragsAgainst += s2;
      standings[team2].fragsFor += s2;
      standings[team2].fragsAgainst += s1;
      
      // Track map wins
      if (s1 > s2) { 
        t1Wins++; 
        standings[team1].mapsWon++; 
        standings[team2].mapsLost++;
        
        // In Play All mode, award points per map
        if (isPlayAll) {
          standings[team1].points += pointsWin;
          standings[team2].points += pointsLoss;
        }
      } else if (s2 > s1) { 
        t2Wins++; 
        standings[team2].mapsWon++; 
        standings[team1].mapsLost++;
        
        if (isPlayAll) {
          standings[team2].points += pointsWin;
          standings[team1].points += pointsLoss;
        }
      }
    });

    // Count the match played
    if (t1Wins > 0 || t2Wins > 0) {
      standings[team1].played++;
      standings[team2].played++;

      // Determine series winner
      if (t1Wins > t2Wins) {
        standings[team1].matchesWon++;
        standings[team2].matchesLost++;
        headToHead[h2hKey][team1]++;
        
        // In Best Of mode, award points per series
        if (!isPlayAll) {
          standings[team1].points += pointsWin;
          standings[team2].points += pointsLoss;
        }
      } else if (t2Wins > t1Wins) {
        standings[team2].matchesWon++;
        standings[team1].matchesLost++;
        headToHead[h2hKey][team2]++;
        
        if (!isPlayAll) {
          standings[team2].points += pointsWin;
          standings[team1].points += pointsLoss;
        }
      }
      // Note: In Quake, no draws are possible
    }
  });

  // Sorting function with configurable tie-breakers
  const compareTeams = (a, b) => {
    // Primary: Points
    if (b.points !== a.points) return b.points - a.points;
    
    // Apply tie-breakers in order
    for (const tieBreaker of tieBreakers) {
      let result = 0;
      
      switch (tieBreaker) {
        case 'mapDiff':
          const diffA = a.mapsWon - a.mapsLost;
          const diffB = b.mapsWon - b.mapsLost;
          result = diffB - diffA;
          break;
          
        case 'fragDiff':
          const fragDiffA = a.fragsFor - a.fragsAgainst;
          const fragDiffB = b.fragsFor - b.fragsAgainst;
          result = fragDiffB - fragDiffA;
          break;
          
        case 'headToHead':
          const h2hKey = [a.name, b.name].sort().join('|');
          const h2h = headToHead[h2hKey];
          if (h2h) {
            result = (h2h[b.name] || 0) - (h2h[a.name] || 0);
          }
          break;
      }
      
      if (result !== 0) return result;
    }
    
    // Final fallback: total maps won
    return b.mapsWon - a.mapsWon;
  };

  const sortedStandings = Object.values(standings).sort(compareTeams);
  
  return { standings: sortedStandings, headToHead, isPlayAll };
}

export default function DivisionStandings({ division }) {
  const schedule = division.schedule || [];
  const { standings, headToHead, isPlayAll } = useMemo(
    () => calculateStandings(schedule, division), 
    [schedule, division]
  );

  const standingsByGroup = useMemo(() => {
    const groups = {};
    standings.forEach(team => {
      const g = team.group || 'A';
      if (!groups[g]) groups[g] = [];
      groups[g].push(team);
    });
    return groups;
  }, [standings]);

  const hasResults = schedule.some(m => m.maps?.length > 0);
  const tieBreakers = division.tieBreakers || ['mapDiff', 'fragDiff', 'headToHead'];
  const tieBreakerLabels = {
    mapDiff: 'Map Diff',
    fragDiff: 'Frag Diff',
    headToHead: 'H2H'
  };

  // Show empty message only if there are NO teams at all
  if (standings.length === 0) {
    return (
      <div className="qw-panel p-12 text-center">
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="font-display text-2xl text-white mb-2">No Teams Yet</h2>
        <p className="text-qw-muted">Add teams to the division to see standings</p>
      </div>
    );
  }

  const numGroups = Object.keys(standingsByGroup).length;

  return (
    <div className="space-y-6">
      <div className={`grid gap-6 ${numGroups > 1 ? 'md:grid-cols-2' : ''}`}>
        {Object.entries(standingsByGroup).sort().map(([groupName, groupStandings]) => (
          <div key={groupName} className="qw-panel overflow-hidden">
            <div className="bg-qw-dark px-4 py-2 border-b border-qw-border">
              <h3 className="font-display font-bold text-qw-accent">Group {groupName}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-qw-dark/50 text-xs">
                    <th className="text-center w-10 py-2">#</th>
                    <th className="text-left py-2">Team</th>
                    <th className="text-center w-8 py-2">P</th>
                    <th className="text-center w-8 py-2">W</th>
                    <th className="text-center w-8 py-2">L</th>
                    <th className="text-center w-14 py-2">Maps</th>
                    <th className="text-center w-10 py-2" title="Map Difference">M±</th>
                    <th className="text-center w-16 py-2">Frags</th>
                    <th className="text-center w-10 py-2" title="Frag Difference">F±</th>
                    <th className="text-center w-10 py-2">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {groupStandings.map((team, idx) => {
                    const mapDiff = team.mapsWon - team.mapsLost;
                    const fragDiff = team.fragsFor - team.fragsAgainst;
                    const advances = idx < (division.advanceCount || 2);
                    return (
                      <tr key={team.name} className={`border-b border-qw-border/50 ${advances ? 'bg-qw-win/10' : ''} hover:bg-qw-accent/5`}>
                        <td className="text-center py-2">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-display font-bold ${idx === 0 ? 'bg-qw-accent text-qw-dark' : advances ? 'bg-qw-win/30 text-qw-win' : 'bg-qw-border text-qw-muted'}`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-2">
                          <span className={`font-body font-semibold ${idx === 0 ? 'text-qw-accent' : 'text-white'}`}>
                            {team.name}
                          </span>
                        </td>
                        <td className="text-center text-qw-muted text-sm">{team.played}</td>
                        <td className="text-center text-qw-win text-sm font-semibold">{team.matchesWon}</td>
                        <td className="text-center text-qw-loss text-sm">{team.matchesLost}</td>
                        <td className="text-center font-mono text-sm">
                          <span className="text-qw-win">{team.mapsWon}</span>
                          <span className="text-qw-muted">-</span>
                          <span className="text-qw-loss">{team.mapsLost}</span>
                        </td>
                        <td className="text-center font-mono text-sm font-semibold">
                          <span className={mapDiff > 0 ? 'text-qw-win' : mapDiff < 0 ? 'text-qw-loss' : 'text-qw-muted'}>
                            {mapDiff > 0 ? '+' : ''}{mapDiff}
                          </span>
                        </td>
                        <td className="text-center font-mono text-xs">
                          <span className="text-qw-win">{team.fragsFor}</span>
                          <span className="text-qw-muted">-</span>
                          <span className="text-qw-loss">{team.fragsAgainst}</span>
                        </td>
                        <td className="text-center font-mono text-xs font-semibold">
                          <span className={fragDiff > 0 ? 'text-qw-win' : fragDiff < 0 ? 'text-qw-loss' : 'text-qw-muted'}>
                            {fragDiff > 0 ? '+' : ''}{fragDiff}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className={`font-display font-bold ${idx === 0 ? 'text-qw-accent' : 'text-white'}`}>
                            {team.points}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-qw-win/30"></span>
          <span className="text-qw-muted">Advances to playoffs</span>
        </div>
        {isPlayAll ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-qw-muted">Map Win = {division.pointsWin} pts</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-qw-muted">Map Loss = {division.pointsLoss} pts</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="font-display text-qw-win">W</span>
              <span className="text-qw-muted">= {division.pointsWin} pts</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-display text-qw-loss">L</span>
              <span className="text-qw-muted">= {division.pointsLoss} pts</span>
            </div>
          </>
        )}
      </div>
      
      {/* Tie-breaker info */}
      <div className="text-center text-xs text-qw-muted">
        Tie-breakers: {tieBreakers.map(tb => tieBreakerLabels[tb] || tb).join(' → ')}
      </div>
    </div>
  );
}
