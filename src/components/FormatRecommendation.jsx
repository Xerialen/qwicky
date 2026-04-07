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
    <div className="bg-surface-container-high border border-primary  p-3 px-4 flex items-start gap-3">
      {/* accent bar */}
      <div className="w-1 rounded shrink-0 self-stretch bg-primary" />
      <div>
        <p className="m-0 text-xs font-medium tracking-wide uppercase text-primary">
          Recommended for {teamCount} team{teamCount !== 1 ? 's' : ''}: {rec.label}
        </p>
        <p className="mt-1 text-sm text-on-surface-variant">{rec.description}</p>
      </div>
    </div>
  );
}
