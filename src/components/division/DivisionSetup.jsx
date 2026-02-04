// src/components/division/DivisionSetup.jsx
import React from 'react';
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

  const handlePlayoffFormatChange = (format) => {
    handleUpdate('playoffFormat', format);
    // Recreate bracket when format changes
    handleUpdate('bracket', createDefaultBracket(format, division.playoffTeams || 4));
  };

  const handlePlayoffTeamsChange = (teams) => {
    handleUpdate('playoffTeams', teams);
    // Recreate bracket when team count changes
    handleUpdate('bracket', createDefaultBracket(division.playoffFormat || 'single', teams));
  };

  const isPlayAll = (division.groupStageType || 'bestof') === 'playall';
  const isDoubleElim = (division.playoffFormat || 'single') === 'double';
  const playoffTeams = division.playoffTeams || 4;

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
            </select>
          </div>
        </div>
      </div>

      {/* Group Stage Settings */}
      {division.format === 'groups' && (
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
              <select value={division.advanceCount} onChange={(e) => handleUpdate('advanceCount', parseInt(e.target.value))} className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white">
                {[1, 2, 3, 4, 5, 6, 8].map(n => <option key={n} value={n}>Top {n}</option>)}
              </select>
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

      {/* Playoff Settings */}
      <div className="qw-panel p-6">
        <h3 className="font-display text-lg text-qw-accent mb-4">PLAYOFFS</h3>
        
        {/* Format Selection */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 pb-6 border-b border-qw-border">
          <div>
            <label className="block text-qw-muted text-sm mb-1">Elimination Format</label>
            <select value={division.playoffFormat || 'single'} onChange={(e) => handlePlayoffFormatChange(e.target.value)} className="w-full bg-qw-dark border border-qw-border rounded px-3 py-2 text-white">
              <option value="single">Single Elimination</option>
              <option value="double">Double Elimination</option>
            </select>
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
      {division.format === 'groups' && (
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
