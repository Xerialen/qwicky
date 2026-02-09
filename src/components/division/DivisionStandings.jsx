// src/components/division/DivisionStandings.jsx
import React, { useMemo } from 'react';
import EmptyState from '../EmptyState';

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

// Helper function to get tier color class
function getTierColorClass(tierId) {
  const tierColors = {
    gold: 'bg-amber-500/20',
    silver: 'bg-gray-300/20',
    bronze: 'bg-orange-700/20',
    copper: 'bg-orange-900/20',
    iron: 'bg-gray-500/20',
    wood: 'bg-amber-900/30',
    stone: 'bg-gray-600/20'
  };
  return tierColors[tierId] || 'bg-qw-win/10';
}

// Helper function to get tier badge color
function getTierBadgeColor(tierId) {
  const tierBadgeColors = {
    gold: 'bg-amber-500/40 text-amber-200',
    silver: 'bg-gray-300/40 text-gray-200',
    bronze: 'bg-orange-700/40 text-orange-200',
    copper: 'bg-orange-900/40 text-orange-300',
    iron: 'bg-gray-500/40 text-gray-300',
    wood: 'bg-amber-900/50 text-amber-300',
    stone: 'bg-gray-600/40 text-gray-300'
  };
  return tierBadgeColors[tierId] || 'bg-qw-win/30 text-qw-win';
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

  // Show empty state if no teams exist
  if (standings.length === 0) {
    return (
      <EmptyState
        icon="🏆"
        title="No teams yet"
        description="Add teams to the division first, then generate a schedule. Standings will calculate automatically as results are imported."
      />
    );
  }

  // Show empty state if no schedule exists
  if (schedule.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="No matches scheduled yet"
        description="Generate a schedule first, then import results. Standings will calculate automatically."
      />
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
                    const position = idx + 1;

                    // Determine if team advances and which tier (for multi-tier)
                    let advances = false;
                    let tier = null;
                    let rowBgClass = '';
                    let badgeClass = '';

                    if (division.format === 'multi-tier' && division.playoffTiers) {
                      tier = getTierForPosition(position, division.playoffTiers);
                      if (tier) {
                        advances = true;
                        rowBgClass = getTierColorClass(tier.id);
                        badgeClass = getTierBadgeColor(tier.id);
                      }
                    } else {
                      advances = idx < (division.advanceCount || 2);
                      if (advances) {
                        rowBgClass = 'bg-qw-win/10';
                        badgeClass = 'bg-qw-win/30 text-qw-win';
                      }
                    }

                    // First place always gets the accent color
                    if (idx === 0) {
                      badgeClass = 'bg-qw-accent text-qw-dark';
                    } else if (!advances) {
                      badgeClass = 'bg-qw-border text-qw-muted';
                    }

                    return (
                      <tr key={team.name} className={`border-b border-qw-border/50 ${rowBgClass} hover:bg-qw-accent/5`}>
                        <td className="text-center py-2">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-display font-bold ${badgeClass}`}>
                            {position}
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
        {division.format === 'multi-tier' && division.playoffTiers ? (
          // Show tier-specific legend
          division.playoffTiers.map(tier => {
            const colorClass = getTierColorClass(tier.id);
            return (
              <div key={tier.id} className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded ${colorClass}`}></span>
                <span className="text-qw-muted">{tier.name} ({tier.positions})</span>
              </div>
            );
          })
        ) : (
          // Show standard advancement legend
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-qw-win/30"></span>
            <span className="text-qw-muted">Advances to playoffs</span>
          </div>
        )}
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
