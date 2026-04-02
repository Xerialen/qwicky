// src/utils/formatLookup.js
// Static lookup: teamCount → recommended tournament format

const FORMAT_LOOKUP = [
  {
    min: 2,
    max: 4,
    format: 'single-elim',
    label: 'Single Elimination',
    description: 'Clean bracket with direct knockout rounds — ideal for small fields.',
  },
  {
    min: 5,
    max: 8,
    format: 'groups',
    label: 'Groups + Playoffs',
    description: '2 groups feeding into a knockout stage — everyone gets multiple games.',
  },
  {
    min: 9,
    max: 16,
    format: 'groups',
    label: 'Groups + Playoffs',
    description: '3–4 groups with double-elim playoffs — balances group play and bracket depth.',
  },
  {
    min: 17,
    max: Infinity,
    format: 'multi-tier',
    label: 'Multi-Tier Playoffs',
    description:
      'Tiered playoff structure — keeps more teams competing across Gold/Silver brackets.',
  },
];

/**
 * Returns a format recommendation for the given team count.
 * @param {number} teamCount
 * @returns {{ format: string, label: string, description: string } | null}
 */
export function getFormatRecommendation(teamCount) {
  if (!teamCount || teamCount < 2) return null;
  const entry = FORMAT_LOOKUP.find((r) => teamCount >= r.min && teamCount <= r.max);
  return entry
    ? { format: entry.format, label: entry.label, description: entry.description }
    : null;
}
