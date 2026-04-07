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
        <h2 className="font-headline text-2xl text-on-surface mb-2">No Standings Yet</h2>
        <p className="text-on-surface-variant">Fetch some games to calculate standings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-headline font-bold text-2xl text-on-surface flex items-center gap-3">
          <span className="text-primary">🏆</span>
          Group Stage Standings
        </h2>
        <div className="text-on-surface-variant font-mono text-sm">
          {standings.length} team{standings.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="qw-panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-container-high">
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
                    ${idx === 0 ? 'bg-primary/10' : ''}
                    ${isTop && idx !== 0 ? 'bg-qw-win/5' : ''}
                    hover:bg-primary/5
                  `}
                >
                  {/* Position */}
                  <td className="text-center">
                    <span
                      className={`
                      inline-flex items-center justify-center w-8 h-8 rounded-full font-headline font-bold
                      ${
                        idx === 0
                          ? 'bg-primary text-qw-dark'
                          : idx === 1
                            ? 'bg-gray-400 text-qw-dark'
                            : idx === 2
                              ? 'bg-amber-700 text-on-surface'
                              : 'bg-outline-variant text-on-surface-variant'
                      }
                    `}
                    >
                      {idx + 1}
                    </span>
                  </td>

                  {/* Team Name */}
                  <td>
                    <span
                      className={`font-body font-semibold text-lg
                      ${idx === 0 ? 'text-primary' : 'text-on-surface'}
                    `}
                    >
                      {team.name}
                    </span>
                  </td>

                  {/* Played */}
                  <td className="text-center text-on-surface-variant">{team.played}</td>

                  {/* Wins */}
                  <td className="text-center text-tertiary font-semibold">{team.matchesWon}</td>

                  {/* Draws */}
                  <td className="text-center text-qw-draw">{team.matchesDraw}</td>

                  {/* Losses */}
                  <td className="text-center text-error">{team.matchesLost}</td>

                  {/* Maps Won/Lost */}
                  <td className="text-center font-mono">
                    <span className="text-tertiary">{team.mapsWon}</span>
                    <span className="text-on-surface-variant mx-1">-</span>
                    <span className="text-error">{team.mapsLost}</span>
                  </td>

                  {/* Map Difference */}
                  <td className="text-center font-mono font-semibold">
                    <span
                      className={
                        mapDiff > 0 ? 'text-tertiary' : mapDiff < 0 ? 'text-error' : 'text-on-surface-variant'
                      }
                    >
                      {mapDiff > 0 ? '+' : ''}
                      {mapDiff}
                    </span>
                  </td>

                  {/* Points */}
                  <td className="text-center">
                    <span
                      className={`
                      font-headline font-bold text-lg
                      ${idx === 0 ? 'text-primary' : 'text-on-surface'}
                    `}
                    >
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
          <span className="font-headline text-on-surface-variant">P</span>
          <span className="text-on-surface-variant">= Played</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-headline text-tertiary">W</span>
          <span className="text-on-surface-variant">= Wins (3 pts)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-headline text-qw-draw">D</span>
          <span className="text-on-surface-variant">= Draws (1 pt)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-headline text-error">L</span>
          <span className="text-on-surface-variant">= Losses</span>
        </div>
      </div>
    </div>
  );
}
