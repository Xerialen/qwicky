// src/components/division/ResultsPendingQueue.jsx
import React, { useState, useEffect, useMemo } from 'react';
import SubmissionCard from './SubmissionCard';

/**
 * Primary surface for pending Discord submissions.
 * Manages its own fetch state; delegates approve/reject business logic to parent.
 *
 * Props:
 *   tournamentId           — string
 *   division               — Division object (for filtering by division)
 *   tournament             — full tournament object
 *   onApprove(sub)         — async; parent handles API call + addMapsInBatch; throws on error
 *   onReject(sub)          — async; parent handles API call; throws on error
 *   onApproveAll(pending)  — async; parent handles bulk approve; throws on error
 *   onReprocess(sub)       — parent handles re-import
 *   onBulkReprocess(subs)  — parent handles bulk re-import
 *   detectSubmissionDivision(sub) — (sub) => Division[] | null
 */
export default function ResultsPendingQueue({
  tournamentId,
  division,
  onApprove,
  onReject,
  onApproveAll,
  onReprocess,
  onBulkReprocess,
  detectSubmissionDivision,
}) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showApproved, setShowApproved] = useState(false);
  const [filterByDivision, setFilterByDivision] = useState(true);

  const fetchSubmissions = async (includeApproved) => {
    if (!tournamentId) return;
    setLoading(true);
    setError(null);
    try {
      const status = includeApproved ? 'all' : 'pending';
      const res = await fetch(
        `/api/submissions/${encodeURIComponent(tournamentId)}?status=${status}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setSubmissions(data.submissions || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSubmissions(showApproved);
  }, [tournamentId]);

  const filteredSubmissions = useMemo(() => {
    if (!filterByDivision) return submissions;
    return submissions.filter((sub) => {
      const divisions = detectSubmissionDivision(sub);
      if (!divisions) return true;
      return divisions.some((d) => d.id === division.id);
    });
  }, [submissions, filterByDivision, division.id, detectSubmissionDivision]);

  const pendingCount = filteredSubmissions.filter((s) => s.status === 'pending').length;
  const approvedCount = filteredSubmissions.filter((s) => s.status === 'approved').length;

  const handleApprove = async (sub) => {
    setError(null);
    try {
      await onApprove(sub);
      setSubmissions((prev) => prev.filter((s) => s.id !== sub.id));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReject = async (sub) => {
    setError(null);
    try {
      await onReject(sub);
      setSubmissions((prev) => prev.filter((s) => s.id !== sub.id));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleApproveAll = async () => {
    setError(null);
    const pending = filteredSubmissions.filter((s) => s.status === 'pending');
    try {
      await onApproveAll(pending);
      const pendingIds = new Set(pending.map((s) => s.id));
      setSubmissions((prev) => prev.filter((s) => !pendingIds.has(s.id)));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleBulkReprocess = () => {
    const approved = filteredSubmissions.filter((s) => s.status === 'approved');
    onBulkReprocess(approved);
  };

  return (
    <div className="qw-panel p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-qw-accent">PENDING SUBMISSIONS</h3>
        <div className="flex gap-2 items-center flex-wrap">
          {pendingCount > 1 && (
            <button
              onClick={handleApproveAll}
              className="px-3 py-1 rounded bg-qw-win text-qw-dark text-sm font-semibold"
            >
              Approve All ({pendingCount})
            </button>
          )}
          {approvedCount > 1 && (
            <button
              onClick={handleBulkReprocess}
              className="px-3 py-1 rounded bg-qw-accent text-qw-dark text-sm font-semibold"
            >
              Reprocess All ({approvedCount})
            </button>
          )}
          <label className="flex items-center gap-1.5 text-xs text-qw-muted cursor-pointer">
            <input
              type="checkbox"
              checked={filterByDivision}
              onChange={(e) => setFilterByDivision(e.target.checked)}
              className="accent-qw-accent"
            />
            This Division Only
          </label>
          <label className="flex items-center gap-1.5 text-xs text-qw-muted cursor-pointer">
            <input
              type="checkbox"
              checked={showApproved}
              onChange={(e) => {
                setShowApproved(e.target.checked);
                fetchSubmissions(e.target.checked);
              }}
              className="accent-qw-accent"
            />
            Show Approved
          </label>
          <button
            onClick={() => fetchSubmissions(showApproved)}
            disabled={loading}
            className="px-3 py-1 rounded border border-qw-border text-qw-muted text-sm hover:text-white disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {!tournamentId && (
        <div className="p-4 bg-qw-dark rounded border border-qw-border text-qw-muted text-sm">
          Set a tournament name in the Info tab to enable Discord submissions.
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-500/50 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      {filteredSubmissions.length === 0 && !loading && tournamentId && (
        <div className="text-center py-8 text-qw-muted">
          <div className="text-4xl mb-2">🤖</div>
          <p>
            No {filterByDivision ? `submissions for ${division.name}` : 'pending submissions'}
          </p>
          <p className="text-xs mt-1">
            {filterByDivision
              ? 'Uncheck "This Division Only" to see all submissions'
              : 'Hub URLs posted in registered Discord channels will appear here.'}
          </p>
        </div>
      )}

      {filteredSubmissions.length > 0 && (
        <div className="space-y-2">
          {filteredSubmissions.map((sub) => (
            <SubmissionCard
              key={sub.id}
              submission={sub}
              onApprove={handleApprove}
              onReject={handleReject}
              onReprocess={onReprocess}
              detectedDivisions={detectSubmissionDivision(sub)}
              currentDivisionId={division.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
