// src/components/WizardDraftCard.jsx
// Resume-draft card on LandingScreen. Surfaces in-progress wizard drafts.
// Parent (LandingScreen) owns the Supabase fetch and passes drafts[] down.
// State machine: loading | empty | single | multi | error | dismissed

import React, { useState, useEffect, useRef } from 'react';
import useSyncStatusStore from '../stores/syncStatusStore.js';

const DISMISSED_KEY = 'wizard-draft-dismissed-ids';

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getDismissedIds() {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
  } catch {
    return [];
  }
}

function setDismissedIds(ids) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
}

// ── Skeleton shimmer ────────────────────────────────────────────────────────

function SkeletonBar({ width = '100%', height = 14 }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 'var(--radius-md)',
        background:
          'linear-gradient(90deg, var(--bg-elevated) 25%, rgba(255,255,255,0.05) 50%, var(--bg-elevated) 75%)',
        backgroundSize: '200% 100%',
        animation: 'wizardCardShimmer 1.4s ease-in-out infinite',
      }}
    />
  );
}

// ── Confirm modal ───────────────────────────────────────────────────────────

function ConfirmDeleteModal({ draftName, onConfirm, onCancel, isDeleting, deleteError }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-draft-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-overlay)',
        animation: 'wizardCardFadeIn var(--duration-fast) var(--ease-default)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          maxWidth: 420,
          width: '90%',
        }}
      >
        <h3
          id="delete-draft-title"
          style={{
            fontSize: 'var(--text-md)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-3)',
          }}
        >
          Delete draft?
        </h3>
        <p
          style={{
            fontSize: 'var(--text-base)',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-5)',
          }}
        >
          <strong style={{ color: 'var(--text-primary)' }}>
            &ldquo;{draftName || 'Untitled draft'}&rdquo;
          </strong>{' '}
          will be permanently deleted from all devices. This cannot be undone.
        </p>

        {deleteError && (
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--status-loss)',
              marginBottom: 'var(--space-3)',
            }}
          >
            {deleteError}
          </p>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <button
            className="qw-btn-secondary"
            style={{ padding: '8px 16px' }}
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            className="qw-btn"
            style={{
              padding: '8px 16px',
              background: 'var(--status-loss)',
              color: '#fff',
              opacity: isDeleting ? 0.7 : 1,
            }}
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function WizardDraftCard({
  drafts,
  onResume,
  onDeleteDraft,
  onDismiss,
  isLoading,
  fetchError,
  onRetryFetch,
}) {
  const syncStatus = useSyncStatusStore((s) => s.status);

  // Determine initial dismissed state
  const [dismissedIds, setDismissedIdsState] = useState(() => getDismissedIds());
  const [deleteTarget, setDeleteTarget] = useState(null); // draft object pending delete
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [resumingId, setResumingId] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(true); // for dismiss animation
  const cardRef = useRef(null);

  // Filter out dismissed drafts
  const activeDrafts = (drafts || []).filter((d) => !dismissedIds.includes(d.id));

  // Derive card state
  const cardState = (() => {
    if (!visible) return 'dismissed';
    if (isLoading) return 'loading';
    if (fetchError) return 'error';
    if (dismissedIds.length > 0 && activeDrafts.length === 0 && (drafts || []).length > 0)
      return 'dismissed';
    if (activeDrafts.length === 0) return 'empty';
    if (activeDrafts.length === 1) return 'single';
    return 'multi';
  })();

  if (cardState === 'empty' || cardState === 'dismissed') return null;

  const handleDismissAll = () => {
    const allIds = (drafts || []).map((d) => d.id);
    const next = [...new Set([...dismissedIds, ...allIds])];
    setDismissedIdsState(next);
    setDismissedIds(next);
    setVisible(false);
    onDismiss?.();
  };

  const handleResume = async (draftId) => {
    setResumingId(draftId);
    await onResume(draftId);
    setResumingId(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteDraft(deleteTarget.id);
      setDeleteTarget(null);
      setIsDeleting(false);
    } catch (err) {
      setIsDeleting(false);
      setDeleteError('Could not delete draft. Try again.');
    }
  };

  const isSyncing = syncStatus === 'saving';
  const isSyncError = syncStatus === 'error';
  const isLocalOnly = syncStatus === 'local_only';

  // Status badge content
  const statusBadge = (() => {
    if (isSyncing) return { icon: '◌', label: 'Syncing…', color: 'var(--accent)' };
    if (isSyncError) return { icon: '⚠', label: 'Sync failed', color: 'var(--status-loss)' };
    if (isLocalOnly) return { icon: '💾', label: 'Saved locally', color: 'var(--status-warning)' };
    return { icon: '●', label: null, color: 'var(--accent)' };
  })();

  const visibleDrafts = expanded ? activeDrafts : activeDrafts.slice(0, 3);
  const hiddenCount = activeDrafts.length - 3;

  return (
    <>
      {deleteTarget && (
        <ConfirmDeleteModal
          draftName={deleteTarget.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteError(null);
          }}
          isDeleting={isDeleting}
          deleteError={deleteError}
        />
      )}

      {cardState === 'loading' && (
        <div
          className="wizard-draft-card"
          aria-busy="true"
          role="region"
          aria-label="Loading draft tournament"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
        >
          <SkeletonBar width="60%" />
          <SkeletonBar width="80%" height={18} />
          <SkeletonBar width="50%" />
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
            <SkeletonBar width="30%" height={32} />
            <SkeletonBar width="35%" height={32} />
          </div>
        </div>
      )}

      {cardState === 'error' && (
        <div
          className="wizard-draft-card"
          role="alert"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ color: 'var(--status-loss)', fontSize: 'var(--text-sm)' }}>●</span>
            <span
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--tracking-wide)',
                fontWeight: 'var(--weight-medium)',
              }}
            >
              Resume draft
            </span>
          </div>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>
            Could not load drafts — check your connection.
          </p>
          <button
            className="qw-btn-secondary"
            style={{ alignSelf: 'flex-start', padding: '6px 14px', fontSize: 'var(--text-sm)' }}
            onClick={onRetryFetch}
          >
            Retry
          </button>
        </div>
      )}

      {cardState === 'single' &&
        activeDrafts[0] &&
        (() => {
          const draft = activeDrafts[0];
          const isResuming = resumingId === draft.id;
          return (
            <div
              ref={cardRef}
              className="wizard-draft-card"
              role="region"
              aria-label={`Draft tournament: ${draft.name || 'Untitled draft'}`}
            >
              {/* Header row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 'var(--space-3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span style={{ color: statusBadge.color, fontSize: 10 }}>{statusBadge.icon}</span>
                  <span
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: 'var(--tracking-wide)',
                      fontWeight: 'var(--weight-medium)',
                    }}
                  >
                    {statusBadge.label || 'Resume draft'}
                  </span>
                  {isSyncing && (
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-secondary)',
                        marginLeft: 4,
                      }}
                    >
                      Syncing…
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  {isSyncError && (
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--status-loss)' }}>
                      Sync failed{' '}
                      <button
                        style={{
                          color: 'var(--accent-bright)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 'var(--text-sm)',
                          padding: 0,
                        }}
                        onClick={() => useSyncStatusStore.getState().setUnsaved()}
                      >
                        Retry
                      </button>
                    </span>
                  )}
                  <button
                    aria-label="Dismiss draft card"
                    onClick={handleDismissAll}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      fontSize: 14,
                      padding: '4px',
                      minWidth: 44,
                      minHeight: 44,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Tournament name */}
              <div
                style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--weight-semibold)',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                {draft.name || 'Untitled draft'}
              </div>

              {/* Metadata */}
              <div
                style={{
                  fontSize: 'var(--text-base)',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--space-5)',
                }}
              >
                Last edited {timeAgo(draft.updatedAt || draft.updated_at)}
                {draft.currentStep != null && ` · step ${draft.currentStep + 1} of 6`}
                {draft.teamCount != null && ` · ${draft.teamCount} teams`}
                {isSyncError && (
                  <span style={{ color: 'var(--status-warning)', marginLeft: 8 }}>
                    · changes may not be saved
                  </span>
                )}
              </div>

              {/* CTA row */}
              <div
                className="wizard-draft-card-cta"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 'var(--space-3)',
                }}
              >
                <button
                  className="qw-btn"
                  style={{ padding: '8px 20px', minWidth: 100, opacity: isSyncing ? 0.7 : 1 }}
                  aria-label={`Resume draft: ${draft.name || 'Untitled draft'}`}
                  disabled={isSyncing || isResuming}
                  onClick={() => handleResume(draft.id)}
                  title={isSyncing ? 'Saving your changes…' : undefined}
                >
                  {isResuming ? '◌ Loading…' : 'Resume'}
                </button>
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  {isLocalOnly && (
                    <button
                      className="qw-btn-secondary"
                      style={{ padding: '8px 14px', fontSize: 'var(--text-sm)' }}
                    >
                      Sign in to sync
                    </button>
                  )}
                  <button
                    className="qw-btn-secondary"
                    style={{
                      padding: '8px 14px',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--status-loss)',
                      borderColor: 'var(--status-loss)',
                    }}
                    aria-label={`Delete draft: ${draft.name || 'Untitled draft'}`}
                    onClick={() => setDeleteTarget(draft)}
                  >
                    Delete draft
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {cardState === 'multi' && (
        <div
          ref={cardRef}
          className="wizard-draft-card"
          role="region"
          aria-label="Draft tournaments"
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ color: statusBadge.color, fontSize: 10 }}>{statusBadge.icon}</span>
              <span
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--tracking-wide)',
                  fontWeight: 'var(--weight-medium)',
                }}
              >
                {activeDrafts.length} drafts in progress
              </span>
              {isSyncing && (
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-secondary)',
                    marginLeft: 4,
                  }}
                >
                  Syncing…
                </span>
              )}
            </div>
            <button
              aria-label="Dismiss draft card"
              onClick={handleDismissAll}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                fontSize: 14,
                padding: '4px',
                minWidth: 44,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 'var(--space-2)' }} />

          {/* Draft rows */}
          {visibleDrafts.map((draft) => {
            const isResuming = resumingId === draft.id;
            return (
              <div
                key={draft.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: '10px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 'var(--text-base)',
                      fontWeight: 'var(--weight-medium)',
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {draft.name || 'Untitled draft'}
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    Last edited {timeAgo(draft.updatedAt || draft.updated_at)}
                  </div>
                </div>
                <button
                  className="qw-btn"
                  style={{
                    padding: '5px 12px',
                    fontSize: 'var(--text-sm)',
                    flexShrink: 0,
                    opacity: isSyncing ? 0.7 : 1,
                  }}
                  aria-label={`Resume draft: ${draft.name || 'Untitled draft'}`}
                  disabled={isSyncing || isResuming}
                  onClick={() => handleResume(draft.id)}
                >
                  {isResuming ? '◌' : 'Resume'}
                </button>
                <button
                  aria-label={`Delete draft: ${draft.name || 'Untitled draft'}`}
                  onClick={() => setDeleteTarget(draft)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    padding: '4px',
                    minWidth: 44,
                    minHeight: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}

          {/* Show more */}
          {!expanded && hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(true)}
              style={{
                marginTop: 'var(--space-3)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--accent)',
                fontSize: 'var(--text-sm)',
                padding: 0,
              }}
            >
              Show {hiddenCount} more
            </button>
          )}
        </div>
      )}
    </>
  );
}
