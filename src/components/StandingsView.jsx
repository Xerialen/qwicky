// src/components/StandingsView.jsx
import React from 'react';

export default function StandingsView({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="qw-panel p-12 text-center">
        <div className="text-4xl mb-4">📊</div>
        <p className="text-qw-muted">No standings data available</p>
      </div>
    );
  }

  return (
    <div className="qw-panel overflow-hidden">
      <div className="px-6 py-4 bg-qw-dark border-b border-qw-border">
        <h2 className="font-display text-xl text-qw-accent">STANDINGS</h2>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-qw-dark">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-display text-qw-muted uppercase tracking-wider">#</th>
              <th className="px-6 py-3 text-left text-xs font-display text-qw-muted uppercase tracking-wider">Team</th>
              <th className="px-6 py-3 text-left text-xs font-display text-qw-muted uppercase tracking-wider">Games</th>
              <th className="px-6 py-3 text-left text-xs font-display text-qw-muted uppercase tracking-wider">Maps</th>
              <th className="px-6 py-3 text-left text-xs font-display text-qw-muted uppercase tracking-wider">Diff</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-qw-border">
            {data.map((team, index) => (
              <tr key={index} className="hover:bg-qw-dark/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`font-display font-bold ${
                    index === 0 ? 'text-qw-accent' : 
                    index === 1 ? 'text-qw-win' : 
                    'text-qw-muted'
                  }`}>
                    {team['#'] || index + 1}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-body font-semibold text-white">
                  {team.Team}
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-qw-text">
                  {team.Games}
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-qw-text">
                  {team.Maps}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap font-mono text-sm font-bold ${
                  team.Diff?.startsWith('+') ? 'text-qw-win' : 
                  team.Diff?.startsWith('-') ? 'text-qw-loss' : 'text-qw-muted'
                }`}>
                  {team.Diff}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
