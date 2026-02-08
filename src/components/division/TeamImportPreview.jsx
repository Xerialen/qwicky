// src/components/division/TeamImportPreview.jsx
import React from 'react';
import { getImportSummary } from '../../utils/teamImport';

export default function TeamImportPreview({
  teams,
  onConfirm,
  onCancel,
  title = "Preview Import"
}) {
  if (!teams || teams.length === 0) {
    return null;
  }

  const summary = getImportSummary(teams);
  const hasErrors = summary.errors > 0;
  const hasConflicts = summary.conflicts > 0;

  const handleImportAll = () => {
    if (hasErrors) return;
    onConfirm(teams.filter(t => t.isValid));
  };

  const handleImportValid = () => {
    const validTeams = teams.filter(t => t.isValid);
    if (validTeams.length === 0) return;
    onConfirm(validTeams);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-qw-panel rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-qw-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl text-qw-accent">{title}</h2>
            <p className="text-sm text-qw-muted mt-1">
              Review teams before importing
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-qw-muted hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Summary Banner */}
        <div className="px-6 py-3 bg-qw-dark border-b border-qw-border">
          <div className="flex items-center gap-6 text-sm">
            <span className="text-white font-semibold">{summary.total} teams</span>
            <span className="text-qw-win">{summary.valid} valid</span>
            {summary.errors > 0 && (
              <span className="text-qw-loss">{summary.errors} with errors</span>
            )}
            {summary.warnings > 0 && (
              <span className="text-yellow-400">{summary.warnings} with warnings</span>
            )}
            {summary.conflicts > 0 && (
              <span className="text-orange-400">{summary.conflicts} conflicts</span>
            )}
          </div>
        </div>

        {/* Team List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            {teams.map((team, idx) => (
              <TeamPreviewRow key={idx} team={team} index={idx} />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-qw-border flex items-center justify-between">
          <div className="text-sm text-qw-muted">
            {hasErrors && (
              <span className="text-yellow-400">⚠️ Fix errors to import all teams</span>
            )}
            {hasConflicts && !hasErrors && (
              <span className="text-orange-400">⚠️ Some teams already exist</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded border border-qw-border text-qw-muted hover:text-white"
            >
              Cancel
            </button>
            {hasErrors && summary.valid > 0 && (
              <button
                onClick={handleImportValid}
                className="px-4 py-2 rounded bg-qw-dark border border-qw-accent text-qw-accent hover:bg-qw-accent hover:text-black"
              >
                Import {summary.valid} Valid Team{summary.valid !== 1 ? 's' : ''}
              </button>
            )}
            <button
              onClick={handleImportAll}
              disabled={hasErrors}
              className={`px-4 py-2 rounded font-semibold ${
                hasErrors
                  ? 'bg-qw-dark text-qw-muted cursor-not-allowed'
                  : 'qw-btn'
              }`}
            >
              Import All {summary.total} Team{summary.total !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamPreviewRow({ team, index }) {
  const hasErrors = team.errors?.length > 0;
  const hasWarnings = team.warnings?.length > 0;
  const hasConflicts = team.conflicts?.length > 0;

  // Determine status color
  let statusColor = 'text-qw-win'; // green for valid
  let statusIcon = '✓';
  let borderColor = 'border-qw-border';

  if (hasErrors) {
    statusColor = 'text-qw-loss';
    statusIcon = '✕';
    borderColor = 'border-qw-loss/30';
  } else if (hasConflicts) {
    statusColor = 'text-orange-400';
    statusIcon = '⚠';
    borderColor = 'border-orange-400/30';
  } else if (hasWarnings) {
    statusColor = 'text-yellow-400';
    statusIcon = '⚠';
    borderColor = 'border-yellow-400/20';
  }

  return (
    <div className={`p-3 bg-qw-dark rounded border ${borderColor}`}>
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <span className={`${statusColor} font-bold text-lg leading-none mt-0.5`}>
          {statusIcon}
        </span>

        {/* Team Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-sm text-qw-muted font-mono">#{index + 1}</span>
            <span className="font-semibold text-white">{team.name || '(empty)'}</span>
            {team.tag && (
              <span className="text-qw-muted font-mono text-sm">[{team.tag}]</span>
            )}
            {team.country && (
              <span className="text-qw-muted text-sm uppercase">{team.country}</span>
            )}
            {team.group && (
              <span className="px-2 py-0.5 rounded bg-qw-accent/20 text-qw-accent text-xs font-semibold">
                Group {team.group}
              </span>
            )}
          </div>

          {/* Players */}
          {team.players && (
            <div className="text-xs text-qw-muted mt-1">
              Players: {team.players}
            </div>
          )}

          {/* Errors */}
          {hasErrors && (
            <div className="mt-2 space-y-1">
              {team.errors.map((error, idx) => (
                <div key={idx} className="text-xs text-qw-loss flex items-start gap-1">
                  <span>•</span>
                  <span>{error}</span>
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {hasWarnings && (
            <div className="mt-2 space-y-1">
              {team.warnings.map((warning, idx) => (
                <div key={idx} className="text-xs text-yellow-400 flex items-start gap-1">
                  <span>•</span>
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}

          {/* Conflicts */}
          {hasConflicts && (
            <div className="mt-2 text-xs text-orange-400">
              ⚠ Team {team.conflicts.join(' and ')} already exists
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
