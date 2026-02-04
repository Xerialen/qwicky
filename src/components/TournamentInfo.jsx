// src/components/TournamentInfo.jsx
import React from 'react';

export default function TournamentInfo({ division }) {
  const completedMatches = division?.schedule?.filter(m => m.status === 'completed').length || 0;
  const totalMatches = division?.schedule?.length || 0;
  const teamCount = division?.teams?.length || 0;
  
  return (
    <div className="qw-panel p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded bg-qw-accent/20 flex items-center justify-center">
            <span className="font-display font-bold text-qw-accent text-2xl">🏆</span>
          </div>
          <div>
            <h2 className="font-display font-bold text-2xl text-white">{division?.name || 'Tournament'}</h2>
            <p className="text-sm text-qw-muted">
              {teamCount} teams • {completedMatches}/{totalMatches} matches completed
            </p>
          </div>
        </div>
        <div className="flex gap-6">
          <div className="text-center">
            <div className="font-display text-3xl text-qw-accent">{teamCount}</div>
            <div className="text-xs text-qw-muted">TEAMS</div>
          </div>
          <div className="text-center">
            <div className="font-display text-3xl text-qw-win">{completedMatches}</div>
            <div className="text-xs text-qw-muted">PLAYED</div>
          </div>
          <div className="text-center">
            <div className="font-display text-3xl text-qw-text">{totalMatches - completedMatches}</div>
            <div className="text-xs text-qw-muted">REMAINING</div>
          </div>
        </div>
      </div>
    </div>
  );
}
