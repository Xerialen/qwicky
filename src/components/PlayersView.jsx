// src/components/PlayersView.jsx
import React from 'react';

export default function PlayersView({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="qw-panel p-12 text-center">
        <div className="text-4xl mb-4">👤</div>
        <p className="text-on-surface-variant">No player data available</p>
      </div>
    );
  }

  return (
    <div className="qw-panel overflow-hidden">
      <div className="px-6 py-4 bg-surface-container-high border-b border-outline-variant">
        <h2 className="font-headline text-xl text-primary">PLAYER STATISTICS</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-container-high">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-headline text-on-surface-variant uppercase">
                Rank
              </th>
              <th className="px-4 py-3 text-left text-xs font-headline text-on-surface-variant uppercase">
                Player
              </th>
              <th className="px-4 py-3 text-left text-xs font-headline text-on-surface-variant uppercase">
                Maps
              </th>
              <th className="px-4 py-3 text-left text-xs font-headline text-on-surface-variant uppercase">
                Avg Frags
              </th>
              <th className="px-4 py-3 text-left text-xs font-headline text-on-surface-variant uppercase">
                Win Rate
              </th>
              <th className="px-4 py-3 text-left text-xs font-headline text-on-surface-variant uppercase">
                Avg Eff
              </th>
              <th className="px-4 py-3 text-left text-xs font-headline text-on-surface-variant uppercase">
                Avg Dmg
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {data.map((player, index) => (
              <tr key={index} className="hover:bg-surface-container-high/50 transition-colors">
                <td className="px-4 py-4 whitespace-nowrap">
                  <span
                    className={`font-headline font-bold ${
                      index === 0
                        ? 'text-primary'
                        : index === 1
                          ? 'text-tertiary'
                          : index === 2
                            ? 'text-qw-blue'
                            : 'text-on-surface-variant'
                    }`}
                  >
                    {player.Rank || index + 1}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap font-body font-semibold text-on-surface">
                  {player.Player}
                </td>
                <td className="px-4 py-4 whitespace-nowrap font-mono text-sm text-on-surface">
                  {player['Maps Played']}
                </td>
                <td className="px-4 py-4 whitespace-nowrap font-mono text-sm text-primary">
                  {typeof player['Avg Frags'] === 'number'
                    ? player['Avg Frags'].toFixed(1)
                    : player['Avg Frags']}
                </td>
                <td className="px-4 py-4 whitespace-nowrap font-mono text-sm text-tertiary">
                  {typeof player['Win Rate'] === 'number'
                    ? (player['Win Rate'] * 100).toFixed(0)
                    : player['Win Rate']}
                  %
                </td>
                <td className="px-4 py-4 whitespace-nowrap font-mono text-sm text-on-surface">
                  {typeof player['Avg Eff'] === 'number'
                    ? player['Avg Eff'].toFixed(2)
                    : player['Avg Eff']}
                </td>
                <td className="px-4 py-4 whitespace-nowrap font-mono text-sm text-on-surface">
                  {typeof player['Avg Dmg'] === 'number'
                    ? player['Avg Dmg'].toLocaleString()
                    : player['Avg Dmg']}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
