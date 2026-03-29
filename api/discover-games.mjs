// api/discover-games.mjs
// Tournament game discovery endpoint.
// Queries ParadokS QW Stats API (primary) or Hub Supabase (fallback)
// for games matching scheduled matchups, applies confidence model.
//
// POST /api/discover-games
// Body: { tournamentId, divisionId? }
//
// Returns: { ok, candidates: [{ series, confidence, games }], summary }

import { createClient } from '@supabase/supabase-js';
import {
  normalizeQW, resolveTeamTag, applyHardGates,
  scoreConfidence, groupIntoSeries,
} from '../src/utils/confidenceModel.js';

const supabase = createClient(
  process.env.QWICKY_SUPABASE_URL,
  process.env.QWICKY_SUPABASE_SERVICE_KEY
);

const QW_STATS_API = 'https://qw-api.poker-affiliate.org';
const HUB_SUPABASE = 'https://ncsphkjfominimxztjip.supabase.co/rest/v1';
const HUB_KEY = process.env.HUB_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jc3Boa2pmb21pbmlteHp0amlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTY5Mzg1NjMsImV4cCI6MjAxMjUxNDU2M30.NN6hjlEW-qB4Og9hWAVlgvUdwrbBO13s8OkAJuBGVbo';

// ── Fetch games from ParadokS API ───────────────────────────────────────────

async function fetchFromParadoks(tag1, tag2, months = 6) {
  try {
    const url = `${QW_STATS_API}/api/h2h?teamA=${encodeURIComponent(tag1)}&teamB=${encodeURIComponent(tag2)}&months=${months}&limit=50`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.games || []).map(g => ({
      id: g.id,
      timestamp: g.playedAt,
      map: g.map,
      teams: [
        { name: data.teamA, frags: g.teamAFrags },
        { name: data.teamB, frags: g.teamBFrags },
      ],
      matchtag: g.matchtag || null,
      players: g.players || [],
      _source: 'paradoks',
    }));
  } catch {
    return null;
  }
}

// ── Fetch games from Hub Supabase (fallback) ────────────────────────────────

async function fetchFromHub(tag1, tag2, startDate, endDate) {
  try {
    // Query by team_names which is a lowercased text array for search
    const url = `${HUB_SUPABASE}/v1_games?mode=eq.4on4&timestamp=gte.${startDate}T00:00:00Z&timestamp=lte.${endDate}T23:59:59Z&select=id,timestamp,map,matchtag,teams,players,hostname&order=timestamp.asc&limit=200`;
    const res = await fetch(url, {
      headers: { apikey: HUB_KEY, Authorization: `Bearer ${HUB_KEY}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const games = await res.json();

    // Filter to games where both tags appear
    const n1 = normalizeQW(tag1);
    const n2 = normalizeQW(tag2);
    return games.filter(g => {
      const teamNames = (g.teams || []).map(t => normalizeQW(typeof t === 'object' ? t.name : t));
      return teamNames.some(t => t === n1) && teamNames.some(t => t === n2);
    });
  } catch {
    return [];
  }
}

// ── Main handler ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { tournamentId, divisionId, config: directConfig } = req.body || {};

  // Accept direct config (for testing) or load from Supabase
  let tournamentConfig;

  if (directConfig) {
    tournamentConfig = directConfig;
  } else if (tournamentId) {
    // Load from Supabase
    const { data: tournament } = await supabase
      .from('tournaments').select('*').eq('id', tournamentId).single();
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    const { data: divisions } = await supabase
      .from('divisions').select('*').eq('tournament_id', tournamentId);
    const { data: teams } = await supabase
      .from('teams').select('*').eq('tournament_id', tournamentId);
    const { data: matches } = await supabase
      .from('matches').select('*').eq('tournament_id', tournamentId);
    const { data: aliases } = await supabase
      .from('team_aliases').select('*')
      .or(`tournament_id.eq.${tournamentId},is_global.eq.true`);

    tournamentConfig = {
      name: tournament.name,
      mode: tournament.settings?.mode || '4on4',
      startDate: tournament.settings?.startDate || '',
      endDate: tournament.settings?.endDate || '',
      mapPool: tournament.settings?.mapPool || ['dm2', 'dm3', 'e1m2', 'schloss', 'phantombase'],
      tagPatterns: tournament.settings?.discoveryConfig?.tagPatterns || [],
      threshold: tournament.settings?.discoveryConfig?.confidenceThreshold || 70,
      divisions: (divisions || []).map(div => ({
        id: div.id,
        name: div.name,
        teams: (teams || []).filter(t => t.division_id === div.id),
        schedule: (matches || []).filter(m => m.division_id === div.id),
        isPlayoffs: div.format === 'single-elim' || div.format === 'double-elim',
        bestOf: div.group_stage_best_of || 3,
      })),
      aliasMap: Object.fromEntries((aliases || []).map(a => [normalizeQW(a.alias), a.canonical.toLowerCase()])),
    };
  } else {
    return res.status(400).json({ error: 'tournamentId or config required' });
  }

  const allCandidates = [];
  const summary = { scanned: 0, passed: 0, rejected: 0, byRejection: {} };

  // Process each division (or filter to one)
  const divisionsToProcess = divisionId
    ? tournamentConfig.divisions.filter(d => d.id === divisionId)
    : tournamentConfig.divisions;

  for (const div of divisionsToProcess) {
    const mapPool = new Set(tournamentConfig.mapPool);
    const processedIds = new Set();

    // Build unique matchups to scan
    const matchups = new Set();
    if (div.isPlayoffs) {
      // Playoffs: scan every team pair in the division
      for (let i = 0; i < div.teams.length; i++) {
        for (let j = i + 1; j < div.teams.length; j++) {
          matchups.add(`${div.teams[i].name}|||${div.teams[j].name}`);
        }
      }
    } else {
      // Groups: scan only scheduled matchups
      for (const match of div.schedule) {
        if (match.status === 'completed') continue; // Skip already completed
        matchups.add(`${match.team1}|||${match.team2}`);
      }
    }

    // For each matchup, fetch and score games
    for (const matchupKey of matchups) {
      const [t1Name, t2Name] = matchupKey.split('|||');
      const t1 = div.teams.find(t => t.name === t1Name);
      const t2 = div.teams.find(t => t.name === t2Name);
      if (!t1 || !t2) continue;

      const tag1 = normalizeQW(t1.tag || t1.name);
      const tag2 = normalizeQW(t2.tag || t2.name);
      if (!tag1 || !tag2) continue;

      // Fetch games: ParadokS first, Hub fallback
      let games = await fetchFromParadoks(tag1, tag2);
      let source = 'paradoks';

      if (!games || games.length === 0) {
        games = await fetchFromHub(tag1, tag2, tournamentConfig.startDate, tournamentConfig.endDate);
        source = 'hub';
      }

      if (!games || games.length === 0) continue;

      // Filter by date range
      const startMs = new Date(tournamentConfig.startDate).getTime();
      const endMs = tournamentConfig.endDate
        ? new Date(tournamentConfig.endDate).getTime()
        : Date.now();

      const dateFiltered = games.filter(g => {
        const t = new Date(g.timestamp || g.date).getTime();
        return t >= startMs && t <= endMs;
      });

      // Apply hard gates + scoring
      const config = {
        teams: div.teams,
        mapPool,
        mode: tournamentConfig.mode,
        schedule: div.schedule,
        isPlayoffs: div.isPlayoffs,
        processedIds,
        aliasMap: tournamentConfig.aliasMap || {},
      };

      const passing = [];
      for (const game of dateFiltered) {
        summary.scanned++;
        const gateResult = applyHardGates(game, config);

        if (!gateResult.pass) {
          summary.rejected++;
          summary.byRejection[gateResult.rejectedBy] = (summary.byRejection[gateResult.rejectedBy] || 0) + 1;
          continue;
        }

        processedIds.add(String(game.id));
        game._resolved1 = gateResult.team1.team.name;
        game._resolved2 = gateResult.team2.team.name;

        passing.push({ game, gateResult });
        summary.passed++;
      }

      // Group into series and score
      if (passing.length > 0) {
        const passGames = passing.map(p => p.game);
        const series = groupIntoSeries(passGames);

        for (const s of series) {
          // Score each game in the series
          const scoredGames = s.games.map(game => {
            const gateResult = passing.find(p => p.game.id === game.id)?.gateResult;
            const score = scoreConfidence(game, gateResult, {
              schedule: div.schedule,
              seriesMapCount: s.games.length,
              expectedBestOf: div.bestOf || 3,
              tagPatterns: tournamentConfig.tagPatterns,
            });
            return { ...game, confidence: score };
          });

          const avgConfidence = Math.round(
            scoredGames.reduce((sum, g) => sum + g.confidence.total, 0) / scoredGames.length
          );

          allCandidates.push({
            division: div.name,
            team1: s.team1,
            team2: s.team2,
            mapCount: s.games.length,
            avgConfidence,
            source,
            games: scoredGames.map(g => ({
              id: g.id,
              map: g.map,
              timestamp: g.timestamp,
              confidence: g.confidence,
              teams: g.teams,
            })),
          });
        }
      }
    }
  }

  // Sort by confidence
  allCandidates.sort((a, b) => b.avgConfidence - a.avgConfidence);

  return res.json({
    ok: true,
    candidates: allCandidates,
    summary: {
      ...summary,
      seriesFound: allCandidates.length,
      totalMaps: allCandidates.reduce((sum, c) => sum + c.mapCount, 0),
    },
  });
}
