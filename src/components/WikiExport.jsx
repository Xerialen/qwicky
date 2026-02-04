// src/components/WikiExport.jsx
import React from 'react';
import DivisionWiki from './division/DivisionWiki';

export default function WikiExport({ division }) {
  if (!division) {
    return (
      <div className="qw-panel p-12 text-center">
        <div className="text-4xl mb-4">📝</div>
        <p className="text-qw-muted">No data available for wiki export</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="qw-panel p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-qw-accent/20 flex items-center justify-center">
            <span className="text-xl">📝</span>
          </div>
          <div>
            <h2 className="font-display font-bold text-xl text-white">Wiki Export</h2>
            <p className="text-sm text-qw-muted">
              Generate Liquipedia-compatible MediaWiki markup
            </p>
          </div>
        </div>
      </div>

      <DivisionWiki 
        division={division} 
        tournamentName={division.name || 'Tournament'} 
      />
    </div>
  );
}
