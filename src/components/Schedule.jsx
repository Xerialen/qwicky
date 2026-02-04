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
    sortedMatches.forEach(match => {
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
        <h2 className="font-display text-2xl text-white mb-2">No Matches Scheduled</h2>
        <p className="text-qw-muted">Fetch some games to see the schedule</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-2xl text-white flex items-center gap-3">
          <span className="text-qw-accent">📋</span>
          Match Schedule
        </h2>
        <div className="text-qw-muted font-mono text-sm">
          {matches.length} map{matches.length !== 1 ? 's' : ''} total
        </div>
      </div>

      {Object.entries(groupedByDate).map(([date, dateMatches]) => (
        <div key={date} className="qw-panel overflow-hidden">
          {/* Date Header */}
          <div className="bg-qw-dark px-6 py-3 border-b border-qw-border">
            <h3 className="font-display font-bold text-qw-accent">{date}</h3>
          </div>

          {/* Matches for this date */}
          <div className="divide-y divide-qw-border">
            {dateMatches.map((match, idx) => {
              const team1 = match.teams[0];
              const team2 = match.teams[1];
              const score1 = match.scores[team1] || 0;
              const score2 = match.scores[team2] || 0;
              const winner = score1 > score2 ? team1 : score2 > score1 ? team2 : null;

              return (
                <div
                  key={match.id}
                  className="p-4 hover:bg-qw-dark/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    {/* Time */}
                    <div className="w-24 text-qw-muted font-mono text-sm">
                      {match.date?.split(' ')[1] || '--:--'}
                    </div>

                    {/* Teams and Score */}
                    <div className="flex-1 flex items-center justify-center gap-4">
                      {/* Team 1 */}
                      <div className={`flex-1 text-right font-body font-semibold text-lg
                        ${winner === team1 ? 'text-qw-win' : winner === team2 ? 'text-qw-muted' : 'text-white'}`}>
                        {team1}
                      </div>

                      {/* Score */}
                      <div className="flex items-center gap-2 px-4 py-1 bg-qw-dark rounded">
                        <span className={`font-mono font-bold text-xl w-8 text-center
                          ${score1 > score2 ? 'text-qw-win' : score1 < score2 ? 'text-qw-loss' : 'text-white'}`}>
                          {score1}
                        </span>
                        <span className="text-qw-muted">-</span>
                        <span className={`font-mono font-bold text-xl w-8 text-center
                          ${score2 > score1 ? 'text-qw-win' : score2 < score1 ? 'text-qw-loss' : 'text-white'}`}>
                          {score2}
                        </span>
                      </div>

                      {/* Team 2 */}
                      <div className={`flex-1 text-left font-body font-semibold text-lg
                        ${winner === team2 ? 'text-qw-win' : winner === team1 ? 'text-qw-muted' : 'text-white'}`}>
                        {team2}
                      </div>
                    </div>

                    {/* Map & ID */}
                    <div className="w-48 text-right">
                      <div className="text-qw-accent font-mono text-sm">{match.map}</div>
                      <div className="text-qw-muted font-mono text-xs">{match.id}</div>
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
