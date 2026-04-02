// src/components/FormatRecommendation.jsx
import React from 'react';
import { getFormatRecommendation } from '../utils/formatLookup.js';

/**
 * Banner shown inside the Format step (step 4) of the Setup Wizard.
 * Suggests a tournament format based on the total team count across all divisions.
 *
 * @param {{ teamCount: number }} props
 */
export default function FormatRecommendation({ teamCount }) {
  const rec = getFormatRecommendation(teamCount);
  if (!rec) return null;

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--accent)',
        borderRadius: '8px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
      }}
    >
      {/* accent bar */}
      <div
        style={{
          width: '3px',
          borderRadius: '2px',
          background: 'var(--accent)',
          alignSelf: 'stretch',
          flexShrink: 0,
        }}
      />
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-medium)',
            letterSpacing: 'var(--tracking-wide)',
            textTransform: 'uppercase',
            color: 'var(--accent)',
          }}
        >
          Recommended for {teamCount} team{teamCount !== 1 ? 's' : ''}: {rec.label}
        </p>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
          }}
        >
          {rec.description}
        </p>
      </div>
    </div>
  );
}
