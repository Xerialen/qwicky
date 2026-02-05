// src/components/division/DivisionSetup.jsx
import React, { useEffect } from 'react';
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
      <label className="block text-qw-muted text-sm mb-1">Tie-Breaker Priority</label>
      <div className="space-y-1">
        {tieBreakers.map((tbId, idx) => {
          const opt = options.find(o => o.id === tbId);
          return (
            <div key={tbId} className="flex items-center gap-2 p-2 bg-qw-dark rounded border border-qw-border">
              <span className="text-qw-accent font-mono text-sm w-5">{idx + 1}.</span>
              <div className="flex-1">
                <span className="text-white text-sm font-semibold">{opt?.label || tbId}</span>
                <span className="text-qw-muted text-xs ml-2">({opt?.desc})</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => moveUp(idx)} disabled={idx === 0} className="px-2 py-1 text-xs bg-qw-darker rounded hover:bg-qw-border disabled:opacity-30">↑</button>
                <button onClick={() => moveDown(idx)} disabled={idx === tieBreakers.length - 1} className="px-2 py-1 text-xs bg-qw-darker rounded hover:bg-qw-border disabled:opacity-30">↓</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FormatSelect({ typeValue, countValue, onTypeChange, onCountChange, label, counts = [1, 3, 5, 7] }) {
  return (
    <div>
      <label className="block text-qw-muted text-sm mb-1">{label}</label>
      <div className="flex gap-1">
        <select value={typeValue} onChange={(e) => onTypeChange(e.target.value)} className="flex-1 bg-qw-dark border border-qw-border rounded px-1 py-2 text-white text-sm">
          <option value="bestof">Bo</option>
          <option value="playall">Go</option>
        </select>
        <select value={countValue} onChange={(e) => onCountChange(parseInt(e.target.value))} className="w-12 bg-qw-dark border border-qw-border rounded px-1 py-2 text-white text-sm">
          {counts.map(n => <option key={n} value={n}>{n}</option>)}
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
      bracket: createDefaultBracket('single', 4)
    },
    {
      id: 'silver',
      name: 'Silver Playoffs',
      positions: '5-8',
      type: 'single',
      teams: 4,
      bracket: createDefaultBracket('single', 4)
    }
  ];

  // Sync playoffFormat when division format changes (fixes immediate update issue)
  useEffect(() => {
    const divFormat = division.format;
    const currentPlayoffFormat = division.playoffFormat || 'single';

    // When format is explicitly single or double elimination, sync the playoff format
    if (divFormat === 'single-elim' && currentPlayoffFormat !== 'single') {
      updateDivision({
        playoffFormat: 'single',
        bracket: createDefaultBracket('single', division.playoffTeams || 4)
      });
    } else if (divFormat === 'double-elim' && currentPlayoffFormat !== 'double') {
      updateDivision({
        playoffFormat: 'double',
        bracket: createDefaultBracket('double', division.playoffTeams || 4)
      });
    } else if (divFormat === 'multi-tier' && !division.playoffTiers) {
      // Initialize default tiers for multi-tier format
      updateDivision({
        playoffTiers: createDefaultTiers()
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

  const isPlayAll = (division.groupStageType || 'bestof') === 'playall';
  const effectivePlayoffFormat = getEffectivePlayoffFormat();
  const isDoubleElim = effectivePlayoffFormat === 'double';
  const playoffTeams = division.playoffTeams || 4;

  // Check if format is locked by division format selection
  const isPlayoffFormatLocked = division.format === 'single-elim' || division.format === 'double-elim';
  const isMultiTier = division.format === 'multi-tier';

  // Multi-tier helper functions
  const handleAddTier = () => {
    const tiers = division.playoffTiers || [];
    const tierNames = ['Bronze', 'Copper', 'Iron', 'Wood', 'Stone'];
    const usedNames = tiers.map(t => t.name.split(' ')[0]);
    const nextName = tierNames.find(n => !usedNames.includes(n)) || `Tier ${tiers.length + 1}`;
    const lastTier = tiers[tiers.length - 1];
    const lastEndPos = lastTier ? parseInt(lastTier.positions.split('-')[1]) : 4;

    const newTier = {
      id: `tier-${Date.now()}`,
      name: `${nextName} Playoffs`,
      positions: `${lastEndPos + 1}-${lastEndPos + 4}`,
      type: 'single',
      teams: 4,
      bracket: createDefaultBracket('single', 4)
    };

    updateDivision({ playoffTiers: [...tiers, newTier] });
  };

  const handleRemoveTier = (tierId) => {
    const tiers = division.playoffTiers || [];
    if (tiers.length <= 1) return; // Keep at least one tier
    updateDivision({ playoffTiers: tiers.filter(t => t.id !== tierId) });
  };

  const handleUpdateTier = (tierId, field, value) => {
    const tiers = division.playoffTiers || [];
    const updatedTiers = tiers.map(t => {
      if (t.id !== tierId) return t;

      // If changing type or teams, recreate the bracket
      if (field === 'type' || field === 'teams') {
        const newType = field === 'type' ? value : t.type;
        const newTeams = field === 'teams' ? value : t.teams;
        return {
          ...t,
          [field]: value,
          bracket: createDefaultBracket(newType, newTeams)
        };
      }

      return { ...t, [field]: value };
    });

    updateDivision({ playoffTiers: updatedTiers });
  };

  return (
    <div className="space-y-6">
      {/* Division Info */}
      <div className="qw-panel p-6">
        <h3 className="font-display text-lg text-qw-accent mb-4">DIVISION INFO</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-qw-muted text-sm mb-1">Division Name</label>
            <input type="text" value={division.name} onChange={(e) => handleUpdate('name', e.target.value)} className="w-full bg-qw-dark border border-qw-border rounded px-4 py-2 text-white" />
          </div>
          <div>
            <label className="block text-qw-muted text-sm mb-1">Format</label>
            <select value={division.format} onChange={(e) => handleUpdate('format', e.target.value)} className="w-full bg-qw-dark border border-qw-border rounded px-4 py-2 text-white">
              <option value="groups">Groups → Playoffs</option>
              <option value="single-elim">Single Elimination Only</option>
              <option value="double-elim">Double Elimination Only</option>
              <option value="multi-tier">Groups → Multi-Tier Playoffs</option>
            </select>
          </div>
        </div>
      </div>

      {/* Group Stage Settings */}
      {(division.format === 'groups' || division.format === 'multi-tier') && (
        <div className="qw-panel p-6">
          <h3 className="font-display text-lg text-qw-accent mb-4">GROUP STAGE</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-qw-muted text-sm mb-1">Number of Groups</label>
              <select value={division.numGroups} onChange={(e) => handleUpdate('numGroups', parseInt(e.target.value))} className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white">
                {[1, 2, 3, 4, 6, 8].map(n => <option key={n} value={n}>{n} Group{n > 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-qw-muted text-sm mb-1">Teams per Group</label>
              <select value={division.teamsPerGroup} onChange={(e) => handleUpdate('teamsPerGroup', parseInt(e.target.value))} className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white">
                {[2, 3, 4, 5, 6, 8, 10, 12].map(n => <option key={n} value={n}>{n} Teams</option>)}
              </select>
            </div>
            <div>
              <label className="block text-qw-muted text-sm mb-1">Meetings per Matchup</label>
              <select value={division.groupMeetings || 1} onChange={(e) => handleUpdate('groupMeetings', parseInt(e.target.value))} className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white">
                <option value={1}>Once (single round-robin)</option>
                <option value={2}>Twice (double round-robin)</option>
                <option value={3}>Three times</option>
                <option value={4}>Four times</option>
              </select>
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="block text-qw-muted text-sm mb-1">Series Format</label>
              <div className="flex gap-2">
                <select value={division.groupStageType || 'bestof'} onChange={(e) => handleUpdate('groupStageType', e.target.value)} className="flex-1 bg-qw-dark border border-qw-border rounded px-2 py-2 text-white">
                  <option value="bestof">Best Of (Bo)</option>
                  <option value="playall">Play All (Go)</option>
                </select>
                <select value={division.groupStageBestOf} onChange={(e) => handleUpdate('groupStageBestOf', parseInt(e.target.value))} className="w-16 bg-qw-dark border border-qw-border rounded px-2 py-2 text-white">
                  {[1, 2, 3, 5, 7].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-qw-muted text-sm mb-1">Advance to Playoffs</label>
              {isMultiTier ? (
                <div className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-qw-muted flex items-center justify-between">
                  <span>Set per tier</span>
                  <span className="text-xs text-qw-accent">Locked by format</span>
                </div>
              ) : (
                <select value={division.advanceCount} onChange={(e) => handleUpdate('advanceCount', parseInt(e.target.value))} className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white">
                  {[1, 2, 3, 4, 5, 6, 8].map(n => <option key={n} value={n}>Top {n}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="block text-qw-muted text-sm mb-1">Expected Pace</label>
              <select value={division.matchPace || 'weekly'} onChange={(e) => handleUpdate('matchPace', e.target.value)} className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white">
                <option value="daily">Daily</option>
                <option value="twice-weekly">2 games/week</option>
                <option value="weekly">1 game/week</option>
                <option value="biweekly">1 game/2 weeks</option>
                <option value="flexible">Flexible</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-qw-dark rounded border border-qw-border">
            <div className="text-sm text-qw-muted">
              <span className="text-white font-semibold">{division.numGroups} group{division.numGroups > 1 ? 's' : ''} × {division.teamsPerGroup} teams</span>
              {' = '}
              <span className="text-qw-accent">{(division.teamsPerGroup * (division.teamsPerGroup - 1) / 2) * (division.groupMeetings || 1) * division.numGroups} group stage matches</span>
              {' • '}
              <span className="text-white">{formatDisplay(division.groupStageType || 'bestof', division.groupStageBestOf)}</span>
            </div>
            {isPlayAll && <div className="text-xs text-qw-accent mt-1">⚠️ Play All mode: All maps played, points per map.</div>}
          </div>
        </div>
      )}

      {/* Playoff Settings - Multi-Tier Format */}
      {isMultiTier && (
        <div className="qw-panel p-6">
          <h3 className="font-display text-lg text-qw-accent mb-4">MULTI-TIER PLAYOFFS</h3>
          <p className="text-sm text-qw-muted mb-4">Configure multiple independent playoff brackets for different tier ranges (Gold/Silver/Bronze).</p>

          {/* Tier Cards */}
          <div className="space-y-4">
            {(division.playoffTiers || []).map((tier, index) => {
              const tierIsDoubleElim = tier.type === 'double';
              return (
                <div key={tier.id} className="bg-qw-dark rounded border border-qw-border p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {tier.id === 'gold' ? '🥇' : tier.id === 'silver' ? '🥈' : tier.id === 'bronze' ? '🥉' : '🏅'}
                      </span>
                      <input
                        type="text"
                        value={tier.name}
                        onChange={(e) => handleUpdateTier(tier.id, 'name', e.target.value)}
                        className="bg-transparent border-b border-qw-border text-white font-semibold px-1"
                      />
                    </div>
                    {index > 0 && (
                      <button
                        onClick={() => handleRemoveTier(tier.id)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-qw-muted text-xs mb-1">Positions</label>
                      <input
                        type="text"
                        value={tier.positions}
                        onChange={(e) => handleUpdateTier(tier.id, 'positions', e.target.value)}
                        placeholder="e.g., 1-4"
                        className="w-full bg-qw-darker border border-qw-border rounded px-2 py-1.5 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-qw-muted text-xs mb-1">Bracket Type</label>
                      <select
                        value={tier.type}
                        onChange={(e) => handleUpdateTier(tier.id, 'type', e.target.value)}
                        className="w-full bg-qw-darker border border-qw-border rounded px-2 py-1.5 text-white text-sm"
                      >
                        <option value="single">Single Elimination</option>
                        <option value="double">Double Elimination</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-qw-muted text-xs mb-1">Teams</label>
                      <select
                        value={tier.teams}
                        onChange={(e) => handleUpdateTier(tier.id, 'teams', parseInt(e.target.value))}
                        className="w-full bg-qw-darker border border-qw-border rounded px-2 py-1.5 text-white text-sm"
                      >
                        <option value={4}>4 Teams</option>
                        <option value={8}>8 Teams</option>
                        <option value={16}>16 Teams</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-qw-muted text-xs mb-1">Series Format</label>
                      <div className="flex gap-1">
                        <select
                          value={tier.seriesType || 'bestof'}
                          onChange={(e) => handleUpdateTier(tier.id, 'seriesType', e.target.value)}
                          className="flex-1 bg-qw-darker border border-qw-border rounded px-1 py-1.5 text-white text-sm"
                        >
                          <option value="bestof">Bo</option>
                          <option value="playall">Go</option>
                        </select>
                        <select
                          value={tier.seriesCount || 3}
                          onChange={(e) => handleUpdateTier(tier.id, 'seriesCount', parseInt(e.target.value))}
                          className="w-12 bg-qw-darker border border-qw-border rounded px-1 py-1.5 text-white text-sm"
                        >
                          {[1, 3, 5, 7].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Double Elim specific options */}
                  {tierIsDoubleElim && (
                    <div className="mt-4 pt-4 border-t border-qw-border/50">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-qw-muted text-xs mb-1">Losers Bo</label>
                          <select
                            value={tier.losersBo || 3}
                            onChange={(e) => handleUpdateTier(tier.id, 'losersBo', parseInt(e.target.value))}
                            className="w-full bg-qw-darker border border-qw-border rounded px-2 py-1.5 text-white text-sm"
                          >
                            {[1, 3, 5].map(n => <option key={n} value={n}>Bo{n}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-qw-muted text-xs mb-1">Grand Final</label>
                          <select
                            value={tier.grandFinalBo || 5}
                            onChange={(e) => handleUpdateTier(tier.id, 'grandFinalBo', parseInt(e.target.value))}
                            className="w-full bg-qw-darker border border-qw-border rounded px-2 py-1.5 text-white text-sm"
                          >
                            {[3, 5, 7].map(n => <option key={n} value={n}>Bo{n}</option>)}
                          </select>
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-2 text-qw-muted text-sm">
                            <input
                              type="checkbox"
                              checked={tier.bracketReset !== false}
                              onChange={(e) => handleUpdateTier(tier.id, 'bracketReset', e.target.checked)}
                              className="accent-qw-accent"
                            />
                            Bracket Reset
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tier Summary */}
                  <div className="mt-3 p-2 bg-qw-darker/50 rounded text-xs text-qw-muted">
                    {tierIsDoubleElim ? (
                      <span>
                        Double Elim: {tier.teams} teams • {formatDisplay(tier.seriesType || 'bestof', tier.seriesCount || 3)} •
                        GF Bo{tier.grandFinalBo || 5} {tier.bracketReset !== false ? '+ reset' : ''}
                      </span>
                    ) : (
                      <span>
                        Single Elim: {tier.teams} teams • {formatDisplay(tier.seriesType || 'bestof', tier.seriesCount || 3)}
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
            className="mt-4 w-full py-2 border-2 border-dashed border-qw-border rounded text-qw-muted hover:text-white hover:border-qw-accent transition-colors"
          >
            + Add Another Tier (Bronze/Copper/etc.)
          </button>

          {/* Multi-Tier Summary */}
          <div className="mt-4 p-3 bg-qw-dark rounded border border-qw-border">
            <div className="text-sm text-qw-muted">
              <span className="text-qw-accent font-semibold">{(division.playoffTiers || []).length} tiers</span>
              {' → '}
              {(division.playoffTiers || []).map((t, i) => (
                <span key={t.id}>
                  {i > 0 && ' | '}
                  <span className="text-white">{t.name}</span>
                  <span className="text-qw-muted"> (Pos {t.positions})</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Playoff Settings - Standard Format */}
      {!isMultiTier && (
        <div className="qw-panel p-6">
          <h3 className="font-display text-lg text-qw-accent mb-4">PLAYOFFS</h3>

          {/* Format Selection */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 pb-6 border-b border-qw-border">
            <div>
              <label className="block text-qw-muted text-sm mb-1">Elimination Format</label>
              {isPlayoffFormatLocked ? (
                <div className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-qw-muted flex items-center justify-between">
                  <span>{effectivePlayoffFormat === 'single' ? 'Single Elimination' : 'Double Elimination'}</span>
                  <span className="text-xs text-qw-accent">Locked by format</span>
                </div>
              ) : (
                <select value={division.playoffFormat || 'single'} onChange={(e) => handlePlayoffFormatChange(e.target.value)} className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white">
                  <option value="single">Single Elimination</option>
                  <option value="double">Double Elimination</option>
                </select>
              )}
            </div>
            <div>
              <label className="block text-qw-muted text-sm mb-1">Playoff Teams</label>
              <select value={playoffTeams} onChange={(e) => handlePlayoffTeamsChange(parseInt(e.target.value))} className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white">
                <option value={4}>4 Teams</option>
                <option value={8}>8 Teams</option>
                <option value={12}>12 Teams</option>
                <option value={16}>16 Teams</option>
                <option value={32}>32 Teams</option>
              </select>
            </div>
            {isDoubleElim && (
              <div className="flex items-center gap-2">
                <input type="checkbox" id="bracketReset" checked={division.playoffBracketReset !== false} onChange={(e) => handleUpdate('playoffBracketReset', e.target.checked)} className="accent-qw-accent" />
                <label htmlFor="bracketReset" className="text-qw-muted text-sm">Allow Bracket Reset</label>
              </div>
            )}
          </div>

          {/* Winners Bracket */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-white mb-3">{isDoubleElim ? '🏆 Winners Bracket' : 'Bracket Rounds'}</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {playoffTeams >= 32 && (
                <FormatSelect label="Round of 32" typeValue={division.playoffR32Type || 'bestof'} countValue={division.playoffR32BestOf || 3} onTypeChange={(v) => handleUpdate('playoffR32Type', v)} onCountChange={(v) => handleUpdate('playoffR32BestOf', v)} />
              )}
              {playoffTeams >= 16 && (
                <FormatSelect label="Round of 16" typeValue={division.playoffR16Type || 'bestof'} countValue={division.playoffR16BestOf || 3} onTypeChange={(v) => handleUpdate('playoffR16Type', v)} onCountChange={(v) => handleUpdate('playoffR16BestOf', v)} />
              )}
              {playoffTeams >= 8 && (
                <FormatSelect label="Quarter Finals" typeValue={division.playoffQFType || 'bestof'} countValue={division.playoffQFBestOf || 3} onTypeChange={(v) => handleUpdate('playoffQFType', v)} onCountChange={(v) => handleUpdate('playoffQFBestOf', v)} />
              )}
              <FormatSelect label="Semi Finals" typeValue={division.playoffSFType || 'bestof'} countValue={division.playoffSFBestOf || 3} onTypeChange={(v) => handleUpdate('playoffSFType', v)} onCountChange={(v) => handleUpdate('playoffSFBestOf', v)} />
              <FormatSelect label={isDoubleElim ? "Winners Final" : "Final"} typeValue={division.playoffFinalType || 'bestof'} countValue={division.playoffFinalBestOf || 5} onTypeChange={(v) => handleUpdate('playoffFinalType', v)} onCountChange={(v) => handleUpdate('playoffFinalBestOf', v)} />
              {!isDoubleElim && (
                <div>
                  <label className="block text-qw-muted text-sm mb-1">3rd Place Match</label>
                  <div className="flex gap-1">
                    <select value={division.playoff3rdBestOf === 0 ? 'skip' : (division.playoff3rdType || 'bestof')} onChange={(e) => { if (e.target.value === 'skip') handleUpdate('playoff3rdBestOf', 0); else { handleUpdate('playoff3rdType', e.target.value); if (division.playoff3rdBestOf === 0) handleUpdate('playoff3rdBestOf', 3); } }} className="flex-1 bg-qw-dark border border-qw-border rounded px-1 py-2 text-white text-sm">
                      <option value="skip">Skip</option>
                      <option value="bestof">Bo</option>
                      <option value="playall">Go</option>
                    </select>
                    {division.playoff3rdBestOf > 0 && (
                      <select value={division.playoff3rdBestOf} onChange={(e) => handleUpdate('playoff3rdBestOf', parseInt(e.target.value))} className="w-12 bg-qw-dark border border-qw-border rounded px-1 py-2 text-white text-sm">
                        {[1, 3, 5].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Losers Bracket - only for double elim */}
          {isDoubleElim && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-white mb-3">💀 Losers Bracket</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FormatSelect label="Losers Rounds" typeValue={division.playoffLosersType || 'bestof'} countValue={division.playoffLosersBestOf || 3} onTypeChange={(v) => handleUpdate('playoffLosersType', v)} onCountChange={(v) => handleUpdate('playoffLosersBestOf', v)} />
                <FormatSelect label="Grand Final" typeValue={division.playoffGrandFinalType || 'bestof'} countValue={division.playoffGrandFinalBestOf || 5} onTypeChange={(v) => handleUpdate('playoffGrandFinalType', v)} onCountChange={(v) => handleUpdate('playoffGrandFinalBestOf', v)} />
              </div>
            </div>
          )}

          {/* Structure Preview */}
          <div className="p-3 bg-qw-dark rounded border border-qw-border">
            <div className="text-sm text-qw-muted">
              {isDoubleElim ? (
                <>
                  <div className="mb-1">
                    <span className="text-qw-accent">Winners:</span>{' '}
                    {playoffTeams >= 32 && `R32 (${formatDisplay(division.playoffR32Type || 'bestof', division.playoffR32BestOf || 3)}) → `}
                    {playoffTeams >= 16 && `R16 (${formatDisplay(division.playoffR16Type || 'bestof', division.playoffR16BestOf || 3)}) → `}
                    {playoffTeams >= 8 && `QF (${formatDisplay(division.playoffQFType || 'bestof', division.playoffQFBestOf || 3)}) → `}
                    SF ({formatDisplay(division.playoffSFType || 'bestof', division.playoffSFBestOf || 3)}) →
                    WF ({formatDisplay(division.playoffFinalType || 'bestof', division.playoffFinalBestOf || 5)})
                  </div>
                  <div className="mb-1">
                    <span className="text-qw-accent">Losers:</span>{' '}
                    {playoffTeams >= 32 && '6 rounds'}
                    {playoffTeams >= 16 && playoffTeams < 32 && '4 rounds'}
                    {playoffTeams >= 8 && playoffTeams < 16 && '3 rounds'}
                    {playoffTeams < 8 && '2 rounds'} ({formatDisplay(division.playoffLosersType || 'bestof', division.playoffLosersBestOf || 3)})
                  </div>
                  <div>
                    <span className="text-qw-accent">Grand Final:</span>{' '}
                    {formatDisplay(division.playoffGrandFinalType || 'bestof', division.playoffGrandFinalBestOf || 5)}
                    {division.playoffBracketReset !== false && ' + potential reset'}
                  </div>
                </>
              ) : (
                <span className="text-white">
                  {playoffTeams >= 32 && `R32 (${formatDisplay(division.playoffR32Type || 'bestof', division.playoffR32BestOf || 3)}) → `}
                  {playoffTeams >= 16 && `R16 (${formatDisplay(division.playoffR16Type || 'bestof', division.playoffR16BestOf || 3)}) → `}
                  {playoffTeams >= 8 && `QF (${formatDisplay(division.playoffQFType || 'bestof', division.playoffQFBestOf || 3)}) → `}
                  SF ({formatDisplay(division.playoffSFType || 'bestof', division.playoffSFBestOf || 3)}) →
                  Final ({formatDisplay(division.playoffFinalType || 'bestof', division.playoffFinalBestOf || 5)})
                  {division.playoff3rdBestOf > 0 && ` + 3rd (${formatDisplay(division.playoff3rdType || 'bestof', division.playoff3rdBestOf)})`}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Points System */}
      <div className="qw-panel p-6">
        <h3 className="font-display text-lg text-qw-accent mb-4">POINTS SYSTEM</h3>
        <div className="mb-4 p-3 bg-qw-dark rounded border border-qw-border text-sm">
          {isPlayAll ? (
            <div className="text-qw-accent"><strong>Play All (Go) Mode:</strong> Points awarded per map.</div>
          ) : (
            <div className="text-qw-muted"><strong>Best Of Mode:</strong> Points awarded per series.</div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-qw-muted text-sm mb-1">{isPlayAll ? 'Points per Map Win' : 'Points for Series Win'}</label>
            <input type="number" value={division.pointsWin} onChange={(e) => handleUpdate('pointsWin', parseInt(e.target.value) || 0)} className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white" min={0} />
          </div>
          <div>
            <label className="block text-qw-muted text-sm mb-1">{isPlayAll ? 'Points per Map Loss' : 'Points for Series Loss'}</label>
            <input type="number" value={division.pointsLoss} onChange={(e) => handleUpdate('pointsLoss', parseInt(e.target.value) || 0)} className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white" min={0} />
          </div>
        </div>
      </div>

      {/* Tie-Breakers */}
      {(division.format === 'groups' || division.format === 'multi-tier') && (
        <div className="qw-panel p-6">
          <h3 className="font-display text-lg text-qw-accent mb-4">TIE-BREAKERS</h3>
          <p className="text-sm text-qw-muted mb-4">When teams have equal points:</p>
          <TieBreakerConfig value={division.tieBreakers} onChange={(newOrder) => handleUpdate('tieBreakers', newOrder)} />
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="qw-panel p-3 text-center">
          <div className="text-xl font-display font-bold text-qw-accent">{division.teams?.length || 0}</div>
          <div className="text-xs text-qw-muted">Teams</div>
        </div>
        <div className="qw-panel p-3 text-center">
          <div className="text-xl font-display font-bold text-white">{formatDisplay(division.groupStageType || 'bestof', division.groupStageBestOf)}</div>
          <div className="text-xs text-qw-muted">Groups</div>
        </div>
        <div className="qw-panel p-3 text-center">
          <div className="text-xl font-display font-bold text-white">{playoffTeams}</div>
          <div className="text-xs text-qw-muted">Playoff</div>
        </div>
        <div className="qw-panel p-3 text-center">
          <div className="text-lg font-display font-bold text-white">{isDoubleElim ? 'Double' : 'Single'}</div>
          <div className="text-xs text-qw-muted">Elim</div>
        </div>
        <div className="qw-panel p-3 text-center">
          <div className="text-xl font-display font-bold text-white">{division.numGroups * division.advanceCount}</div>
          <div className="text-xs text-qw-muted">Advance</div>
        </div>
      </div>
    </div>
  );
}
