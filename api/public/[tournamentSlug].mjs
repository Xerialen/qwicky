// api/public/[tournamentSlug].mjs
// Public read-only endpoint: full tournament data for a given slug.
// GET /api/public/:tournamentSlug

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.QWICKY_SUPABASE_URL,
  process.env.QWICKY_SUPABASE_SERVICE_KEY
);

// ── snake_case → camelCase converters (mirrors tournamentService.js) ─────────

function mapDivision(row) {
  return {
    id: row.id,
    name: row.name,
    format: row.format,
    numGroups: row.num_groups,
    teamsPerGroup: row.teams_per_group,
    advanceCount: row.advance_count,
    groupStageBestOf: row.group_stage_best_of,
    groupStageType: row.group_stage_type,
    groupMeetings: row.group_meetings,
    matchPace: row.match_pace,
    playoffFormat: row.playoff_format,
    playoffTeams: row.playoff_teams,
    playoffR32BestOf: row.playoff_r32_best_of,
    playoffR32Type: row.playoff_r32_type,
    playoffR16BestOf: row.playoff_r16_best_of,
    playoffR16Type: row.playoff_r16_type,
    playoffQFBestOf: row.playoff_qf_best_of,
    playoffQFType: row.playoff_qf_type,
    playoffSFBestOf: row.playoff_sf_best_of,
    playoffSFType: row.playoff_sf_type,
    playoffFinalBestOf: row.playoff_final_best_of,
    playoffFinalType: row.playoff_final_type,
    playoff3rdBestOf: row.playoff_3rd_best_of,
    playoff3rdType: row.playoff_3rd_type,
    playoffLosersBestOf: row.playoff_losers_best_of,
    playoffLosersType: row.playoff_losers_type,
    playoffGrandFinalBestOf: row.playoff_grand_final_best_of,
    playoffGrandFinalType: row.playoff_grand_final_type,
    playoffBracketReset: row.playoff_bracket_reset,
    playoffTiers: row.playoff_tiers || [],
    pointsWin: row.points_win,
    pointsLoss: row.points_loss,
    tieBreakers: row.tie_breakers || ['mapDiff', 'fragDiff', 'headToHead'],
  };
}

function mapTeam(row) {
  return {
    id: row.id,
    name: row.name,
    tag: row.tag,
    country: row.country,
    players: Array.isArray(row.players) ? row.players : [],
    group: row.group,
  };
}

function mapMatch(row, maps) {
  return {
    id: row.id,
    team1: row.team1,
    team2: row.team2,
    status: row.status,
    round: row.round,
    group: row.group,
    roundNum: row.round_num,
    meeting: row.meeting,
    bestOf: row.best_of,
    date: row.match_date,
    time: row.match_time,
    forfeit: row.forfeit,
    maps: (maps || []).map(mp => ({
      id: mp.id,
      map: mp.map_name,
      score1: mp.score1,
      score2: mp.score2,
      forfeit: mp.forfeit,
    })),
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=60');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const { tournamentSlug } = req.query;

  if (!tournamentSlug) {
    return res.status(400).json({ error: 'tournamentSlug is required' });
  }

  try {
    // 1. Load tournament
    const { data: tData, error: tErr } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentSlug)
      .single();

    if (tErr || !tData) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // 2. Load divisions
    const { data: divData } = await supabase
      .from('divisions')
      .select('*')
      .eq('tournament_id', tournamentSlug)
      .order('sort_order');

    // 3. For each division, load teams, matches, match_maps, bracket
    const divisions = await Promise.all((divData || []).map(async divRow => {
      const div = mapDivision(divRow);

      // Teams
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('division_id', div.id)
        .order('sort_order');
      div.teams = (teamData || []).map(mapTeam);

      // Matches
      const { data: matchData } = await supabase
        .from('matches')
        .select('*')
        .eq('division_id', div.id)
        .order('round_num')
        .order('id');

      // Match maps (batch fetch)
      const matchMapsByMatchId = {};
      if (matchData?.length) {
        const matchIds = matchData.map(m => m.id);
        const { data: mapData } = await supabase
          .from('match_maps')
          .select('*')
          .in('match_id', matchIds);
        (mapData || []).forEach(mp => {
          if (!matchMapsByMatchId[mp.match_id]) matchMapsByMatchId[mp.match_id] = [];
          matchMapsByMatchId[mp.match_id].push(mp);
        });
      }

      div.schedule = (matchData || []).map(m => mapMatch(m, matchMapsByMatchId[m.id]));

      // Bracket
      const { data: bracketData } = await supabase
        .from('brackets')
        .select('bracket_data')
        .eq('division_id', div.id)
        .is('tier_id', null)
        .maybeSingle();
      if (bracketData) {
        div.bracket = bracketData.bracket_data;
      } else {
        div.bracket = {};
      }

      return div;
    }));

    // 4. Shape response
    return res.json({
      tournament: {
        name: tData.name,
        mode: tData.mode,
        startDate: tData.start_date,
        endDate: tData.end_date,
      },
      divisions,
      updatedAt: tData.updated_at,
    });
  } catch (err) {
    console.error('[public/tournamentSlug] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch tournament data' });
  }
}
