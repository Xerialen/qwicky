// src/components/division/DivisionStats.jsx
import React, { useState, useMemo } from 'react';
import { calculateStats, formatStatsForTable } from '../../utils/statsLogic';

export default function DivisionStats({ division }) {
  const [sortConfig, setSortConfig] = useState({ key: 'avgFrags', direction: 'desc' });
  const [activeView, setActiveView] = useState('table'); // 'table' or 'wiki'

  const rawMaps = division.rawMaps || [];

  // Extract original ktxstats data for stats calculation
  const ktxstatsData = useMemo(() => {
    if (!rawMaps || rawMaps.length === 0) return [];
    // rawMaps contains parsed match objects with originalData property
    return rawMaps.map((m) => m.originalData).filter((d) => d && d.players); // Only keep matches with player data
  }, [rawMaps]);

  const playersDb = useMemo(() => {
    if (!ktxstatsData || ktxstatsData.length === 0) return {};
    return calculateStats(ktxstatsData);
  }, [ktxstatsData]);

  const statsData = useMemo(() => {
    if (!playersDb || Object.keys(playersDb).length === 0) {
      return [];
    }
    return formatStatsForTable(playersDb);
  }, [playersDb]);

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return statsData;

    return [...statsData].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal === bVal) return 0;

      const comparison = aVal < bVal ? -1 : 1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [statsData, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const SortableHeader = ({ columnKey, children, className = '' }) => {
    const isSorted = sortConfig.key === columnKey;
    const direction = isSorted ? sortConfig.direction : null;

    return (
      <th
        onClick={() => handleSort(columnKey)}
        className={`px-3 py-2 text-left text-xs font-body font-semibold text-primary uppercase tracking-wider cursor-pointer hover:text-on-surface transition-colors ${className}`}
      >
        <div className="flex items-center gap-1">
          {children}
          {isSorted && <span className="text-primary">{direction === 'asc' ? '▲' : '▼'}</span>}
        </div>
      </th>
    );
  };

  if (!rawMaps || rawMaps.length === 0) {
    return (
      <div className="qw-panel p-8 text-center">
        <div className="text-on-surface-variant mb-4">📊</div>
        <p className="text-on-surface-variant">No match data available for statistics.</p>
        <p className="text-xs text-on-surface-variant mt-2">
          Import match results in the Results tab to see player stats.
        </p>
      </div>
    );
  }

  if (ktxstatsData.length === 0) {
    return (
      <div className="qw-panel p-8 text-center">
        <div className="text-on-surface-variant mb-4">⚠️</div>
        <p className="text-on-surface-variant">No detailed player statistics available.</p>
        <p className="text-xs text-on-surface-variant mt-2">
          The imported matches don't contain player-level data needed for stats.
          <br />
          Make sure to import ktxstats JSON files with full player statistics.
        </p>
      </div>
    );
  }

  if (Object.keys(playersDb).length === 0) {
    return (
      <div className="qw-panel p-8 text-center">
        <p className="text-on-surface-variant">Processing match data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="qw-panel p-4">
          <div className="text-xs text-on-surface-variant uppercase font-body font-semibold">Players</div>
          <div className="text-2xl font-headline font-bold text-on-surface mt-1">
            {Object.keys(playersDb).length}
          </div>
        </div>
        <div className="qw-panel p-4">
          <div className="text-xs text-on-surface-variant uppercase font-body font-semibold">Total Maps</div>
          <div className="text-2xl font-headline font-bold text-on-surface mt-1">
            {ktxstatsData.length}
          </div>
        </div>
        <div className="qw-panel p-4">
          <div className="text-xs text-on-surface-variant uppercase font-body font-semibold">
            Avg Frags/Map
          </div>
          <div className="text-2xl font-headline font-bold text-on-surface mt-1">
            {ktxstatsData.length > 0
              ? (
                  Object.values(playersDb).reduce((sum, p) => sum + p.frags, 0) /
                  ktxstatsData.length /
                  2
                ).toFixed(1)
              : '0.0'}
          </div>
        </div>
        <div className="qw-panel p-4">
          <div className="text-xs text-on-surface-variant uppercase font-body font-semibold">Top Fragger</div>
          <div className="text-lg font-headline font-bold text-primary mt-1">
            {sortedData[0]?.name || 'N/A'}
          </div>
        </div>
      </div>

      {/* Stats Table */}
      <div className="qw-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-surface-container-high border-b border-outline-variant">
              <tr>
                <SortableHeader columnKey="name">Player</SortableHeader>
                <SortableHeader columnKey="games">Games</SortableHeader>
                <SortableHeader columnKey="avgFrags">Frags</SortableHeader>
                <SortableHeader columnKey="avgDeaths">Deaths</SortableHeader>
                <SortableHeader columnKey="avgDmg">Dmg</SortableHeader>
                <SortableHeader columnKey="avgEwep">EWEP</SortableHeader>
                <SortableHeader columnKey="avgToDie">To Die</SortableHeader>
                <SortableHeader columnKey="effPct">Eff %</SortableHeader>
                <SortableHeader columnKey="avgSpeed">Avg Spd</SortableHeader>
                <SortableHeader columnKey="maxSpeed">Max Spd</SortableHeader>
                <SortableHeader columnKey="rlKills">RL K</SortableHeader>
                <SortableHeader columnKey="rlXfer">RL X</SortableHeader>
                <SortableHeader columnKey="rlHits">RL H</SortableHeader>
                <SortableHeader columnKey="rlTaken">RL T</SortableHeader>
                <SortableHeader columnKey="rlDrop">RL D</SortableHeader>
                <SortableHeader columnKey="lgKills">LG K</SortableHeader>
                <SortableHeader columnKey="lgTaken">LG T</SortableHeader>
                <SortableHeader columnKey="lgDrop">LG D</SortableHeader>
                <SortableHeader columnKey="glKills">GL</SortableHeader>
                <SortableHeader columnKey="ssgKills">SSG</SortableHeader>
                <SortableHeader columnKey="ngKills">NG</SortableHeader>
                <SortableHeader columnKey="sngKills">SNG</SortableHeader>
                <SortableHeader columnKey="quad">Quad</SortableHeader>
                <SortableHeader columnKey="pent">Pent</SortableHeader>
                <SortableHeader columnKey="ring">Ring</SortableHeader>
                <SortableHeader columnKey="ra">RA</SortableHeader>
                <SortableHeader columnKey="ya">YA</SortableHeader>
                <SortableHeader columnKey="mh">MH</SortableHeader>
                <SortableHeader columnKey="lgAcc">LG %</SortableHeader>
                <SortableHeader columnKey="sgAcc">SG %</SortableHeader>
              </tr>
            </thead>
            <tbody className="bg-surface-container-high">
              {sortedData.map((player, idx) => (
                <tr
                  key={player.name}
                  className="border-b border-outline-variant hover:bg-surface-container-high/50 transition-colors"
                  style={{
                    borderLeft: player.teamColor ? `3px solid ${player.teamColor}` : 'none',
                  }}
                >
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface font-body font-semibold">
                    {player.name}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.games}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.avgFrags}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.avgDeaths}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.avgDmg}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.avgEwep}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.avgToDie}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.effPct.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.avgSpeed}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.maxSpeed}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.rlKills}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.rlXfer}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.rlHits}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.rlTaken}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.rlDrop}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.lgKills}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.lgTaken}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.lgDrop}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.glKills}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.ssgKills}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.ngKills}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.sngKills}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.quad}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.pent}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.ring}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">{player.ra}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">{player.ya}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">{player.mh}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.lgAcc.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-on-surface">
                    {player.sgAcc.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Help text */}
      <div className="text-xs text-on-surface-variant italic">
        💡 Click column headers to sort. Stats are averaged per game or per opportunity
        (map-dependent items).
      </div>
    </div>
  );
}
