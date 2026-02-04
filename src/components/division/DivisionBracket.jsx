// src/components/division/DivisionBracket.jsx
import React, { useMemo } from 'react';
import { createDefaultBracket } from '../../App';

function BracketMatch({ match, schedule, onUpdateTeam, label, showLabel = false, isFinal = false, isGrandFinal = false }) {
  const result = useMemo(() => {
    if (!match?.team1 || !match?.team2) return null;
    
    const t1Lower = match.team1.toLowerCase();
    const t2Lower = match.team2.toLowerCase();
    const scheduled = schedule.find(m =>
      (m.team1.toLowerCase() === t1Lower && m.team2.toLowerCase() === t2Lower) ||
      (m.team1.toLowerCase() === t2Lower && m.team2.toLowerCase() === t1Lower)
    );

    if (!scheduled?.maps?.length) return null;

    let s1 = 0, s2 = 0;
    scheduled.maps.forEach(m => {
      const isNormal = scheduled.team1.toLowerCase() === t1Lower;
      if (isNormal) {
        if (m.score1 > m.score2) s1++; else if (m.score2 > m.score1) s2++;
      } else {
        if (m.score2 > m.score1) s1++; else if (m.score1 > m.score2) s2++;
      }
    });
    return { s1, s2 };
  }, [match, schedule]);

  const hasResult = result && (result.s1 > 0 || result.s2 > 0);
  const winner = hasResult ? (result.s1 > result.s2 ? match?.team1 : result.s2 > result.s1 ? match?.team2 : null) : null;

  if (!match) return <div className="w-48 h-16 bg-qw-dark/30 rounded border border-qw-border/30" />;

  return (
    <div className={`w-48 overflow-hidden rounded ${isGrandFinal ? 'ring-2 ring-qw-accent' : ''}`}>
      {showLabel && label && (
        <div className="bg-qw-darker px-2 py-1 text-xs text-qw-muted text-center border-b border-qw-border">{label}</div>
      )}
      <div className={`flex items-center justify-between px-3 py-2 border border-qw-border ${winner === match.team1 ? 'bg-qw-win/20' : 'bg-qw-panel'} ${winner && winner !== match.team1 ? 'opacity-50' : ''}`}>
        <input type="text" value={match.team1 || ''} onChange={(e) => onUpdateTeam(match.id, 'team1', e.target.value)} placeholder="Team 1" className="bg-transparent border-none outline-none font-body font-semibold text-white w-28 placeholder:text-qw-muted/50 text-sm" />
        {hasResult && <span className={`font-mono font-bold ${result.s1 > result.s2 ? 'text-qw-win' : 'text-white'}`}>{result.s1}</span>}
      </div>
      <div className={`flex items-center justify-between px-3 py-2 border border-t-0 border-qw-border ${winner === match.team2 ? 'bg-qw-win/20' : 'bg-qw-panel'} ${winner && winner !== match.team2 ? 'opacity-50' : ''}`}>
        <input type="text" value={match.team2 || ''} onChange={(e) => onUpdateTeam(match.id, 'team2', e.target.value)} placeholder="Team 2" className="bg-transparent border-none outline-none font-body font-semibold text-white w-28 placeholder:text-qw-muted/50 text-sm" />
        {hasResult && <span className={`font-mono font-bold ${result.s2 > result.s1 ? 'text-qw-win' : 'text-white'}`}>{result.s2}</span>}
      </div>
      {isFinal && <div className="text-center text-2xl py-1">🏆</div>}
    </div>
  );
}

function SingleElimBracket({ bracket, schedule, onUpdateTeam, teamCount }) {
  const hasR32 = teamCount >= 32 && bracket.winners?.round32;
  const hasR16 = teamCount >= 16 && bracket.winners?.round16;
  const hasQF = teamCount >= 8 && bracket.winners?.quarterFinals;
  
  return (
    <div className="flex items-start gap-6 min-w-fit">
      {/* Round of 32 */}
      {hasR32 && (
        <>
          <div className="flex flex-col gap-4">
            <div className="text-center font-display text-sm text-qw-accent mb-2">ROUND OF 32</div>
            <div className="flex flex-col gap-4">
              {bracket.winners.round32.map((match, idx) => (
                <BracketMatch key={match.id} match={match} schedule={schedule} onUpdateTeam={onUpdateTeam} />
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-around h-full py-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="w-6 h-16 flex flex-col">
                <div className="flex-1 border-b-2 border-r-2 border-qw-border rounded-br" />
                <div className="flex-1 border-t-2 border-r-2 border-qw-border rounded-tr" />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Round of 16 */}
      {hasR16 && (
        <>
          <div className="flex flex-col gap-4">
            <div className="text-center font-display text-sm text-qw-accent mb-2">ROUND OF 16</div>
            <div className="flex flex-col gap-8" style={{ paddingTop: hasR32 ? '20px' : '0' }}>
              {bracket.winners.round16.map((match, idx) => (
                <BracketMatch key={match.id} match={match} schedule={schedule} onUpdateTeam={onUpdateTeam} />
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-around h-full" style={{ paddingTop: hasR32 ? '32px' : '16px' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-6 h-32 flex flex-col">
                <div className="flex-1 border-b-2 border-r-2 border-qw-border rounded-br" />
                <div className="flex-1 border-t-2 border-r-2 border-qw-border rounded-tr" />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Quarter Finals */}
      {hasQF && (
        <>
          <div className="flex flex-col gap-4">
            <div className="text-center font-display text-sm text-qw-accent mb-2">QUARTER FINALS</div>
            <div className="flex flex-col gap-8" style={{ paddingTop: hasR16 ? '52px' : '0' }}>
              {bracket.winners.quarterFinals.map((match, idx) => (
                <BracketMatch key={match.id} match={match} schedule={schedule} onUpdateTeam={onUpdateTeam} />
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-around h-full py-16" style={{ paddingTop: hasR16 ? '64px' : '0' }}>
            {[0, 1].map(i => (
              <div key={i} className="w-6 h-24 flex flex-col">
                <div className="flex-1 border-b-2 border-r-2 border-qw-border rounded-br" />
                <div className="flex-1 border-t-2 border-r-2 border-qw-border rounded-tr" />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Semi Finals */}
      <div className="flex flex-col gap-4">
        <div className="text-center font-display text-sm text-qw-accent mb-2">SEMI FINALS</div>
        <div className="flex flex-col" style={{ 
          gap: hasQF ? '100px' : '40px', 
          paddingTop: hasR16 ? '180px' : hasQF ? '52px' : '0' 
        }}>
          {bracket.winners?.semiFinals?.map((match, idx) => (
            <BracketMatch key={match.id} match={match} schedule={schedule} onUpdateTeam={onUpdateTeam} />
          ))}
        </div>
      </div>

      {/* Connector */}
      <div className="flex items-center" style={{ 
        height: hasR16 ? '640px' : hasQF ? '320px' : '140px', 
        paddingTop: hasR16 ? '168px' : hasQF ? '40px' : '0' 
      }}>
        <div className="w-6 h-full flex flex-col">
          <div className="flex-1 border-b-2 border-r-2 border-qw-border rounded-br" />
          <div className="flex-1 border-t-2 border-r-2 border-qw-border rounded-tr" />
        </div>
      </div>

      {/* Final */}
      <div className="flex flex-col gap-4">
        <div className="text-center font-display text-sm text-qw-accent mb-2">FINAL</div>
        <div className="flex items-center" style={{ 
          height: hasR16 ? '640px' : hasQF ? '320px' : '140px', 
          paddingTop: hasR16 ? '168px' : hasQF ? '40px' : '0' 
        }}>
          <BracketMatch match={bracket.winners?.final} schedule={schedule} onUpdateTeam={onUpdateTeam} isFinal={true} />
        </div>
      </div>
    </div>
  );
}

function DoubleElimBracket({ bracket, schedule, onUpdateTeam, teamCount, bracketResetEnabled }) {
  const hasR32 = teamCount >= 32;
  const hasR16 = teamCount >= 16;
  const hasQF = teamCount >= 8;
  
  return (
    <div className="space-y-8">
      {/* Winners Bracket */}
      <div>
        <h4 className="font-display text-lg text-qw-win mb-4 flex items-center gap-2">
          <span>🏆</span> WINNERS BRACKET
        </h4>
        <div className="overflow-x-auto pb-4">
          <div className="flex items-start gap-6 min-w-fit">
            {/* W-R32 */}
            {hasR32 && bracket.winners?.round32 && (
              <>
                <div className="flex flex-col gap-4">
                  <div className="text-center text-xs text-qw-muted mb-1">W-R32</div>
                  <div className="flex flex-col gap-4">
                    {bracket.winners.round32.map((match) => (
                      <BracketMatch key={match.id} match={match} schedule={schedule} onUpdateTeam={onUpdateTeam} />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col justify-around h-full py-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="w-4 h-16 flex flex-col">
                      <div className="flex-1 border-b-2 border-r-2 border-qw-win/50 rounded-br" />
                      <div className="flex-1 border-t-2 border-r-2 border-qw-win/50 rounded-tr" />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* W-R16 */}
            {hasR16 && bracket.winners?.round16 && (
              <>
                <div className="flex flex-col gap-4">
                  <div className="text-center text-xs text-qw-muted mb-1">W-R16</div>
                  <div className="flex flex-col gap-6" style={{ paddingTop: hasR32 ? '16px' : '0' }}>
                    {bracket.winners.round16.map((match) => (
                      <BracketMatch key={match.id} match={match} schedule={schedule} onUpdateTeam={onUpdateTeam} />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col justify-around h-full" style={{ paddingTop: hasR32 ? '24px' : '8px' }}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="w-4 h-24 flex flex-col">
                      <div className="flex-1 border-b-2 border-r-2 border-qw-win/50 rounded-br" />
                      <div className="flex-1 border-t-2 border-r-2 border-qw-win/50 rounded-tr" />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* W-QF */}
            {hasQF && bracket.winners?.quarterFinals && (
              <>
                <div className="flex flex-col gap-4">
                  <div className="text-center text-xs text-qw-muted mb-1">W-QF</div>
                  <div className="flex flex-col gap-6" style={{ paddingTop: hasR16 ? '36px' : '0' }}>
                    {bracket.winners.quarterFinals.map((match) => (
                      <BracketMatch key={match.id} match={match} schedule={schedule} onUpdateTeam={onUpdateTeam} />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col justify-around h-64 py-8" style={{ paddingTop: hasR16 ? '44px' : '0' }}>
                  {[0, 1].map(i => (
                    <div key={i} className="w-4 h-16 flex flex-col">
                      <div className="flex-1 border-b-2 border-r-2 border-qw-win/50 rounded-br" />
                      <div className="flex-1 border-t-2 border-r-2 border-qw-win/50 rounded-tr" />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* W-SF */}
            <div className="flex flex-col gap-4">
              <div className="text-center text-xs text-qw-muted mb-1">W-SF</div>
              <div className="flex flex-col gap-12" style={{ 
                paddingTop: hasR16 ? '124px' : hasQF ? '36px' : '0' 
              }}>
                {bracket.winners?.semiFinals?.map((match) => (
                  <BracketMatch key={match.id} match={match} schedule={schedule} onUpdateTeam={onUpdateTeam} />
                ))}
              </div>
            </div>

            <div className="flex items-center h-48" style={{ paddingTop: hasQF ? '36px' : '0' }}>
              <div className="w-4 h-24 flex flex-col">
                <div className="flex-1 border-b-2 border-r-2 border-qw-win/50 rounded-br" />
                <div className="flex-1 border-t-2 border-r-2 border-qw-win/50 rounded-tr" />
              </div>
            </div>

            {/* W-Final */}
            <div className="flex flex-col gap-4">
              <div className="text-center text-xs text-qw-muted mb-1">W-FINAL</div>
              <div style={{ paddingTop: hasQF ? '68px' : '32px' }}>
                <BracketMatch match={bracket.winners?.final} schedule={schedule} onUpdateTeam={onUpdateTeam} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Losers Bracket */}
      <div>
        <h4 className="font-display text-lg text-qw-loss mb-4 flex items-center gap-2">
          <span>💀</span> LOSERS BRACKET
        </h4>
        <div className="overflow-x-auto pb-4">
          <div className="flex items-start gap-6 min-w-fit">
            {/* L-R1 */}
            {bracket.losers?.round1 && (
              <>
                <div className="flex flex-col gap-4">
                  <div className="text-center text-xs text-qw-muted mb-1">L-R1</div>
                  <div className="flex flex-col gap-6">
                    {bracket.losers.round1.map((match) => (
                      <BracketMatch key={match.id} match={match} schedule={schedule} onUpdateTeam={onUpdateTeam} />
                    ))}
                  </div>
                </div>
                <div className="flex items-center h-32 pt-6">
                  <div className="w-4 border-t-2 border-qw-loss/50" />
                </div>
              </>
            )}

            {/* L-R2 (only for 8 teams) */}
            {hasQF && bracket.losers?.round2 && (
              <>
                <div className="flex flex-col gap-4">
                  <div className="text-center text-xs text-qw-muted mb-1">L-R2</div>
                  <div className="flex flex-col gap-6">
                    {bracket.losers.round2.map((match) => (
                      <BracketMatch key={match.id} match={match} schedule={schedule} onUpdateTeam={onUpdateTeam} />
                    ))}
                  </div>
                </div>
                <div className="flex items-center h-32 pt-6">
                  <div className="w-4 h-16 flex flex-col">
                    <div className="flex-1 border-b-2 border-r-2 border-qw-loss/50 rounded-br" />
                    <div className="flex-1 border-t-2 border-r-2 border-qw-loss/50 rounded-tr" />
                  </div>
                </div>
              </>
            )}

            {/* L-R3 (only for 8 teams) */}
            {hasQF && bracket.losers?.round3 && (
              <>
                <div className="flex flex-col gap-4">
                  <div className="text-center text-xs text-qw-muted mb-1">L-R3</div>
                  <div className="pt-8">
                    {bracket.losers.round3.map((match) => (
                      <BracketMatch key={match.id} match={match} schedule={schedule} onUpdateTeam={onUpdateTeam} />
                    ))}
                  </div>
                </div>
                <div className="flex items-center h-24 pt-8">
                  <div className="w-4 border-t-2 border-qw-loss/50" />
                </div>
              </>
            )}

            {/* L-Final */}
            {bracket.losers?.final && (
              <div className="flex flex-col gap-4">
                <div className="text-center text-xs text-qw-muted mb-1">L-FINAL</div>
                <div className="pt-8">
                  <BracketMatch match={bracket.losers.final} schedule={schedule} onUpdateTeam={onUpdateTeam} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grand Final */}
      <div>
        <h4 className="font-display text-lg text-qw-accent mb-4 flex items-center gap-2">
          <span>👑</span> GRAND FINAL
        </h4>
        <div className="flex items-start gap-6">
          <div className="flex flex-col gap-2">
            <div className="text-center text-xs text-qw-muted">Grand Final</div>
            <BracketMatch match={bracket.grandFinal} schedule={schedule} onUpdateTeam={onUpdateTeam} isGrandFinal={true} />
            <div className="text-center text-xs text-qw-muted mt-1">
              Winners bracket team has advantage
            </div>
          </div>
          
          {bracketResetEnabled && (
            <>
              <div className="flex items-center pt-8">
                <div className="w-6 border-t-2 border-dashed border-qw-accent/50" />
              </div>
              <div className="flex flex-col gap-2">
                <div className="text-center text-xs text-qw-muted">Reset (if needed)</div>
                <BracketMatch 
                  match={bracket.bracketReset} 
                  schedule={schedule} 
                  onUpdateTeam={onUpdateTeam}
                  showLabel={true}
                  label="Only if losers bracket winner wins GF"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Multi-tier bracket component
function MultiTierBracketView({ tiers, schedule, onUpdateTierTeam }) {
  if (!tiers || tiers.length === 0) {
    return (
      <div className="text-center py-8 text-qw-muted">
        No playoff tiers configured. Go to Setup to add tiers.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {tiers.map((tier, tierIndex) => {
        const tierBracket = tier.bracket || {};
        const tierIsDoubleElim = tier.type === 'double';
        const tierTeamCount = tier.teams || 4;

        const handleUpdateTeam = (matchId, slot, value) => {
          onUpdateTierTeam(tier.id, matchId, slot, value);
        };

        return (
          <div key={tier.id} className="qw-panel p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">
                {tier.id === 'gold' ? '🥇' : tier.id === 'silver' ? '🥈' : tier.id === 'bronze' ? '🥉' : '🏅'}
              </span>
              <div>
                <h3 className="font-display text-lg text-qw-accent">{tier.name}</h3>
                <p className="text-xs text-qw-muted">Positions {tier.positions} • {tierTeamCount} teams • {tierIsDoubleElim ? 'Double' : 'Single'} Elimination</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              {tierIsDoubleElim ? (
                <DoubleElimBracket
                  bracket={tierBracket}
                  schedule={schedule}
                  onUpdateTeam={handleUpdateTeam}
                  teamCount={tierTeamCount}
                  bracketResetEnabled={tier.bracketReset !== false}
                />
              ) : (
                <SingleElimBracket
                  bracket={tierBracket}
                  schedule={schedule}
                  onUpdateTeam={handleUpdateTeam}
                  teamCount={tierTeamCount}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DivisionBracket({ division, updateDivision }) {
  const schedule = division.schedule || [];
  const bracket = division.bracket || {};
  const isMultiTier = division.format === 'multi-tier';
  const isDoubleElim = bracket.format === 'double' || (division.playoffFormat === 'double');
  const teamCount = bracket.teamCount || division.playoffTeams || 4;

  const handleUpdateTeam = (matchId, slot, value) => {
    const newBracket = JSON.parse(JSON.stringify(bracket)); // Deep clone
    
    // Search in winners bracket
    if (newBracket.winners) {
      ['round32', 'round16', 'round12', 'quarterFinals', 'semiFinals'].forEach(round => {
        if (newBracket.winners[round]) {
          const idx = newBracket.winners[round].findIndex(m => m.id === matchId);
          if (idx !== -1) {
            newBracket.winners[round][idx][slot] = value;
          }
        }
      });
      if (newBracket.winners.final?.id === matchId) {
        newBracket.winners.final[slot] = value;
      }
    }
    
    // Search in losers bracket
    if (newBracket.losers) {
      ['round1', 'round2', 'round3', 'round4', 'round5', 'round6'].forEach(round => {
        if (newBracket.losers[round]) {
          const idx = newBracket.losers[round].findIndex(m => m.id === matchId);
          if (idx !== -1) {
            newBracket.losers[round][idx][slot] = value;
          }
        }
      });
      if (newBracket.losers.final?.id === matchId) {
        newBracket.losers.final[slot] = value;
      }
    }
    
    // Grand final and reset
    if (newBracket.grandFinal?.id === matchId) {
      newBracket.grandFinal[slot] = value;
    }
    if (newBracket.bracketReset?.id === matchId) {
      newBracket.bracketReset[slot] = value;
    }
    
    // Third place (single elim)
    if (newBracket.thirdPlace?.id === matchId) {
      newBracket.thirdPlace[slot] = value;
    }
    
    // Legacy format support
    if (newBracket.quarterFinals) {
      const idx = newBracket.quarterFinals.findIndex(m => m.id === matchId);
      if (idx !== -1) newBracket.quarterFinals[idx][slot] = value;
    }
    if (newBracket.semiFinals) {
      const idx = newBracket.semiFinals.findIndex(m => m.id === matchId);
      if (idx !== -1) newBracket.semiFinals[idx][slot] = value;
    }
    if (newBracket.final?.id === matchId) {
      newBracket.final[slot] = value;
    }

    updateDivision({ bracket: newBracket });
  };

  const handleReset = () => {
    if (isMultiTier) {
      if (window.confirm('Reset all tier brackets? All team entries will be cleared.')) {
        const updatedTiers = (division.playoffTiers || []).map(tier => ({
          ...tier,
          bracket: createDefaultBracket(tier.type || 'single', tier.teams || 4)
        }));
        updateDivision({ playoffTiers: updatedTiers });
      }
    } else {
      if (window.confirm('Reset entire bracket? All team entries will be cleared.')) {
        const format = division.playoffFormat || 'single';
        const teams = division.playoffTeams || 4;
        updateDivision({ bracket: createDefaultBracket(format, teams) });
      }
    }
  };

  // Handler for updating team names in multi-tier brackets
  const handleUpdateTierTeam = (tierId, matchId, slot, value) => {
    const tiers = division.playoffTiers || [];
    const updatedTiers = tiers.map(tier => {
      if (tier.id !== tierId) return tier;

      const newBracket = JSON.parse(JSON.stringify(tier.bracket || {}));

      // Search in winners bracket
      if (newBracket.winners) {
        ['round32', 'round16', 'round12', 'quarterFinals', 'semiFinals'].forEach(round => {
          if (newBracket.winners[round]) {
            const idx = newBracket.winners[round].findIndex(m => m.id === matchId);
            if (idx !== -1) {
              newBracket.winners[round][idx][slot] = value;
            }
          }
        });
        if (newBracket.winners.final?.id === matchId) {
          newBracket.winners.final[slot] = value;
        }
      }

      // Search in losers bracket
      if (newBracket.losers) {
        ['round1', 'round2', 'round3', 'round4', 'round5', 'round6'].forEach(round => {
          if (newBracket.losers[round]) {
            const idx = newBracket.losers[round].findIndex(m => m.id === matchId);
            if (idx !== -1) {
              newBracket.losers[round][idx][slot] = value;
            }
          }
        });
        if (newBracket.losers.final?.id === matchId) {
          newBracket.losers.final[slot] = value;
        }
      }

      // Grand final and reset
      if (newBracket.grandFinal?.id === matchId) {
        newBracket.grandFinal[slot] = value;
      }
      if (newBracket.bracketReset?.id === matchId) {
        newBracket.bracketReset[slot] = value;
      }

      // Third place (single elim)
      if (newBracket.thirdPlace?.id === matchId) {
        newBracket.thirdPlace[slot] = value;
      }

      return { ...tier, bracket: newBracket };
    });

    updateDivision({ playoffTiers: updatedTiers });
  };

  // Check if using legacy bracket format
  const isLegacyFormat = bracket.quarterFinals && !bracket.winners;

  // Multi-tier format view
  if (isMultiTier) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-qw-muted text-sm">
              Multi-Tier Playoffs • {(division.playoffTiers || []).length} tiers
            </p>
            <p className="text-qw-muted text-xs mt-1">Enter team names. Scores auto-update from playoff matches.</p>
          </div>
          <button onClick={handleReset} className="text-sm text-red-400 hover:text-red-300">Reset All Brackets</button>
        </div>

        <MultiTierBracketView
          tiers={division.playoffTiers || []}
          schedule={schedule}
          onUpdateTierTeam={handleUpdateTierTeam}
        />

        {/* Show playoff matches from all tiers */}
        {schedule.filter(m => m.round !== 'group' && m.maps?.length > 0).length > 0 && (
          <div className="qw-panel p-4">
            <h3 className="font-display text-sm text-qw-accent mb-2">PLAYOFF RESULTS</h3>
            <div className="flex flex-wrap gap-2">
              {schedule.filter(m => m.round !== 'group' && m.maps?.length > 0).map(m => {
                let s1 = 0, s2 = 0;
                m.maps.forEach(map => { if (map.score1 > map.score2) s1++; else if (map.score2 > map.score1) s2++; });
                return (
                  <span key={m.id} className="px-2 py-1 bg-qw-dark rounded text-xs font-mono text-qw-muted">
                    {m.team1} <span className={s1 > s2 ? 'text-qw-win' : ''}>{s1}</span>-<span className={s2 > s1 ? 'text-qw-win' : ''}>{s2}</span> {m.team2}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Standard single/double elimination view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-qw-muted text-sm">
            {isDoubleElim ? 'Double Elimination' : 'Single Elimination'} • {teamCount} teams
          </p>
          <p className="text-qw-muted text-xs mt-1">Enter team names. Scores auto-update from playoff matches.</p>
        </div>
        <button onClick={handleReset} className="text-sm text-red-400 hover:text-red-300">Reset Bracket</button>
      </div>

      <div className="qw-panel p-6 overflow-x-auto">
        {isLegacyFormat ? (
          // Render legacy single elim format
          <SingleElimBracket
            bracket={{ winners: { quarterFinals: bracket.quarterFinals, semiFinals: bracket.semiFinals, final: bracket.final } }}
            schedule={schedule}
            onUpdateTeam={handleUpdateTeam}
            teamCount={8}
          />
        ) : isDoubleElim ? (
          <DoubleElimBracket
            bracket={bracket}
            schedule={schedule}
            onUpdateTeam={handleUpdateTeam}
            teamCount={teamCount}
            bracketResetEnabled={division.playoffBracketReset !== false}
          />
        ) : (
          <SingleElimBracket
            bracket={bracket}
            schedule={schedule}
            onUpdateTeam={handleUpdateTeam}
            teamCount={teamCount}
          />
        )}
      </div>

      {/* Show playoff matches */}
      {schedule.filter(m => m.round !== 'group' && m.maps?.length > 0).length > 0 && (
        <div className="qw-panel p-4">
          <h3 className="font-display text-sm text-qw-accent mb-2">PLAYOFF RESULTS</h3>
          <div className="flex flex-wrap gap-2">
            {schedule.filter(m => m.round !== 'group' && m.maps?.length > 0).map(m => {
              let s1 = 0, s2 = 0;
              m.maps.forEach(map => { if (map.score1 > map.score2) s1++; else if (map.score2 > map.score1) s2++; });
              return (
                <span key={m.id} className="px-2 py-1 bg-qw-dark rounded text-xs font-mono text-qw-muted">
                  {m.team1} <span className={s1 > s2 ? 'text-qw-win' : ''}>{s1}</span>-<span className={s2 > s1 ? 'text-qw-win' : ''}>{s2}</span> {m.team2}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
