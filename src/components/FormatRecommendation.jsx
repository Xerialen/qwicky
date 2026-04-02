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
    <div className="bg-qw-dark border border-qw-accent rounded-lg p-3 px-4 flex items-start gap-3">
      {/* accent bar */}
      <div className="w-1 rounded shrink-0 self-stretch bg-qw-accent" />
      <div>
        <p className="m-0 text-xs font-medium tracking-wide uppercase text-qw-accent">
          Recommended for {teamCount} team{teamCount !== 1 ? 's' : ''}: {rec.label}
        </p>
        <p className="mt-1 text-sm text-qw-muted">{rec.description}</p>
      </div>
    </div>
  );
}
