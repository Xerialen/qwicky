// src/components/PlayersView.jsx
import React from 'react';

export default function PlayersView({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="qw-panel p-12 text-center">
        <div className="text-4xl mb-4">👤</div>
        <p className="text-qw-muted">No player data available</p>
      </div>
    );
  }

  return (
    <div className="qw-panel overflow-hidden">
      <div className="px-6 py-4 bg-qw-dark border-b border-qw-border">
        <h2 className="font-display text-xl text-qw-accent">PLAYER STATISTICS</h2>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-qw-dark">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-display text-qw-muted uppercase">Rank</th>
              <th className="px-4 py-3 text-left text-xs font-display text-qw-muted uppercase">Player</th>
              <th className="px-4 py-3 text-left text-xs font-display text-qw-muted uppercase">Maps</th>
              <th className="px-4 py-3 text-left text-xs font-display text-qw-muted uppercase">Avg Frags</th>
              <th className="px-4 py-3 text-left text-xs font-display text-qw-muted uppercase">Win Rate</th>
              <th className="px-4 py-3 text-left text-xs font-display text-qw-muted uppercase">Avg Eff</th>
              <th className="px-4 py-3 text-left text-xs font-display text-qw-muted uppercase">Avg Dmg</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-qw-border">
            {data.map((player, index) => (
              <tr key={index} className="hover:bg-qw-dark/50 transition-colors">
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className={`font-display font-bold ${
                    index === 0 ? 'text-qw-accent' : 
                    index === 1 ? 'text-qw-win' : 
                    index === 2 ? 'text-qw-blue' :
                    'text-qw-muted'
                  }`}>
                    {player.Rank || index + 1}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap font-body font-semibold text-white">
                  {player.Player}
                </td>
                <td className="px-4 py-4 whitespace-nowrap font-mono text-sm text-qw-text">
                  {player['Maps Played']}
                </td>
                <td className="px-4 py-4 whitespace-nowrap font-mono text-sm text-qw-accent">
                  {typeof player['Avg Frags'] === 'number' ? player['Avg Frags'].toFixed(1) : player['Avg Frags']}
                </td>
                <td className="px-4 py-4 whitespace-nowrap font-mono text-sm text-qw-win">
                  {typeof player['Win Rate'] === 'number' ? (player['Win Rate'] * 100).toFixed(0) : player['Win Rate']}%
                </td>
                <td className="px-4 py-4 whitespace-nowrap font-mono text-sm text-qw-text">
                  {typeof player['Avg Eff'] === 'number' ? player['Avg Eff'].toFixed(2) : player['Avg Eff']}
                </td>
                <td className="px-4 py-4 whitespace-nowrap font-mono text-sm text-qw-text">
                  {typeof player['Avg Dmg'] === 'number' ? player['Avg Dmg'].toLocaleString() : player['Avg Dmg']}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
