// src/components/Standings.jsx
import React, { useMemo } from 'react';
import { calculateStandings } from '../utils/matchLogic';

export default function Standings({ matches }) {
  const standings = useMemo(() => {
    return calculateStandings(matches);
  }, [matches]);

  if (matches.length === 0) {
    return (
      <div className="qw-panel p-12 text-center">
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="font-display text-2xl text-white mb-2">No Standings Yet</h2>
        <p className="text-qw-muted">Fetch some games to calculate standings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-2xl text-white flex items-center gap-3">
          <span className="text-qw-accent">🏆</span>
          Group Stage Standings
        </h2>
        <div className="text-qw-muted font-mono text-sm">
          {standings.length} team{standings.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="qw-panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-qw-dark">
              <th className="text-center w-12">#</th>
              <th className="text-left">Team</th>
              <th className="text-center w-16">P</th>
              <th className="text-center w-16">W</th>
              <th className="text-center w-16">D</th>
              <th className="text-center w-16">L</th>
              <th className="text-center w-24">Maps</th>
              <th className="text-center w-20">Diff</th>
              <th className="text-center w-20">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((team, idx) => {
              const mapDiff = team.mapsWon - team.mapsLost;
              const isTop = idx < Math.ceil(standings.length / 2);
              
              return (
                <tr
                  key={team.name}
                  className={`
                    transition-colors
                    ${idx === 0 ? 'bg-qw-accent/10' : ''}
                    ${isTop && idx !== 0 ? 'bg-qw-win/5' : ''}
                    hover:bg-qw-accent/5
                  `}
                >
                  {/* Position */}
                  <td className="text-center">
                    <span className={`
                      inline-flex items-center justify-center w-8 h-8 rounded-full font-display font-bold
                      ${idx === 0 ? 'bg-qw-accent text-qw-dark' : 
                        idx === 1 ? 'bg-gray-400 text-qw-dark' :
                        idx === 2 ? 'bg-amber-700 text-white' :
                        'bg-qw-border text-qw-muted'
                      }
                    `}>
                      {idx + 1}
                    </span>
                  </td>

                  {/* Team Name */}
                  <td>
                    <span className={`font-body font-semibold text-lg
                      ${idx === 0 ? 'text-qw-accent' : 'text-white'}
                    `}>
                      {team.name}
                    </span>
                  </td>

                  {/* Played */}
                  <td className="text-center text-qw-muted">{team.played}</td>

                  {/* Wins */}
                  <td className="text-center text-qw-win font-semibold">{team.matchesWon}</td>

                  {/* Draws */}
                  <td className="text-center text-qw-draw">{team.matchesDraw}</td>

                  {/* Losses */}
                  <td className="text-center text-qw-loss">{team.matchesLost}</td>

                  {/* Maps Won/Lost */}
                  <td className="text-center font-mono">
                    <span className="text-qw-win">{team.mapsWon}</span>
                    <span className="text-qw-muted mx-1">-</span>
                    <span className="text-qw-loss">{team.mapsLost}</span>
                  </td>

                  {/* Map Difference */}
                  <td className="text-center font-mono font-semibold">
                    <span className={
                      mapDiff > 0 ? 'text-qw-win' : 
                      mapDiff < 0 ? 'text-qw-loss' : 
                      'text-qw-muted'
                    }>
                      {mapDiff > 0 ? '+' : ''}{mapDiff}
                    </span>
                  </td>

                  {/* Points */}
                  <td className="text-center">
                    <span className={`
                      font-display font-bold text-lg
                      ${idx === 0 ? 'text-qw-accent' : 'text-white'}
                    `}>
                      {team.points}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-display text-qw-muted">P</span>
          <span className="text-qw-muted">= Played</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-display text-qw-win">W</span>
          <span className="text-qw-muted">= Wins (3 pts)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-display text-qw-draw">D</span>
          <span className="text-qw-muted">= Draws (1 pt)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-display text-qw-loss">L</span>
          <span className="text-qw-muted">= Losses</span>
        </div>
      </div>
    </div>
  );
}
