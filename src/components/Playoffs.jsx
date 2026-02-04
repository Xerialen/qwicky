// src/components/Playoffs.jsx
import React, { useMemo } from 'react';
import { getSeriesSummary, findBracketMatch } from '../utils/matchLogic';

const DEFAULT_BRACKET = {
  quarterFinals: [
    { id: 'qf1', team1: '', team2: '' },
    { id: 'qf2', team1: '', team2: '' },
    { id: 'qf3', team1: '', team2: '' },
    { id: 'qf4', team1: '', team2: '' },
  ],
  semiFinals: [
    { id: 'sf1', team1: '', team2: '' },
    { id: 'sf2', team1: '', team2: '' },
  ],
  final: { id: 'final', team1: '', team2: '' },
};

function BracketMatch({ match, seriesSummary, onUpdateTeam }) {
  const result = match.team1 && match.team2 
    ? findBracketMatch(match.team1, match.team2, seriesSummary)
    : null;

  const score1 = result?.team1Score || 0;
  const score2 = result?.team2Score || 0;
  const hasResult = result && (score1 > 0 || score2 > 0);
  const winner = hasResult ? (score1 > score2 ? match.team1 : score2 > score1 ? match.team2 : null) : null;

  return (
    <div className="qw-panel w-64 overflow-hidden">
      {/* Team 1 */}
      <div className={`
        flex items-center justify-between px-3 py-2 border-b border-qw-border
        ${winner === match.team1 ? 'bg-qw-win/20' : ''}
        ${winner && winner !== match.team1 ? 'opacity-50' : ''}
      `}>
        <input
          type="text"
          value={match.team1}
          onChange={(e) => onUpdateTeam(match.id, 'team1', e.target.value)}
          placeholder="Team 1"
          className="bg-transparent border-none outline-none font-body font-semibold text-white w-36 placeholder:text-qw-muted/50"
        />
        {hasResult && (
          <span className={`font-mono font-bold text-lg w-8 text-center
            ${score1 > score2 ? 'text-qw-win' : score1 < score2 ? 'text-qw-loss' : 'text-white'}
          `}>
            {score1}
          </span>
        )}
      </div>

      {/* Team 2 */}
      <div className={`
        flex items-center justify-between px-3 py-2
        ${winner === match.team2 ? 'bg-qw-win/20' : ''}
        ${winner && winner !== match.team2 ? 'opacity-50' : ''}
      `}>
        <input
          type="text"
          value={match.team2}
          onChange={(e) => onUpdateTeam(match.id, 'team2', e.target.value)}
          placeholder="Team 2"
          className="bg-transparent border-none outline-none font-body font-semibold text-white w-36 placeholder:text-qw-muted/50"
        />
        {hasResult && (
          <span className={`font-mono font-bold text-lg w-8 text-center
            ${score2 > score1 ? 'text-qw-win' : score2 < score1 ? 'text-qw-loss' : 'text-white'}
          `}>
            {score2}
          </span>
        )}
      </div>
    </div>
  );
}

function BracketConnector({ type }) {
  if (type === 'right') {
    return (
      <div className="w-8 flex flex-col">
        <div className="flex-1 border-b-2 border-r-2 border-qw-border rounded-br"></div>
        <div className="flex-1 border-t-2 border-r-2 border-qw-border rounded-tr"></div>
      </div>
    );
  }
  if (type === 'left') {
    return (
      <div className="w-8 flex flex-col">
        <div className="flex-1 border-b-2 border-l-2 border-qw-border rounded-bl"></div>
        <div className="flex-1 border-t-2 border-l-2 border-qw-border rounded-tl"></div>
      </div>
    );
  }
  return <div className="w-8 border-t-2 border-qw-border"></div>;
}

export default function Playoffs({ matches, bracketConfig, setBracketConfig }) {
  const seriesSummary = useMemo(() => {
    return getSeriesSummary(matches);
  }, [matches]);

  const handleUpdateTeam = (matchId, teamSlot, value) => {
    setBracketConfig(prev => {
      const updated = { ...prev };
      
      // Find and update the match
      ['quarterFinals', 'semiFinals'].forEach(round => {
        const matchIdx = updated[round].findIndex(m => m.id === matchId);
        if (matchIdx !== -1) {
          updated[round] = [...updated[round]];
          updated[round][matchIdx] = {
            ...updated[round][matchIdx],
            [teamSlot]: value
          };
        }
      });
      
      if (updated.final.id === matchId) {
        updated.final = { ...updated.final, [teamSlot]: value };
      }
      
      return updated;
    });
  };

  const handleResetBracket = () => {
    if (window.confirm('Are you sure you want to reset the bracket? This will clear all team assignments.')) {
      setBracketConfig(DEFAULT_BRACKET);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-2xl text-white flex items-center gap-3">
          <span className="text-qw-accent">🎯</span>
          Playoff Bracket
        </h2>
        <button
          onClick={handleResetBracket}
          className="qw-btn-secondary px-3 py-1 text-sm rounded border border-qw-border text-qw-muted hover:text-white hover:border-qw-accent"
        >
          Reset Bracket
        </button>
      </div>

      <p className="text-qw-muted text-sm">
        Enter team names in the bracket slots. Scores will automatically update when matches 
        between those teams are found in the fetched matches.
      </p>

      {/* Bracket Visualization */}
      <div className="qw-panel p-8 overflow-x-auto">
        <div className="flex items-center justify-center gap-4 min-w-[900px]">
          
          {/* Quarter Finals */}
          <div className="flex flex-col gap-4">
            <div className="text-center font-display text-sm text-qw-accent mb-2">QUARTER FINALS</div>
            <div className="flex flex-col gap-16">
              {/* QF 1 & 2 */}
              <div className="flex flex-col gap-4">
                <BracketMatch
                  match={bracketConfig.quarterFinals[0]}
                  seriesSummary={seriesSummary}
                  onUpdateTeam={handleUpdateTeam}
                />
                <BracketMatch
                  match={bracketConfig.quarterFinals[1]}
                  seriesSummary={seriesSummary}
                  onUpdateTeam={handleUpdateTeam}
                />
              </div>
              {/* QF 3 & 4 */}
              <div className="flex flex-col gap-4">
                <BracketMatch
                  match={bracketConfig.quarterFinals[2]}
                  seriesSummary={seriesSummary}
                  onUpdateTeam={handleUpdateTeam}
                />
                <BracketMatch
                  match={bracketConfig.quarterFinals[3]}
                  seriesSummary={seriesSummary}
                  onUpdateTeam={handleUpdateTeam}
                />
              </div>
            </div>
          </div>

          {/* QF -> SF Connectors */}
          <div className="flex flex-col gap-16">
            <div className="h-[168px] flex items-center">
              <BracketConnector type="right" />
            </div>
            <div className="h-[168px] flex items-center">
              <BracketConnector type="right" />
            </div>
          </div>

          {/* Semi Finals */}
          <div className="flex flex-col gap-4">
            <div className="text-center font-display text-sm text-qw-accent mb-2">SEMI FINALS</div>
            <div className="flex flex-col justify-around h-full" style={{ gap: '180px' }}>
              <BracketMatch
                match={bracketConfig.semiFinals[0]}
                seriesSummary={seriesSummary}
                onUpdateTeam={handleUpdateTeam}
              />
              <BracketMatch
                match={bracketConfig.semiFinals[1]}
                seriesSummary={seriesSummary}
                onUpdateTeam={handleUpdateTeam}
              />
            </div>
          </div>

          {/* SF -> Final Connectors */}
          <div className="flex flex-col" style={{ height: '380px' }}>
            <div className="flex-1 flex items-center">
              <BracketConnector type="right" />
            </div>
          </div>

          {/* Final */}
          <div className="flex flex-col items-center">
            <div className="text-center font-display text-sm text-qw-accent mb-2">FINAL</div>
            <div className="flex items-center justify-center" style={{ height: '380px' }}>
              <div className="relative">
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-4xl">
                  🏆
                </div>
                <BracketMatch
                  match={bracketConfig.final}
                  seriesSummary={seriesSummary}
                  onUpdateTeam={handleUpdateTeam}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-match info */}
      <div className="qw-panel p-4">
        <h3 className="font-display text-sm text-qw-accent mb-2">AUTO-MATCH INFO</h3>
        <p className="text-qw-muted text-sm mb-2">
          The bracket automatically detects results for the following matchups:
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.keys(seriesSummary).length === 0 ? (
            <span className="text-qw-muted text-sm italic">No matches found</span>
          ) : (
            Object.entries(seriesSummary).map(([key, data]) => (
              <span
                key={key}
                className="px-2 py-1 bg-qw-dark rounded text-xs font-mono text-qw-muted"
              >
                {data.teams[0]} vs {data.teams[1]} ({data.mapWins[data.teams[0]]}-{data.mapWins[data.teams[1]]})
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_BRACKET };
