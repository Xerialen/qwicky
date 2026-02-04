// src/components/TeamsView.jsx
import React from 'react';

export default function TeamsView({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="qw-panel p-12 text-center">
        <div className="text-4xl mb-4">👥</div>
        <p className="text-qw-muted">No team data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl text-qw-accent">TEAMS</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((team, index) => (
          <div key={index} className="qw-panel p-6 hover:border-qw-accent transition-colors">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded bg-qw-accent/20 flex items-center justify-center">
                <span className="font-display font-bold text-qw-accent text-lg">
                  {(team['Team Tag'] || team['Team Name']?.charAt(0) || '?').toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="font-body font-bold text-lg text-white">
                  {team['Team Name']}
                </h3>
                {team['Team Tag'] && (
                  <span className="text-sm text-qw-muted font-mono">[{team['Team Tag']}]</span>
                )}
              </div>
            </div>
            
            {team.Players && (
              <div>
                <div className="text-xs text-qw-muted font-display mb-2">ROSTER</div>
                <div className="flex flex-wrap gap-2">
                  {team.Players.split(',').map((player, idx) => (
                    <span 
                      key={idx}
                      className="px-2 py-1 bg-qw-dark rounded text-sm text-qw-text font-mono"
                    >
                      {player.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
