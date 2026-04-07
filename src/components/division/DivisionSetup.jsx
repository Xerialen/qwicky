// src/components/division/DivisionSetup.jsx
import React, { useState, useEffect } from 'react';
import { createDefaultBracket } from '../../App';

const formatDisplay = (type, count) => {
  const prefix = type === 'playall' ? 'Go' : 'Bo';
  return `${prefix}${count}`;
};

function TieBreakerConfig({ value, onChange }) {
  const options = [
    { id: 'mapDiff', label: 'Map Difference', desc: 'Maps Won - Maps Lost' },
    { id: 'fragDiff', label: 'Frag Difference', desc: 'Frags Scored - Frags Conceded' },
    { id: 'headToHead', label: 'Head-to-Head', desc: 'Direct match result' },
  ];

  const tieBreakers = value || ['mapDiff', 'fragDiff', 'headToHead'];

  const moveUp = (idx) => {
    if (idx === 0) return;
    const newOrder = [...tieBreakers];
    [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
    onChange(newOrder);
  };

  const moveDown = (idx) => {
    if (idx === tieBreakers.length - 1) return;
    const newOrder = [...tieBreakers];
    [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
    onChange(newOrder);
  };

  return (
    <div className="space-y-2">
      <label className="font-headline text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-1 block">Tie-Breaker Priority</label>
      <div className="space-y-1">
        {tieBreakers.map((tbId, idx) => {
          const opt = options.find((o) => o.id === tbId);
          return (
            <div
              key={tbId}
              className="flex items-center gap-2 p-2 bg-surface-container-high rounded border border-outline-variant"
            >
              <span className="text-primary font-mono text-sm w-5">{idx + 1}.</span>
              <div className="flex-1">
                <span className="text-on-surface text-sm font-semibold">{opt?.label || tbId}</span>
                <span className="text-on-surface-variant text-xs ml-2">({opt?.desc})</span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="px-2 py-1 text-xs bg-background rounded hover:bg-outline-variant disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveDown(idx)}
                  disabled={idx === tieBreakers.length - 1}
                  className="px-2 py-1 text-xs bg-background rounded hover:bg-outline-variant disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FormatSelect({
  typeValue,
  countValue,
  onTypeChange,
  onCountChange,
  label,
  counts = [1, 3, 5, 7],
}) {
  return (
    <div>
      <label className="block text-on-surface-variant text-sm mb-1">{label}</label>
      <div className="flex gap-1">
        <select
          value={typeValue}
          onChange={(e) => onTypeChange(e.target.value)}
          className="flex-1 bg-surface-container-high border border-outline-variant rounded px-1 py-2 text-on-surface text-sm"
        >
          <option value="bestof">Bo</option>
          <option value="playall">Go</option>
        </select>
        <select
          value={countValue}
          onChange={(e) => onCountChange(parseInt(e.target.value))}
          className="w-12 bg-surface-container-high border border-outline-variant rounded px-1 py-2 text-on-surface text-sm"
        >
          {counts.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function DivisionSetup({ division, updateDivision }) {
  const handleUpdate = (field, value) => {
    updateDivision({ [field]: value });
  };

  // Default tier configuration
  const createDefaultTiers = () => [
    {
      id: 'gold',
      name: 'Gold Playoffs',
      positions: '1-4',
      type: 'single',
      teams: 4,
      bracket: createDefaultBracket('single', 4),
    },
    {
      id: 'silver',
      name: 'Silver Playoffs',
      positions: '5-8',
      type: 'single',
      teams: 4,
      bracket: createDefaultBracket('single', 4),
    },
  ];

  // Sync playoffFormat when division format changes (fixes immediate update issue)
  useEffect(() => {
    const divFormat = division.format;
    const currentPlayoffFormat = division.playoffFormat || 'single';

    // When format is explicitly single or double elimination, sync the playoff format
    if (divFormat === 'single-elim' && currentPlayoffFormat !== 'single') {
      updateDivision({
        playoffFormat: 'single',
        bracket: createDefaultBracket('single', division.playoffTeams || 4),
      });
    } else if (divFormat === 'double-elim' && currentPlayoffFormat !== 'double') {
      updateDivision({
        playoffFormat: 'double',
        bracket: createDefaultBracket('double', division.playoffTeams || 4),
      });
    } else if (divFormat === 'multi-tier' && !division.playoffTiers) {
      // Initialize default tiers for multi-tier format
      updateDivision({
        playoffTiers: createDefaultTiers(),
      });
    }
  }, [division.format]);

  const handlePlayoffFormatChange = (format) => {
    handleUpdate('playoffFormat', format);
    // Recreate bracket when format changes
    handleUpdate('bracket', createDefaultBracket(format, division.playoffTeams || 4));
  };

  const handlePlayoffTeamsChange = (teams) => {
    handleUpdate('playoffTeams', teams);
    // Recreate bracket when team count changes
    const effectiveFormat = getEffectivePlayoffFormat();
    handleUpdate('bracket', createDefaultBracket(effectiveFormat, teams));
  };

  // Determine the effective playoff format based on division format
  const getEffectivePlayoffFormat = () => {
    if (division.format === 'single-elim') return 'single';
    if (division.format === 'double-elim') return 'double';
    return division.playoffFormat || 'single';
  };

  const [showCustomRounds, setShowCustomRounds] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isPlayAll = (division.groupStageType || 'bestof') === 'playall';
  const effectivePlayoffFormat = getEffectivePlayoffFormat();
  const isDoubleElim = effectivePlayoffFormat === 'double';
  const playoffTeams = division.playoffTeams || 4;

  // Check if format is locked by division format selection
  const isPlayoffFormatLocked =
    division.format === 'single-elim' || division.format === 'double-elim';
  const isMultiTier = division.format === 'multi-tier';

  // Detect if rounds have been customized (different formats across rounds)
  const roundsAreCustomized = (() => {
    const baseType = division.playoffSFType || 'bestof';
    const baseBo = division.playoffSFBestOf || 3;
    const checks = [[division.playoffQFType || 'bestof', division.playoffQFBestOf || 3]];
    if (playoffTeams >= 16)
      checks.push([division.playoffR16Type || 'bestof', division.playoffR16BestOf || 3]);
    if (playoffTeams >= 32)
      checks.push([division.playoffR32Type || 'bestof', division.playoffR32BestOf || 3]);
    if (isDoubleElim)
      checks.push([division.playoffLosersType || 'bestof', division.playoffLosersBestOf || 3]);
    return checks.some(([t, b]) => t !== baseType || b !== baseBo);
  })();

  // Apply a single format to all non-final rounds
  const handleBulkRoundFormat = (type, count) => {
    const updates = {
      playoffR32Type: type,
      playoffR32BestOf: count,
      playoffR16Type: type,
      playoffR16BestOf: count,
      playoffQFType: type,
      playoffQFBestOf: count,
      playoffSFType: type,
      playoffSFBestOf: count,
    };
    if (isDoubleElim) {
      updates.playoffLosersType = type;
      updates.playoffLosersBestOf = count;
    }
    updateDivision(updates);
  };

  // Multi-tier helper functions
  const handleAddTier = () => {
    const tiers = division.playoffTiers || [];
    const tierNames = ['Bronze', 'Copper', 'Iron', 'Wood', 'Stone'];
    const usedNames = tiers.map((t) => t.name.split(' ')[0]);
    const nextName = tierNames.find((n) => !usedNames.includes(n)) || `Tier ${tiers.length + 1}`;
    const lastTier = tiers[tiers.length - 1];
    const lastEndPos = lastTier ? parseInt(lastTier.positions.split('-')[1]) : 4;

    const newTier = {
      id: `tier-${Date.now()}`,
      name: `${nextName} Playoffs`,
      positions: `${lastEndPos + 1}-${lastEndPos + 4}`,
      type: 'single',
      teams: 4,
      bracket: createDefaultBracket('single', 4),
    };

    updateDivision({ playoffTiers: [...tiers, newTier] });
  };

  const handleRemoveTier = (tierId) => {
    const tiers = division.playoffTiers || [];
    if (tiers.length <= 1) return; // Keep at least one tier
    updateDivision({ playoffTiers: tiers.filter((t) => t.id !== tierId) });
  };

  const handleUpdateTier = (tierId, field, value) => {
    const tiers = division.playoffTiers || [];
    const updatedTiers = tiers.map((t) => {
      if (t.id !== tierId) return t;

      // If changing type or teams, recreate the bracket
      if (field === 'type' || field === 'teams') {
        const newType = field === 'type' ? value : t.type;
        const newTeams = field === 'teams' ? value : t.teams;
        return {
          ...t,
          [field]: value,
          bracket: createDefaultBracket(newType, newTeams),
        };
      }

      return { ...t, [field]: value };
    });

    updateDivision({ playoffTiers: updatedTiers });
  };

  const FORMAT_OPTIONS = [
    {
      value: 'groups',
      label: 'Group Stage + Playoffs',
      desc: 'Round-robin groups → elimination bracket',
      icon: '🏆',
    },
    {
      value: 'single-elim',
      label: 'Single Elimination',
      desc: "One loss and you're out",
      icon: '⚡',
    },
    {
      value: 'double-elim',
      label: 'Double Elimination',
      desc: 'Winners & losers brackets',
      icon: '🔄',
    },
    {
      value: 'multi-tier',
      label: 'Multi-Tier Playoffs',
      desc: 'Gold/Silver/Bronze brackets from group standings',
      icon: '🥇',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Division Info */}
      <div className="bg-surface-container-high p-6">
        <h3 className="font-headline text-lg text-primary mb-4">DIVISION INFO</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-on-surface-variant text-sm mb-1">Division Name</label>
            <input
              type="text"
              value={division.name}
              onChange={(e) => handleUpdate('name', e.target.value)}
              className="w-full bg-surface-container-high border border-outline-variant rounded px-4 py-2 text-on-surface"
            />
          </div>
          <div>
            <label className="block text-on-surface-variant text-sm mb-2">Tournament Format</label>
            <div className="grid grid-cols-2 gap-3">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleUpdate('format', opt.value)}
                  className={`text-left p-3 border-2 transition-all duration-200 ${
                    division.format === opt.value
                      ? 'border-primary bg-primary/10 text-on-surface'
                      : 'border-outline-variant bg-surface-container-high text-on-surface-variant hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{opt.icon}</span>
                    <span className="font-medium text-sm">{opt.label}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Group Stage Settings - Only show for formats with group stage */}
      {(division.format === 'groups' || division.format === 'multi-tier') && (
        <div className="bg-surface-container-high p-6">
          <h3 className="font-headline text-lg text-primary mb-4">GROUP STAGE SETTINGS</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-on-surface-variant text-sm mb-1">Number of Groups</label>
              <select
                value={division.numGroups}
                onChange={(e) => handleUpdate('numGroups', parseInt(e.target.value))}
                className="w-full bg-surface-container-high border border-outline-variant rounded px-3 py-2 text-on-surface"
              >
                {[1, 2, 3, 4, 6, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} Group{n > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-on-surface-variant text-sm mb-1">Teams per Group</label>
              <select
                value={division.teamsPerGroup}
                onChange={(e) => handleUpdate('teamsPerGroup', parseInt(e.target.value))}
                className="w-full bg-surface-container-high border border-outline-variant rounded px-3 py-2 text-on-surface"
              >
                {[2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n} Teams
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-on-surface-variant text-sm mb-1">Meetings per Matchup</label>
              <select
                value={division.groupMeetings || 1}
                onChange={(e) => handleUpdate('groupMeetings', parseInt(e.target.value))}
                className="w-full bg-surface-container-high border border-outline-variant rounded px-3 py-2 text-on-surface"
              >
                <option value={1}>Once (single round-robin)</option>
                <option value={2}>Twice (double round-robin)</option>
                <option value={3}>Three times</option>
                <option value={4}>Four times</option>
              </select>
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="block text-on-surface-variant text-sm mb-1">Series Format</label>
              <div className="flex gap-2">
                <select
                  value={division.groupStageType || 'bestof'}
                  onChange={(e) => handleUpdate('groupStageType', e.target.value)}
                  className="flex-1 bg-surface-container-high border border-outline-variant rounded px-2 py-2 text-on-surface"
                >
                  <option value="bestof">Best Of (Bo)</option>
                  <option value="playall">Play All (Go)</option>
                </select>
                <select
                  value={division.groupStageBestOf}
                  onChange={(e) => handleUpdate('groupStageBestOf', parseInt(e.target.value))}
                  className="w-16 bg-surface-container-high border border-outline-variant rounded px-2 py-2 text-on-surface"
                >
                  {[1, 2, 3, 5, 7].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-on-surface-variant text-sm mb-1">Advance to Playoffs</label>
              {isMultiTier ? (
                <div className="w-full bg-surface-container-high border border-outline-variant rounded px-3 py-2 text-on-surface-variant flex items-center justify-between">
                  <span>Set per tier</span>
                  <span className="text-xs text-primary">Locked by format</span>
                </div>
              ) : (
                <select
                  value={division.advanceCount}
                  onChange={(e) => handleUpdate('advanceCount', parseInt(e.target.value))}
                  className="w-full bg-surface-container-high border border-outline-variant rounded px-3 py-2 text-on-surface"
                >
                  {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                    <option key={n} value={n}>
                      Top {n}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-on-surface-variant text-sm mb-1">Expected Pace</label>
              <select
                value={division.matchPace || 'weekly'}
                onChange={(e) => handleUpdate('matchPace', e.target.value)}
                className="w-full bg-surface-container-high border border-outline-variant rounded px-3 py-2 text-on-surface"
              >
                <option value="daily">Daily</option>
                <option value="twice-weekly">2 games/week</option>
                <option value="weekly">1 game/week</option>
                <option value="biweekly">1 game/2 weeks</option>
                <option value="flexible">Flexible</option>
              </select>
            </div>
          </div>

          <div className="mt-4 p-3 bg-surface-container-high rounded border border-outline-variant">
            <div className="text-sm text-on-surface-variant">
              <span className="text-on-surface font-semibold">
                {division.numGroups} group{division.numGroups > 1 ? 's' : ''} ×{' '}
                {division.teamsPerGroup} teams
              </span>
              {' = '}
              <span className="text-primary">
                {((division.teamsPerGroup * (division.teamsPerGroup - 1)) / 2) *
                  (division.groupMeetings || 1) *
                  division.numGroups}{' '}
                group stage matches
              </span>
              {' • '}
              <span className="text-on-surface">
                {formatDisplay(division.groupStageType || 'bestof', division.groupStageBestOf)}
              </span>
            </div>
            {isPlayAll && (
              <div className="text-xs text-primary mt-1">
                ⚠️ Play All mode: All maps played, points per map.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Multi-Tier Playoff Configuration - Only for multi-tier format */}
      {isMultiTier && (
        <div className="bg-surface-container-high p-6">
          <h3 className="font-headline text-lg text-primary mb-4">TIER CONFIGURATION</h3>
          <p className="text-sm text-on-surface-variant mb-4">
            Configure multiple independent playoff brackets for different tier ranges
            (Gold/Silver/Bronze).
          </p>

          {/* Tier Cards */}
          <div className="space-y-4">
            {(division.playoffTiers || []).map((tier, index) => {
              const tierIsDoubleElim = tier.type === 'double';
              return (
                <div key={tier.id} className="bg-surface-container-high rounded border border-outline-variant p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {tier.id === 'gold'
                          ? '🥇'
                          : tier.id === 'silver'
                            ? '🥈'
                            : tier.id === 'bronze'
                              ? '🥉'
                              : '🏅'}
                      </span>
                      <input
                        type="text"
                        value={tier.name}
                        onChange={(e) => handleUpdateTier(tier.id, 'name', e.target.value)}
                        className="bg-transparent border-b border-outline-variant text-on-surface font-semibold px-1"
                      />
                    </div>
                    {index > 0 && (
                      <button
                        onClick={() => handleRemoveTier(tier.id)}
                        className="text-error hover:text-error/80 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-on-surface-variant text-xs mb-1">Positions</label>
                      <input
                        type="text"
                        value={tier.positions}
                        onChange={(e) => handleUpdateTier(tier.id, 'positions', e.target.value)}
                        placeholder="e.g., 1-4"
                        className="w-full bg-background border border-outline-variant rounded px-2 py-1.5 text-on-surface text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-on-surface-variant text-xs mb-1">Bracket Type</label>
                      <select
                        value={tier.type}
                        onChange={(e) => handleUpdateTier(tier.id, 'type', e.target.value)}
                        className="w-full bg-background border border-outline-variant rounded px-2 py-1.5 text-on-surface text-sm"
                      >
                        <option value="single">Single Elimination</option>
                        <option value="double">Double Elimination</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-on-surface-variant text-xs mb-1">Teams</label>
                      <select
                        value={tier.teams}
                        onChange={(e) =>
                          handleUpdateTier(tier.id, 'teams', parseInt(e.target.value))
                        }
                        className="w-full bg-background border border-outline-variant rounded px-2 py-1.5 text-on-surface text-sm"
                      >
                        <option value={4}>4 Teams</option>
                        <option value={8}>8 Teams</option>
                        <option value={16}>16 Teams</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-on-surface-variant text-xs mb-1">Series Format</label>
                      <div className="flex gap-1">
                        <select
                          value={tier.seriesType || 'bestof'}
                          onChange={(e) => handleUpdateTier(tier.id, 'seriesType', e.target.value)}
                          className="flex-1 bg-background border border-outline-variant rounded px-1 py-1.5 text-on-surface text-sm"
                        >
                          <option value="bestof">Bo</option>
                          <option value="playall">Go</option>
                        </select>
                        <select
                          value={tier.seriesCount || 3}
                          onChange={(e) =>
                            handleUpdateTier(tier.id, 'seriesCount', parseInt(e.target.value))
                          }
                          className="w-12 bg-background border border-outline-variant rounded px-1 py-1.5 text-on-surface text-sm"
                        >
                          {[1, 3, 5, 7].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Double Elim specific options */}
                  {tierIsDoubleElim && (
                    <div className="mt-4 pt-4 border-t border-outline-variant/50">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-on-surface-variant text-xs mb-1">Losers Bo</label>
                          <select
                            value={tier.losersBo || 3}
                            onChange={(e) =>
                              handleUpdateTier(tier.id, 'losersBo', parseInt(e.target.value))
                            }
                            className="w-full bg-background border border-outline-variant rounded px-2 py-1.5 text-on-surface text-sm"
                          >
                            {[1, 3, 5].map((n) => (
                              <option key={n} value={n}>
                                Bo{n}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-on-surface-variant text-xs mb-1">Grand Final</label>
                          <select
                            value={tier.grandFinalBo || 5}
                            onChange={(e) =>
                              handleUpdateTier(tier.id, 'grandFinalBo', parseInt(e.target.value))
                            }
                            className="w-full bg-background border border-outline-variant rounded px-2 py-1.5 text-on-surface text-sm"
                          >
                            {[3, 5, 7].map((n) => (
                              <option key={n} value={n}>
                                Bo{n}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-2 text-on-surface-variant text-sm">
                            <input
                              type="checkbox"
                              checked={tier.bracketReset !== false}
                              onChange={(e) =>
                                handleUpdateTier(tier.id, 'bracketReset', e.target.checked)
                              }
                              className="accent-primary"
                            />
                            Bracket Reset
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tier Summary */}
                  <div className="mt-3 p-2 bg-background/50 rounded text-xs text-on-surface-variant">
                    {tierIsDoubleElim ? (
                      <span>
                        Double Elim: {tier.teams} teams •{' '}
                        {formatDisplay(tier.seriesType || 'bestof', tier.seriesCount || 3)} • GF Bo
                        {tier.grandFinalBo || 5} {tier.bracketReset !== false ? '+ reset' : ''}
                      </span>
                    ) : (
                      <span>
                        Single Elim: {tier.teams} teams •{' '}
                        {formatDisplay(tier.seriesType || 'bestof', tier.seriesCount || 3)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Tier Button */}
          <button
            onClick={handleAddTier}
            className="mt-4 w-full py-2 border-2 border-dashed border-outline-variant rounded text-on-surface-variant hover:text-on-surface hover:border-primary transition-colors"
          >
            + Add Another Tier (Bronze/Copper/etc.)
          </button>

          {/* Multi-Tier Summary */}
          <div className="mt-4 p-3 bg-surface-container-high rounded border border-outline-variant">
            <div className="text-sm text-on-surface-variant">
              <span className="text-primary font-semibold">
                {(division.playoffTiers || []).length} tiers
              </span>
              {' → '}
              {(division.playoffTiers || []).map((t, i) => (
                <span key={t.id}>
                  {i > 0 && ' | '}
                  <span className="text-on-surface">{t.name}</span>
                  <span className="text-on-surface-variant"> (Pos {t.positions})</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Playoff Settings - For single-elim, double-elim, and groups format */}
      {!isMultiTier && (
        <div className="bg-surface-container-high p-6">
          <h3 className="font-headline text-lg text-primary mb-4">PLAYOFF SETTINGS</h3>

          {/* Format Selection */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 pb-6 border-b border-outline-variant">
            <div>
              <label className="block text-on-surface-variant text-sm mb-1">Elimination Format</label>
              {isPlayoffFormatLocked ? (
                <div className="w-full bg-surface-container-high border border-outline-variant rounded px-3 py-2 text-on-surface-variant flex items-center justify-between">
                  <span>
                    {effectivePlayoffFormat === 'single'
                      ? 'Single Elimination'
                      : 'Double Elimination'}
                  </span>
                  <span className="text-xs text-primary">Locked by format</span>
                </div>
              ) : (
                <select
                  value={division.playoffFormat || 'single'}
                  onChange={(e) => handlePlayoffFormatChange(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant rounded px-3 py-2 text-on-surface"
                >
                  <option value="single">Single Elimination</option>
                  <option value="double">Double Elimination</option>
                </select>
              )}
            </div>
            <div>
              <label className="block text-on-surface-variant text-sm mb-1">Playoff Teams</label>
              <select
                value={playoffTeams}
                onChange={(e) => handlePlayoffTeamsChange(parseInt(e.target.value))}
                className="w-full bg-surface-container-high border border-outline-variant rounded px-3 py-2 text-on-surface"
              >
                <option value={4}>4 Teams</option>
                <option value={8}>8 Teams</option>
                <option value={12}>12 Teams</option>
                <option value={16}>16 Teams</option>
                <option value={32}>32 Teams</option>
              </select>
            </div>
            {isDoubleElim && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="bracketReset"
                  checked={division.playoffBracketReset !== false}
                  onChange={(e) => handleUpdate('playoffBracketReset', e.target.checked)}
                  className="accent-primary"
                />
                <label htmlFor="bracketReset" className="text-on-surface-variant text-sm">
                  Allow Bracket Reset
                </label>
              </div>
            )}
          </div>

          {/* Series Format — compact default, expandable per-round */}
          <div className="mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-on-surface-variant text-sm mb-1">All Rounds</label>
                <div className="flex gap-1">
                  <select
                    value={division.playoffSFType || 'bestof'}
                    onChange={(e) =>
                      handleBulkRoundFormat(e.target.value, division.playoffSFBestOf || 3)
                    }
                    className="flex-1 bg-surface-container-high border border-outline-variant rounded px-1 py-2 text-on-surface text-sm"
                  >
                    <option value="bestof">Bo</option>
                    <option value="playall">Go</option>
                  </select>
                  <select
                    value={division.playoffSFBestOf || 3}
                    onChange={(e) =>
                      handleBulkRoundFormat(
                        division.playoffSFType || 'bestof',
                        parseInt(e.target.value)
                      )
                    }
                    className="w-12 bg-surface-container-high border border-outline-variant rounded px-1 py-2 text-on-surface text-sm"
                  >
                    {[1, 3, 5, 7].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <FormatSelect
                label={isDoubleElim ? 'Winners Final' : 'Final'}
                typeValue={division.playoffFinalType || 'bestof'}
                countValue={division.playoffFinalBestOf || 5}
                onTypeChange={(v) => handleUpdate('playoffFinalType', v)}
                onCountChange={(v) => handleUpdate('playoffFinalBestOf', v)}
              />
              {isDoubleElim && (
                <FormatSelect
                  label="Grand Final"
                  typeValue={division.playoffGrandFinalType || 'bestof'}
                  countValue={division.playoffGrandFinalBestOf || 5}
                  onTypeChange={(v) => handleUpdate('playoffGrandFinalType', v)}
                  onCountChange={(v) => handleUpdate('playoffGrandFinalBestOf', v)}
                />
              )}
              {!isDoubleElim && (
                <div>
                  <label className="block text-on-surface-variant text-sm mb-1">3rd Place Match</label>
                  <div className="flex gap-1">
                    <select
                      value={
                        division.playoff3rdBestOf === 0
                          ? 'skip'
                          : division.playoff3rdType || 'bestof'
                      }
                      onChange={(e) => {
                        if (e.target.value === 'skip') handleUpdate('playoff3rdBestOf', 0);
                        else {
                          handleUpdate('playoff3rdType', e.target.value);
                          if (division.playoff3rdBestOf === 0) handleUpdate('playoff3rdBestOf', 3);
                        }
                      }}
                      className="flex-1 bg-surface-container-high border border-outline-variant rounded px-1 py-2 text-on-surface text-sm"
                    >
                      <option value="skip">Skip</option>
                      <option value="bestof">Bo</option>
                      <option value="playall">Go</option>
                    </select>
                    {division.playoff3rdBestOf > 0 && (
                      <select
                        value={division.playoff3rdBestOf}
                        onChange={(e) => handleUpdate('playoff3rdBestOf', parseInt(e.target.value))}
                        className="w-12 bg-surface-container-high border border-outline-variant rounded px-1 py-2 text-on-surface text-sm"
                      >
                        {[1, 3, 5].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Customize per round toggle */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowCustomRounds(!showCustomRounds)}
                className="text-sm text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1"
              >
                <span className={`transition-transform ${showCustomRounds ? 'rotate-90' : ''}`}>
                  &#9656;
                </span>
                Customize per round
                {roundsAreCustomized && !showCustomRounds && (
                  <span className="ml-1 px-1.5 py-0.5 bg-primary/20 text-primary text-xs rounded">
                    customized
                  </span>
                )}
              </button>
              {showCustomRounds && (
                <div className="mt-3 pt-3 border-t border-outline-variant/50 space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-on-surface mb-3">
                      {isDoubleElim ? '🏆 Winners Bracket' : 'Bracket Rounds'}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {playoffTeams >= 32 && (
                        <FormatSelect
                          label="Round of 32"
                          typeValue={division.playoffR32Type || 'bestof'}
                          countValue={division.playoffR32BestOf || 3}
                          onTypeChange={(v) => handleUpdate('playoffR32Type', v)}
                          onCountChange={(v) => handleUpdate('playoffR32BestOf', v)}
                        />
                      )}
                      {playoffTeams >= 16 && (
                        <FormatSelect
                          label="Round of 16"
                          typeValue={division.playoffR16Type || 'bestof'}
                          countValue={division.playoffR16BestOf || 3}
                          onTypeChange={(v) => handleUpdate('playoffR16Type', v)}
                          onCountChange={(v) => handleUpdate('playoffR16BestOf', v)}
                        />
                      )}
                      {playoffTeams >= 8 && (
                        <FormatSelect
                          label="Quarter Finals"
                          typeValue={division.playoffQFType || 'bestof'}
                          countValue={division.playoffQFBestOf || 3}
                          onTypeChange={(v) => handleUpdate('playoffQFType', v)}
                          onCountChange={(v) => handleUpdate('playoffQFBestOf', v)}
                        />
                      )}
                      <FormatSelect
                        label="Semi Finals"
                        typeValue={division.playoffSFType || 'bestof'}
                        countValue={division.playoffSFBestOf || 3}
                        onTypeChange={(v) => handleUpdate('playoffSFType', v)}
                        onCountChange={(v) => handleUpdate('playoffSFBestOf', v)}
                      />
                    </div>
                  </div>
                  {isDoubleElim && (
                    <div>
                      <h4 className="text-sm font-semibold text-on-surface mb-3">💀 Losers Bracket</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <FormatSelect
                          label="Losers Rounds"
                          typeValue={division.playoffLosersType || 'bestof'}
                          countValue={division.playoffLosersBestOf || 3}
                          onTypeChange={(v) => handleUpdate('playoffLosersType', v)}
                          onCountChange={(v) => handleUpdate('playoffLosersBestOf', v)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Structure Preview */}
          <div className="p-3 bg-surface-container-high rounded border border-outline-variant">
            <div className="text-sm text-on-surface-variant">
              {isDoubleElim ? (
                <>
                  <div className="mb-1">
                    <span className="text-primary">Winners:</span>{' '}
                    {playoffTeams >= 32 &&
                      `R32 (${formatDisplay(division.playoffR32Type || 'bestof', division.playoffR32BestOf || 3)}) → `}
                    {playoffTeams >= 16 &&
                      `R16 (${formatDisplay(division.playoffR16Type || 'bestof', division.playoffR16BestOf || 3)}) → `}
                    {playoffTeams >= 8 &&
                      `QF (${formatDisplay(division.playoffQFType || 'bestof', division.playoffQFBestOf || 3)}) → `}
                    SF (
                    {formatDisplay(
                      division.playoffSFType || 'bestof',
                      division.playoffSFBestOf || 3
                    )}
                    ) → WF (
                    {formatDisplay(
                      division.playoffFinalType || 'bestof',
                      division.playoffFinalBestOf || 5
                    )}
                    )
                  </div>
                  <div className="mb-1">
                    <span className="text-primary">Losers:</span>{' '}
                    {playoffTeams >= 32 && '6 rounds'}
                    {playoffTeams >= 16 && playoffTeams < 32 && '4 rounds'}
                    {playoffTeams >= 8 && playoffTeams < 16 && '3 rounds'}
                    {playoffTeams < 8 && '2 rounds'} (
                    {formatDisplay(
                      division.playoffLosersType || 'bestof',
                      division.playoffLosersBestOf || 3
                    )}
                    )
                  </div>
                  <div>
                    <span className="text-primary">Grand Final:</span>{' '}
                    {formatDisplay(
                      division.playoffGrandFinalType || 'bestof',
                      division.playoffGrandFinalBestOf || 5
                    )}
                    {division.playoffBracketReset !== false && ' + potential reset'}
                  </div>
                </>
              ) : (
                <span className="text-on-surface">
                  {playoffTeams >= 32 &&
                    `R32 (${formatDisplay(division.playoffR32Type || 'bestof', division.playoffR32BestOf || 3)}) → `}
                  {playoffTeams >= 16 &&
                    `R16 (${formatDisplay(division.playoffR16Type || 'bestof', division.playoffR16BestOf || 3)}) → `}
                  {playoffTeams >= 8 &&
                    `QF (${formatDisplay(division.playoffQFType || 'bestof', division.playoffQFBestOf || 3)}) → `}
                  SF (
                  {formatDisplay(division.playoffSFType || 'bestof', division.playoffSFBestOf || 3)}
                  ) → Final (
                  {formatDisplay(
                    division.playoffFinalType || 'bestof',
                    division.playoffFinalBestOf || 5
                  )}
                  )
                  {division.playoff3rdBestOf > 0 &&
                    ` + 3rd (${formatDisplay(division.playoff3rdType || 'bestof', division.playoff3rdBestOf)})`}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Advanced Settings — collapsed by default */}
      <div className="bg-surface-container-high overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-container-high/30 transition-colors"
        >
          <div>
            <h3 className="font-headline text-lg text-primary text-left">ADVANCED SETTINGS</h3>
            {!showAdvanced && (
              <p className="text-sm text-on-surface-variant mt-1 text-left">
                Win: {division.pointsWin} pts, Loss: {division.pointsLoss} pts
                {(division.format === 'groups' || division.format === 'multi-tier') && (
                  <span>
                    {' | Tie-break: '}
                    {(division.tieBreakers || ['mapDiff', 'fragDiff', 'headToHead'])
                      .map((tb, i) => {
                        const labels = {
                          mapDiff: 'Map Diff',
                          fragDiff: 'Frag Diff',
                          headToHead: 'H2H',
                        };
                        return (i > 0 ? ' \u2192 ' : '') + (labels[tb] || tb);
                      })
                      .join('')}
                  </span>
                )}
              </p>
            )}
          </div>
          <span
            className={`text-on-surface-variant text-lg transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
          >
            &#9656;
          </span>
        </button>
        {showAdvanced && (
          <div className="px-6 pb-6 space-y-6 border-t border-outline-variant">
            {/* Points System */}
            <div className="pt-6">
              <h4 className="text-sm font-semibold text-on-surface mb-3">Points System</h4>
              <div className="mb-4 p-3 bg-surface-container-high rounded border border-outline-variant text-sm">
                {isPlayAll ? (
                  <div className="text-primary">
                    <strong>Play All (Go) Mode:</strong> Points awarded per map.
                  </div>
                ) : (
                  <div className="text-on-surface-variant">
                    <strong>Best Of Mode:</strong> Points awarded per series.
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-on-surface-variant text-sm mb-1">
                    {isPlayAll ? 'Points per Map Win' : 'Points for Series Win'}
                  </label>
                  <input
                    type="number"
                    value={division.pointsWin}
                    onChange={(e) => handleUpdate('pointsWin', parseInt(e.target.value) || 0)}
                    className="w-full bg-surface-container-high border border-outline-variant rounded px-3 py-2 text-on-surface"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-on-surface-variant text-sm mb-1">
                    {isPlayAll ? 'Points per Map Loss' : 'Points for Series Loss'}
                  </label>
                  <input
                    type="number"
                    value={division.pointsLoss}
                    onChange={(e) => handleUpdate('pointsLoss', parseInt(e.target.value) || 0)}
                    className="w-full bg-surface-container-high border border-outline-variant rounded px-3 py-2 text-on-surface"
                    min={0}
                  />
                </div>
              </div>
            </div>

            {/* Tie-Breakers - Only for formats with group stage */}
            {(division.format === 'groups' || division.format === 'multi-tier') && (
              <div>
                <h4 className="text-sm font-semibold text-on-surface mb-3">Tie-Breaker Priority</h4>
                <p className="text-sm text-on-surface-variant mb-4">When teams have equal points:</p>
                <TieBreakerConfig
                  value={division.tieBreakers}
                  onChange={(newOrder) => handleUpdate('tieBreakers', newOrder)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
