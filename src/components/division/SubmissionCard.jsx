// src/components/division/SubmissionCard.jsx
import React from 'react';
import { unicodeToAscii } from '../../utils/matchLogic';
import ConfidenceIndicator from './ConfidenceIndicator';

/**
 * A single pending (or approved) Discord submission card.
 *
 * Props:
 *   submission           — raw match_submissions row from Supabase
 *   onApprove(sub)       — called when admin approves
 *   onReject(sub)        — called when admin rejects
 *   onReprocess(sub)     — called for already-approved submissions
 *   detectedDivisions    — Division[] | null (from detectSubmissionDivision)
 *   currentDivisionId    — string (division.id)
 */
export default function SubmissionCard({
  submission: sub,
  onApprove,
  onReject,
  onReprocess,
  detectedDivisions,
  currentDivisionId,
}) {
  const gameData = sub.game_data || {};
  const teams = gameData.teams || [];

  const rawT1Name = typeof teams[0] === 'object' ? teams[0]?.name : teams[0] || '?';
  const rawT2Name = typeof teams[1] === 'object' ? teams[1]?.name : teams[1] || '?';
  const t1Name = unicodeToAscii(rawT1Name);
  const t2Name = unicodeToAscii(rawT2Name);
  const mapName = unicodeToAscii(gameData.map || '?');

  let t1Frags, t2Frags;
  if (typeof teams[0] === 'object') {
    t1Frags = teams[0]?.frags;
    t2Frags = teams[1]?.frags;
  } else if (gameData.team_stats) {
    t1Frags = gameData.team_stats[rawT1Name]?.frags;
    t2Frags = gameData.team_stats[rawT2Name]?.frags;
  } else if (gameData.players) {
    t1Frags = 0;
    t2Frags = 0;
    gameData.players.forEach((p) => {
      if (p.team === teams[0]) t1Frags += p.stats?.frags || 0;
      else if (p.team === teams[1]) t2Frags += p.stats?.frags || 0;
    });
  }

  const isCurrentDivision = detectedDivisions?.some((d) => d.id === currentDivisionId);

  const confidence = sub.flags?.confidence;
  const confidenceLevel = confidence != null ? (confidence >= 80 ? 'high' : 'low') : null;
  const confidenceReason = sub.flags?.breakdown
    ? `Team: ${sub.flags.breakdown.teamMatch}/40, Schedule: ${sub.flags.breakdown.scheduleProximity}/30, BestOf: ${sub.flags.breakdown.bestOfFit}/15, Series: ${sub.flags.breakdown.seriesAffinity}/15`
    : null;

  return (
    <div className="p-4 bg-qw-dark rounded border border-qw-border">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-body font-semibold text-white">{t1Name}</span>
            <span className="px-2 py-1 bg-qw-darker rounded font-mono text-sm">
              <span className={(t1Frags || 0) > (t2Frags || 0) ? 'text-qw-win font-bold' : 'text-white'}>
                {t1Frags ?? '?'}
              </span>
              <span className="text-qw-muted mx-1">-</span>
              <span className={(t2Frags || 0) > (t1Frags || 0) ? 'text-qw-win font-bold' : 'text-white'}>
                {t2Frags ?? '?'}
              </span>
            </span>
            <span className="font-body font-semibold text-white">{t2Name}</span>
            <span className="text-qw-muted text-xs bg-qw-darker px-2 py-0.5 rounded">{mapName}</span>
            <span className="text-qw-muted text-xs bg-qw-darker px-2 py-0.5 rounded">
              {gameData.mode || '?'}
            </span>
            {confidenceLevel && (
              <ConfidenceIndicator level={confidenceLevel} reason={confidenceReason} />
            )}
          </div>
          <div className="text-xs text-qw-muted mt-1 flex items-center gap-2 flex-wrap">
            <span>
              Submitted by{' '}
              <span className="text-qw-accent">{sub.submitted_by_name}</span> &middot;{' '}
              {new Date(sub.created_at).toLocaleString()} &middot; Game #{sub.game_id}
            </span>
            {detectedDivisions ? (
              detectedDivisions.length === 1 ? (
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    isCurrentDivision
                      ? 'bg-qw-win/20 border border-qw-win/50 text-qw-win'
                      : 'bg-blue-900/30 border border-blue-500/50 text-blue-300'
                  }`}
                  title={`Teams belong to ${detectedDivisions[0].name}`}
                >
                  📍 {detectedDivisions[0].name}
                </span>
              ) : (
                <span
                  className="px-2 py-0.5 bg-purple-900/30 border border-purple-500/50 text-purple-300 rounded text-xs font-semibold"
                  title={`Teams found in: ${detectedDivisions.map((d) => d.name).join(', ')}`}
                >
                  📍 Multiple ({detectedDivisions.length})
                </span>
              )
            ) : (
              <span
                className="px-2 py-0.5 bg-yellow-900/30 border border-yellow-500/50 text-yellow-300 rounded text-xs font-semibold"
                title="Teams not found in any division"
              >
                ⚠ Unknown Teams
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {sub.status === 'approved' ? (
            <>
              <span className="text-qw-win text-xs font-semibold">Approved</span>
              <button
                onClick={() => onReprocess(sub)}
                className="px-3 py-1.5 rounded bg-qw-accent text-qw-dark text-sm font-semibold hover:bg-qw-accent/80"
              >
                Reprocess
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onApprove(sub)}
                className="px-3 py-1.5 rounded bg-qw-win text-qw-dark text-sm font-semibold hover:bg-qw-win/80"
              >
                Approve
              </button>
              <button
                onClick={() => onReject(sub)}
                className="px-3 py-1.5 rounded border border-red-500/50 text-red-400 text-sm hover:bg-red-900/30"
              >
                Reject
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
