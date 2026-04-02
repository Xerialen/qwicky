// src/components/SaveStatusIndicator.jsx
// Reads directly from syncStatusStore — no props.
// Renders the current save/sync state in the wizard header.

import React from 'react';
import useSyncStatusStore from '../stores/syncStatusStore';

const STATUS_CONFIG = {
  synced: {
    icon: '✓',
    label: 'Saved',
    color: 'var(--status-win)',
  },
  saving: {
    icon: '●',
    label: 'Saving\u2026',
    color: 'var(--status-warning)',
  },
  unsaved: {
    icon: '●',
    label: 'Unsaved',
    color: 'var(--status-warning)',
  },
  error: {
    icon: '⚠',
    label: 'Sync failed',
    color: 'var(--status-loss)',
  },
  local_only: {
    icon: '💾',
    label: 'Local only',
    color: 'var(--text-disabled)',
  },
};

export default function SaveStatusIndicator() {
  const { status, errorMessage } = useSyncStatusStore();
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.local_only;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-medium)',
        letterSpacing: 'var(--tracking-wide)',
        textTransform: 'uppercase',
        color: config.color,
      }}
      title={errorMessage ?? undefined}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
