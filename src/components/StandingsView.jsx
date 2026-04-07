// src/components/StandingsView.jsx
import React from 'react';

export default function StandingsView({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="qw-panel p-12 text-center">
        <div className="text-4xl mb-4">📊</div>
        <p className="text-on-surface-variant">No standings data available</p>
      </div>
    );
  }

  return (
    <div className="qw-panel overflow-hidden">
      <div className="px-6 py-4 bg-surface-container-high border-b border-outline-variant">
        <h2 className="font-headline text-xl text-primary">STANDINGS</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-container-high">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-headline text-on-surface-variant uppercase tracking-wider">
                #
              </th>
              <th className="px-6 py-3 text-left text-xs font-headline text-on-surface-variant uppercase tracking-wider">
                Team
              </th>
              <th className="px-6 py-3 text-left text-xs font-headline text-on-surface-variant uppercase tracking-wider">
                Games
              </th>
              <th className="px-6 py-3 text-left text-xs font-headline text-on-surface-variant uppercase tracking-wider">
                Maps
              </th>
              <th className="px-6 py-3 text-left text-xs font-headline text-on-surface-variant uppercase tracking-wider">
                Diff
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {data.map((team, index) => (
              <tr key={index} className="hover:bg-surface-container-high/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`font-headline font-bold ${
                      index === 0 ? 'text-primary' : index === 1 ? 'text-tertiary' : 'text-on-surface-variant'
                    }`}
                  >
                    {team['#'] || index + 1}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-body font-semibold text-on-surface">
                  {team.Team}
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-on-surface">
                  {team.Games}
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-on-surface">
                  {team.Maps}
                </td>
                <td
                  className={`px-6 py-4 whitespace-nowrap font-mono text-sm font-bold ${
                    team.Diff?.startsWith('+')
                      ? 'text-tertiary'
                      : team.Diff?.startsWith('-')
                        ? 'text-error'
                        : 'text-on-surface-variant'
                  }`}
                >
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
