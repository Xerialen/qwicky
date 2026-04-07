// src/components/ScheduleView.jsx
import React, { useState } from 'react';

function GameCard({ game }) {
  const isPlayed = game.played === 1 || game.played === '1' || game.played === true;
  const hasWinner = game.mapsWonA !== '' && game.mapsWonB !== '';

  return (
    <div className="qw-panel p-6">
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm font-headline text-on-surface-variant">{game.round || 'Match'}</span>
        {game.date && <span className="text-sm text-on-surface-variant font-mono">{game.date}</span>}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 text-right">
          <div className="font-body font-bold text-lg text-on-surface">{game.teamA}</div>
        </div>

        <div className="mx-8 text-center">
          {hasWinner ? (
            <div className="font-headline text-2xl font-bold">
              <span
                className={
                  parseInt(game.mapsWonA) > parseInt(game.mapsWonB)
                    ? 'text-tertiary'
                    : 'text-on-surface-variant'
                }
              >
                {game.mapsWonA}
              </span>
              <span className="mx-2 text-qw-border">-</span>
              <span
                className={
                  parseInt(game.mapsWonB) > parseInt(game.mapsWonA)
                    ? 'text-tertiary'
                    : 'text-on-surface-variant'
                }
              >
                {game.mapsWonB}
              </span>
            </div>
          ) : (
            <div className="text-on-surface-variant font-headline">vs</div>
          )}
        </div>

        <div className="flex-1">
          <div className="font-body font-bold text-lg text-on-surface">{game.teamB}</div>
        </div>
      </div>

      {isPlayed && game.maps && game.maps.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-sm text-on-surface-variant font-headline mb-2">MAPS</div>
          {game.maps.map((map, idx) => (
            <div
              key={idx}
              className="flex justify-between items-center bg-surface-container-high rounded px-4 py-2"
            >
              <span className="font-mono text-sm text-on-surface">{map.mapName || map.map}</span>
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm">
                  <span
                    className={
                      parseInt(map.teamAFrags || map.score1) >
                      parseInt(map.teamBFrags || map.score2)
                        ? 'text-tertiary font-bold'
                        : 'text-on-surface'
                    }
                  >
                    {map.teamAFrags || map.score1}
                  </span>
                  <span className="mx-2 text-qw-border">-</span>
                  <span
                    className={
                      parseInt(map.teamBFrags || map.score2) >
                      parseInt(map.teamAFrags || map.score1)
                        ? 'text-tertiary font-bold'
                        : 'text-on-surface'
                    }
                  >
                    {map.teamBFrags || map.score2}
                  </span>
                </span>
                {map.gameUrl && (
                  <a
                    href={map.gameUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-qw-blue hover:text-primary text-sm transition-colors"
                  >
                    View →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ScheduleView({ groupGames, playoffGames, scheduleConfig }) {
  const [viewMode, setViewMode] = useState('group');

  const games = viewMode === 'group' ? groupGames : playoffGames;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-headline text-xl text-primary">SCHEDULE</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('group')}
            className={`px-4 py-2 rounded font-body font-semibold transition-all ${
              viewMode === 'group'
                ? 'bg-primary text-qw-dark'
                : 'bg-surface-container-high border border-outline-variant text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Group Stage
          </button>
          <button
            onClick={() => setViewMode('playoff')}
            className={`px-4 py-2 rounded font-body font-semibold transition-all ${
              viewMode === 'playoff'
                ? 'bg-primary text-qw-dark'
                : 'bg-surface-container-high border border-outline-variant text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Playoffs
          </button>
        </div>
      </div>

      {games && games.length > 0 ? (
        <div className="space-y-4">
          {games.map((game, index) => (
            <GameCard key={index} game={game} />
          ))}
        </div>
      ) : (
        <div className="qw-panel p-12 text-center">
          <div className="text-4xl mb-4">📅</div>
          <p className="text-on-surface-variant">
            No {viewMode === 'group' ? 'group stage' : 'playoff'} games available
          </p>
        </div>
      )}
    </div>
  );
}
