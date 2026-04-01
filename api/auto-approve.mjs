// api/auto-approve.mjs
// Phase 4: Auto-approval engine.
// Called by the Discord bot after a submission is inserted.
// Attempts to resolve both teams and link the game to a scheduled match.
//
// POST /api/auto-approve
// Body: { submissionId, tournamentId, divisionId, gameData }
//
// Returns:
//   { status: 'approved', matchId, confidence }
//   { status: 'flagged', reason, confidence, flags }
//   { status: 'pending', reason }
//   { status: 'error', error }

import { createClient } from '@supabase/supabase-js';
import { normalize } from '../src/utils/nameNormalizer.js';
import { resolveTeamName } from '../src/utils/teamResolver.js';
import { requireAdminAuth } from './_auth.mjs';

const supabase = createClient(
  process.env.QWICKY_SUPABASE_URL,
  process.env.QWICKY_SUPABASE_SERVICE_KEY
);

// ── Team resolver — delegates to the shared 7-tier resolver ──────────────────
// No more inlined copies. Uses the authoritative teamResolver.js which handles:
// exact(100) → normalized(95) → tag+variants(90) → core(85) → alias(80) →
// fuzzyJW≥0.92(70) → fuzzyJW≥0.80/Dice≥0.70(60)
function resolveTeam(rawName, teams, aliases = []) {
  const result = resolveTeamName(rawName, teams, aliases);
  // Map from teamResolver's { match, confidence, method } to auto-approve's { team, confidence, method }
  return {
    team: result.match,
    confidence: result.confidence,
    method: result.method,
  };
}

// ── Multi-factor match scoring (inline from matchConfidence.js) ──────────────
// Score 0–100 = teamMatch(0–40) + scheduleProximity(0–30) + bestOfFit(0–15) + seriesAffinity(0–15)

function scoreTeamMatch(opts) {
  const c1 = opts.teamConfidence1 ?? 0;
  const c2 = opts.teamConfidence2 ?? 0;
  if (c1 === 0 || c2 === 0) return 0;
  const avg = (c1 + c2) / 2;
  return Math.round((avg / 100) * 40);
}

function scoreScheduleProximity(gameDate, matchDate) {
  if (!gameDate || !matchDate) return 15; // No date info — neutral score
  const gd = new Date(gameDate);
  const md = new Date(matchDate);
  if (isNaN(gd.getTime()) || isNaN(md.getTime())) return 15;
  const diffDays = Math.abs(gd - md) / (1000 * 60 * 60 * 24);
  if (diffDays < 0.5) return 30;
  if (diffDays < 1.5) return 25;
  if (diffDays < 3.5) return 20;
  if (diffDays < 7.5) return 10;
  if (diffDays < 14.5) return 5;
  return 0;
}

function scoreBestOfFit(bestOf, existingMaps) {
  const bo = bestOf || 3;
  const currentMaps = existingMaps?.length || 0;
  if (currentMaps >= bo) return 0;
  if (currentMaps === 0) return 15;
  if (bo - currentMaps > 0) return 12;
  return 5;
}

function scoreSeriesAffinity(gameDate, existingMaps) {
  if (!existingMaps || existingMaps.length === 0) return 10; // No existing maps — neutral
  if (!gameDate) return 8;
  const gameTime = new Date(gameDate).getTime();
  if (isNaN(gameTime)) return 8;

  const SERIES_GAP_MS = 2 * 60 * 60 * 1000;
  const hasCloseSibling = existingMaps.some(m => {
    if (!m.date) return false;
    const mapTime = new Date(m.date).getTime();
    if (isNaN(mapTime)) return false;
    return Math.abs(gameTime - mapTime) < SERIES_GAP_MS;
  });
  if (hasCloseSibling) return 15;

  const hasSameDayMap = existingMaps.some(m => {
    if (!m.date) return false;
    return new Date(m.date).toDateString() === new Date(gameDate).toDateString();
  });
  if (hasSameDayMap) return 10;
  return 3;
}

function scoreMatch(game, match, opts = {}) {
  const teamMatch = scoreTeamMatch(opts);
  const scheduleProximity = scoreScheduleProximity(game.date, match.match_date);
  const bestOfFit = scoreBestOfFit(match.best_of, opts.existingMaps);
  const seriesAffinity = scoreSeriesAffinity(game.date, opts.existingMaps);
  return {
    score: teamMatch + scheduleProximity + bestOfFit + seriesAffinity,
    breakdown: { teamMatch, scheduleProximity, bestOfFit, seriesAffinity },
  };
}

function confidenceLabel(score) {
  if (score >= 85) return 'Very High';
  if (score >= 70) return 'High';
  if (score >= 55) return 'Medium';
  if (score >= 40) return 'Low';
  return 'Very Low';
}

// ── Best schedule match finder (replaces findScheduleMatch) ─────────────────
function findBestScheduleMatch(game, schedule, opts = {}) {
  const { teamConfidence1 = 100, teamConfidence2 = 100, minScore = 40 } = opts;
  let best = null;

  for (const match of schedule) {
    // Skip completed matches that are already full
    if (match.status === 'completed') continue;

    // Check team names match (either order)
    const n1 = normalize(match.team1), n2 = normalize(match.team2);
    const gt1 = normalize(game.team1), gt2 = normalize(game.team2);
    const teamsMatch = (n1 === gt1 && n2 === gt2) || (n1 === gt2 && n2 === gt1);
    if (!teamsMatch) continue;

    const result = scoreMatch(game, match, {
      teamConfidence1,
      teamConfidence2,
      existingMaps: match.maps || [],
    });

    if (result.score >= minScore && (!best || result.score > best.score)) {
      best = { match, score: result.score, breakdown: result.breakdown };
    }
  }

  return best;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!await requireAdminAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { submissionId, tournamentId, divisionId, gameData } = req.body || {};

  if (!submissionId || !tournamentId || !gameData) {
    return res.status(400).json({ error: 'submissionId, tournamentId, gameData are required' });
  }

  try {
    // 1. Load tournament config (for settings like minAutoApproveConfidence)
    const { data: tournamentRow } = await supabase
      .from('tournaments')
      .select('settings')
      .eq('id', tournamentId)
      .single();

    const settings = tournamentRow?.settings || {};
    const {
      autoApprove = true,
      minAutoApproveConfidence = 80,
      approvalWindowDays = 3,
    } = settings;

    if (!autoApprove) {
      return res.json({ status: 'pending', reason: 'auto-approve disabled for this tournament' });
    }

    // 2. Load division teams + schedule
    const divQuery = supabase.from('teams').select('id, name, tag').eq('tournament_id', tournamentId);
    if (divisionId) divQuery.eq('division_id', divisionId);

    const { data: teams } = await divQuery;
    const { data: schedule } = await supabase
      .from('matches')
      .select('id, team1, team2, status, match_date, best_of, round, "group"')
      .eq('tournament_id', tournamentId)
      .in('status', ['scheduled', 'live']);

    // 3. Load aliases
    const { data: aliases } = await supabase
      .from('team_aliases')
      .select('alias, canonical')
      .or(`tournament_id.eq.${tournamentId},is_global.eq.true`);

    // 4. Extract team names from game data
    const rawTeams = (gameData.teams || []).map(t =>
      typeof t === 'object' ? (t.name || '') : String(t || '')
    );

    if (rawTeams.length < 2) {
      const flags = { reason: 'insufficient-teams', rawTeams };
      await supabase.from('match_submissions').update({ flags }).eq('id', submissionId);
      return res.json({ status: 'pending', reason: 'game has fewer than 2 teams', flags });
    }

    // 5. Resolve each team
    const r1 = resolveTeam(rawTeams[0], teams || [], aliases || []);
    const r2 = resolveTeam(rawTeams[1], teams || [], aliases || []);

    const minConfidence = Math.min(r1.confidence, r2.confidence);
    const flags = {
      team1: { raw: rawTeams[0], resolved: r1.team?.name, confidence: r1.confidence, method: r1.method },
      team2: { raw: rawTeams[1], resolved: r2.team?.name, confidence: r2.confidence, method: r2.method },
    };

    // 6. If both teams unresolved, bail early as pending
    if (!r1.team || !r2.team) {
      const reason = !r1.team
        ? `unknown team: "${rawTeams[0]}"`
        : `unknown team: "${rawTeams[1]}"`;
      await supabase.from('match_submissions').update({ flags: { ...flags, reason } }).eq('id', submissionId);
      return res.json({ status: 'pending', reason, confidence: 0, flags });
    }

    // 7. Multi-factor scoring: find best matching scheduled match
    const game = {
      team1: r1.team.name,
      team2: r2.team.name,
      date: gameData.date,
      map: gameData.map,
    };

    const bestResult = findBestScheduleMatch(game, schedule || [], {
      teamConfidence1: r1.confidence,
      teamConfidence2: r2.confidence,
      minScore: 40,
    });

    const matchScore = bestResult?.score ?? 0;
    const matchBreakdown = bestResult?.breakdown ?? null;
    const scheduleMatch = bestResult?.match ?? null;
    const label = confidenceLabel(matchScore);

    // Attach confidence info to flags
    const confidenceFlags = {
      ...flags,
      confidence: matchScore,
      confidenceLabel: label,
      breakdown: matchBreakdown,
    };

    // 8. Decision logic based on composite score + team confidence
    if (!scheduleMatch || matchScore < 40) {
      // No match found or score too low → pending
      const reason = !scheduleMatch
        ? `no scheduled match found for ${r1.team.name} vs ${r2.team.name}`
        : `match score too low: ${matchScore} (${label})`;
      await supabase.from('match_submissions').update({ flags: { ...confidenceFlags, reason } }).eq('id', submissionId);
      return res.json({ status: 'pending', reason, confidence: matchScore, breakdown: matchBreakdown, flags: confidenceFlags });
    }

    if (matchScore < 70 || minConfidence < minAutoApproveConfidence) {
      // Score 40–69 or team confidence below threshold → flag for review
      const reason = minConfidence < minAutoApproveConfidence
        ? `team confidence ${minConfidence}% below threshold ${minAutoApproveConfidence}% (match score: ${matchScore})`
        : `match score ${matchScore} (${label}) below auto-approve threshold`;
      await supabase.from('match_submissions').update({
        flags: { ...confidenceFlags, reason, candidateMatchId: scheduleMatch.id },
      }).eq('id', submissionId);
      return res.json({
        status: 'flagged',
        reason,
        confidence: matchScore,
        breakdown: matchBreakdown,
        candidateMatchId: scheduleMatch.id,
        flags: confidenceFlags,
      });
    }

    // 9. Auto-approve: score >= 70 AND team confidence >= threshold
    const approvalMethod = minConfidence >= 90 ? 'auto' : 'fuzzy-auto';

    await supabase.from('match_submissions').update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      flags: { ...confidenceFlags, approvedMatchId: scheduleMatch.id, method: approvalMethod },
    }).eq('id', submissionId);

    await supabase.from('audit_log').insert({
      tournament_id: tournamentId,
      action: approvalMethod === 'auto' ? 'auto_approve' : 'fuzzy_auto_approve',
      entity_type: 'match_submission',
      entity_id: submissionId,
      actor: 'auto-approve-engine',
      diff: { flags: confidenceFlags, matchId: scheduleMatch.id },
    });

    // Fire-and-forget wiki auto-publish if enabled
    if (settings.wikiAutoPublish) {
      const baseUrl = `https://${req.headers.host || 'qwicky.vercel.app'}`;
      await fetch(`${baseUrl}/api/wiki/auto-publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, divisionId }),
      }).catch(() => {}); // Best-effort — errors are silently ignored
    }

    return res.json({
      status: 'approved',
      matchId: scheduleMatch.id,
      confidence: matchScore,
      confidenceLabel: label,
      breakdown: matchBreakdown,
      method: approvalMethod,
      teams: { t1: r1.team.name, t2: r2.team.name },
    });

  } catch (err) {
    console.error('[auto-approve] Error:', err.message);
    return res.status(500).json({ status: 'error', error: err.message });
  }
}
