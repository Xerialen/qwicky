// src/components/division/ConfidenceIndicator.jsx
import React, { useState } from 'react';

/**
 * High/Low confidence badge with a plain-English tooltip.
 *
 * Props:
 *   level  — 'high' | 'low'
 *   reason — plain-English explanation shown in tooltip (optional)
 */
export default function ConfidenceIndicator({ level, reason }) {
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const isHigh = level === 'high';
  const defaultReason = isHigh ? 'Strong match' : 'Needs verification';
  const label = isHigh ? 'High confidence' : 'Low confidence';
  const badgeClass = isHigh
    ? 'bg-qw-win/20 border border-qw-win/50 text-qw-win'
    : 'bg-amber-500/20 border border-amber-500/50 text-amber-300';

  return (
    <span className="relative inline-flex items-center gap-1">
      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${badgeClass}`}>
        {isHigh ? '✓' : '⚠'} {label}
      </span>
      {(reason || !isHigh) && (
        <button
          type="button"
          className="text-qw-muted hover:text-white text-xs leading-none"
          title={reason ?? defaultReason}
          onClick={() => setTooltipVisible((v) => !v)}
          onMouseEnter={() => setTooltipVisible(true)}
          onMouseLeave={() => setTooltipVisible(false)}
          aria-label="Confidence explanation"
        >
          ?
        </button>
      )}
      {tooltipVisible && (
        <span className="absolute bottom-full left-0 mb-1 z-50 w-48 px-2 py-1.5 bg-qw-panel border border-qw-border rounded text-xs text-white shadow-lg pointer-events-none">
          {reason ?? defaultReason}
        </span>
      )}
    </span>
  );
}
