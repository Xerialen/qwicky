// src/components/Schedule.jsx
import React, { useMemo } from 'react';

export default function Schedule({ matches }) {
  // Sort matches chronologically
  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA - dateB;
    });
  }, [matches]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups = {};
    sortedMatches.forEach((match) => {
      const dateKey = match.date ? match.date.split(' ')[0] : 'Unknown Date';
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(match);
    });
    return groups;
  }, [sortedMatches]);

  if (matches.length === 0) {
    return (
      <div className="qw-panel p-12 text-center">
        <div className="text-6xl mb-4">📋</div>
        <h2 className="font-headline text-2xl text-on-surface mb-2">No Matches Scheduled</h2>
        <p className="text-on-surface-variant">Fetch some games to see the schedule</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-headline font-bold text-2xl text-on-surface flex items-center gap-3">
          <span className="text-primary">📋</span>
          Match Schedule
        </h2>
        <div className="text-on-surface-variant font-mono text-sm">
          {matches.length} map{matches.length !== 1 ? 's' : ''} total
        </div>
      </div>

      {Object.entries(groupedByDate).map(([date, dateMatches]) => (
        <div key={date} className="qw-panel overflow-hidden">
          {/* Date Header */}
          <div className="bg-surface-container-high px-6 py-3 border-b border-outline-variant">
            <h3 className="font-headline font-bold text-primary">{date}</h3>
          </div>

          {/* Matches for this date */}
          <div className="divide-y divide-outline-variant">
            {dateMatches.map((match, idx) => {
              const team1 = match.teams[0];
              const team2 = match.teams[1];
              const score1 = match.scores[team1] || 0;
              const score2 = match.scores[team2] || 0;
              const winner = score1 > score2 ? team1 : score2 > score1 ? team2 : null;

              return (
                <div key={match.id} className="p-4 hover:bg-surface-container-high/50 transition-colors">
                  <div className="flex items-center justify-between">
                    {/* Time */}
                    <div className="w-24 text-on-surface-variant font-mono text-sm">
                      {match.date?.split(' ')[1] || '--:--'}
                    </div>

                    {/* Teams and Score */}
                    <div className="flex-1 flex items-center justify-center gap-4">
                      {/* Team 1 */}
                      <div
                        className={`flex-1 text-right font-body font-semibold text-lg
                        ${winner === team1 ? 'text-tertiary' : winner === team2 ? 'text-on-surface-variant' : 'text-on-surface'}`}
                      >
                        {team1}
                      </div>

                      {/* Score */}
                      <div className="flex items-center gap-2 px-4 py-1 bg-surface-container-high rounded">
                        <span
                          className={`font-mono font-bold text-xl w-8 text-center
                          ${score1 > score2 ? 'text-tertiary' : score1 < score2 ? 'text-error' : 'text-on-surface'}`}
                        >
                          {score1}
                        </span>
                        <span className="text-on-surface-variant">-</span>
                        <span
                          className={`font-mono font-bold text-xl w-8 text-center
                          ${score2 > score1 ? 'text-tertiary' : score2 < score1 ? 'text-error' : 'text-on-surface'}`}
                        >
                          {score2}
                        </span>
                      </div>

                      {/* Team 2 */}
                      <div
                        className={`flex-1 text-left font-body font-semibold text-lg
                        ${winner === team2 ? 'text-tertiary' : winner === team1 ? 'text-on-surface-variant' : 'text-on-surface'}`}
                      >
                        {team2}
                      </div>
                    </div>

                    {/* Map & ID */}
                    <div className="w-48 text-right">
                      <div className="text-primary font-mono text-sm">{match.map}</div>
                      <div className="text-on-surface-variant font-mono text-xs">{match.id}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
