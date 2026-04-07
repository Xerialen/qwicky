// api/discover-games.mjs
// Tournament game discovery — queries Turso QW Stats database.
import { createClient } from '@supabase/supabase-js';
import {
  normalizeQW, applyHardGates, scoreConfidence, groupIntoSeries,
  scoreRosterOverlap,
} from '../src/utils/confidenceModel.js';
import { requireAdminAuth } from './_auth.mjs';
import { discoverGames, getGamePlayers, getTeamAliases } from './lib/tursoClient.mjs';

const supabase = createClient(
  process.env.QWICKY_SUPABASE_URL,
  process.env.QWICKY_SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!await requireAdminAuth(req, res)) return;

  const { tournamentId, divisionId, config: directConfig } = req.body || {};

  let tournamentConfig;

  if (directConfig) {
    tournamentConfig = directConfig;
  } else if (tournamentId) {
    const { data: tournament } = await supabase
      .from('tournaments').select('*').eq('id', tournamentId).single();
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    const { data: divisions } = await supabase
      .from('divisions').select('*').eq('tournament_id', tournamentId);
    const { data: teams } = await supabase
      .from('teams').select('*').eq('tournament_id', tournamentId);
    const { data: matches } = await supabase
      .from('matches').select('*').eq('tournament_id', tournamentId);

    tournamentConfig = {
      name: tournament.name,
      mode: tournament.settings?.mode || '4on4',
      startDate: tournament.settings?.startDate || '',
      endDate: tournament.settings?.endDate || '',
      mapPool: tournament.settings?.mapPool || ['dm2', 'dm3', 'e1m2', 'schloss', 'phantombase'],
      threshold: tournament.settings?.discoveryConfig?.confidenceThreshold || 70,
      divisions: (divisions || []).map(div => ({
        id: div.id,
        name: div.name,
        teams: (teams || []).filter(t => t.division_id === div.id),
        schedule: (matches || []).filter(m => m.division_id === div.id),
        isPlayoffs: div.format === 'single-elim' || div.format === 'double-elim',
        bestOf: div.group_stage_best_of || 3,
      })),
    };
  } else {
    return res.status(400).json({ error: 'tournamentId or config required' });
  }

  const allCandidates = [];
  const summary = { scanned: 0, passed: 0, rejected: 0, byRejection: {} };

  const divisionsToProcess = divisionId
    ? tournamentConfig.divisions.filter(d => d.id === divisionId)
    : tournamentConfig.divisions;

  for (const div of divisionsToProcess) {
    const mapPool = new Set(tournamentConfig.mapPool);
    const processedSha = new Set();

    // Build matchups
    const matchups = new Set();
    if (div.isPlayoffs) {
      for (let i = 0; i < div.teams.length; i++) {
        for (let j = i + 1; j < div.teams.length; j++) {
          matchups.add(`${div.teams[i].name}|||${div.teams[j].name}`);
        }
      }
    } else {
      for (const match of div.schedule) {
        if (match.status === 'completed') continue;
        matchups.add(`${match.team1}|||${match.team2}`);
      }
    }

    for (const matchupKey of matchups) {
      const [t1Name, t2Name] = matchupKey.split('|||');
      const t1 = div.teams.find(t => t.name === t1Name);
      const t2 = div.teams.find(t => t.name === t2Name);
      if (!t1 || !t2) continue;

      const tag1 = t1.tag || t1.name;
      const tag2 = t2.tag || t2.name;

      // Resolve aliases from Turso
      const aliases1 = await getTeamAliases(tag1);
      const aliases2 = await getTeamAliases(tag2);

      const allAliases1 = [...new Set([...aliases1, tag1, normalizeQW(tag1)])];
      const allAliases2 = [...new Set([...aliases2, tag2, normalizeQW(tag2)])];

      // Query Turso
      const games = await discoverGames({
        mode: tournamentConfig.mode,
        startDate: tournamentConfig.startDate,
        endDate: tournamentConfig.endDate || new Date().toISOString().split('T')[0],
        teamAliases1: allAliases1,
        teamAliases2: allAliases2,
      });

      if (!games || games.length === 0) continue;

      const passing = [];
      for (const game of games) {
        if (processedSha.has(game.sha256)) continue;
        summary.scanned++;

        const gameObj = {
          id: game.hub_id || game.sha256,
          timestamp: game.date,
          map: game.map,
          teams: [
            { name: game.team1, frags: game.score1 },
            { name: game.team2, frags: game.score2 },
          ],
          _source: 'turso',
        };

        const config = {
          teams: div.teams,
          mapPool,
          mode: tournamentConfig.mode,
          schedule: div.schedule,
          isPlayoffs: div.isPlayoffs,
          processedIds: processedSha,
          aliasMap: {},
        };

        const gateResult = applyHardGates(gameObj, config);
        if (!gateResult.pass) {
          summary.rejected++;
          summary.byRejection[gateResult.rejectedBy] =
            (summary.byRejection[gateResult.rejectedBy] || 0) + 1;
          continue;
        }

        processedSha.add(game.sha256);
        gameObj._resolved1 = gateResult.team1?.team?.name || game.team1;
        gameObj._resolved2 = gateResult.team2?.team?.name || game.team2;

        // Roster scoring
        let rosterScore = 0;
        const roster1 = t1.players || [];
        const roster2 = t2.players || [];
        if (roster1.length > 0 && roster2.length > 0) {
          const gamePlayers = await getGamePlayers(game.sha256);
          const labeledPlayers = gamePlayers.map(p => ({
            name: p.player_name,
            side: p.team.toLowerCase() === game.team1.toLowerCase() ? 'team1' : 'team2',
          }));
          rosterScore = scoreRosterOverlap(roster1, roster2, labeledPlayers);
        }

        passing.push({ game: gameObj, gateResult, rosterScore });
        summary.passed++;
      }

      if (passing.length > 0) {
        const passGames = passing.map(p => p.game);
        const series = groupIntoSeries(passGames);

        for (const s of series) {
          const scoredGames = s.games.map(game => {
            const p = passing.find(pp => pp.game.id === game.id);
            const score = scoreConfidence(game, p?.gateResult, {
              schedule: div.schedule,
              seriesMapCount: s.games.length,
              expectedBestOf: div.bestOf || 3,
            });

            const totalWithRoster = Math.min(100,
              score.total + (p?.rosterScore || 0));

            return {
              ...game,
              confidence: { ...score, roster: p?.rosterScore || 0, total: totalWithRoster },
            };
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
            source: 'turso',
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
