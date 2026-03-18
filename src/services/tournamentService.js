// src/services/tournamentService.js
// CRUD functions for the QWICKY Supabase tournament schema.
// All functions return data in the same camelCase flat shape the UI expects.
// This layer is the bridge between the relational DB and the frontend state.

import { supabase, isSupabaseEnabled } from './supabaseClient.js';

// ── Slug helper ───────────────────────────────────────────────────────────────

/**
 * Derive a URL-safe slug from a tournament name.
 * Matches the ID used by the Discord bot and match_submissions table.
 */
export function tournamentSlug(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'unnamed';
}

// ── DB ↔ UI converters ────────────────────────────────────────────────────────

function dbDivisionToUI(row) {
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
    // Populated separately
    teams: [],
    schedule: [],
    bracket: {},
    rawMaps: [],
  };
}

function uiDivisionToDB(div, tournamentId, sortOrder = 0) {
  return {
    id: div.id,
    tournament_id: tournamentId,
    name: div.name,
    format: div.format,
    num_groups: div.numGroups,
    teams_per_group: div.teamsPerGroup,
    advance_count: div.advanceCount,
    group_stage_best_of: div.groupStageBestOf,
    group_stage_type: div.groupStageType,
    group_meetings: div.groupMeetings,
    match_pace: div.matchPace,
    playoff_format: div.playoffFormat,
    playoff_teams: div.playoffTeams,
    playoff_r32_best_of: div.playoffR32BestOf,
    playoff_r32_type: div.playoffR32Type,
    playoff_r16_best_of: div.playoffR16BestOf,
    playoff_r16_type: div.playoffR16Type,
    playoff_qf_best_of: div.playoffQFBestOf,
    playoff_qf_type: div.playoffQFType,
    playoff_sf_best_of: div.playoffSFBestOf,
    playoff_sf_type: div.playoffSFType,
    playoff_final_best_of: div.playoffFinalBestOf,
    playoff_final_type: div.playoffFinalType,
    playoff_3rd_best_of: div.playoff3rdBestOf,
    playoff_3rd_type: div.playoff3rdType,
    playoff_losers_best_of: div.playoffLosersBestOf,
    playoff_losers_type: div.playoffLosersType,
    playoff_grand_final_best_of: div.playoffGrandFinalBestOf,
    playoff_grand_final_type: div.playoffGrandFinalType,
    playoff_bracket_reset: div.playoffBracketReset,
    playoff_tiers: div.playoffTiers || [],
    points_win: div.pointsWin,
    points_loss: div.pointsLoss,
    tie_breakers: div.tieBreakers,
    sort_order: sortOrder,
    updated_at: new Date().toISOString(),
  };
}

function dbTeamToUI(row) {
  // players stored as JSONB string array in DB; as comma-sep string in UI
  const players = Array.isArray(row.players)
    ? row.players.join(', ')
    : (row.players || '');
  return {
    id: row.id,
    name: row.name,
    tag: row.tag,
    country: row.country,
    players,
    group: row.group,
  };
}

function uiTeamToDB(team, divisionId, tournamentId, sortOrder = 0) {
  const players = typeof team.players === 'string'
    ? team.players.split(',').map(p => p.trim()).filter(Boolean)
    : (Array.isArray(team.players) ? team.players : []);
  return {
    id: team.id,
    division_id: divisionId,
    tournament_id: tournamentId,
    name: team.name,
    tag: team.tag || '',
    country: team.country || '',
    players,
    group: team.group || '',
    sort_order: sortOrder,
    updated_at: new Date().toISOString(),
  };
}

function dbMatchToUI(row) {
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
    maps: [], // populated separately from match_maps
  };
}

function uiMatchToDB(match, divisionId, tournamentId) {
  return {
    id: match.id,
    division_id: divisionId,
    tournament_id: tournamentId,
    team1: match.team1 || '',
    team2: match.team2 || '',
    status: match.status || 'scheduled',
    round: match.round || 'group',
    group: match.group || '',
    round_num: match.roundNum || 1,
    meeting: match.meeting || 1,
    best_of: match.bestOf || 3,
    match_date: match.date || null,
    match_time: match.time || null,
    forfeit: match.forfeit || null,
    updated_at: new Date().toISOString(),
  };
}

function uiMapToDB(mapResult, matchId, divisionId) {
  return {
    id: mapResult.id,
    match_id: matchId,
    division_id: divisionId,
    map_name: mapResult.map,
    score1: mapResult.score1 || 0,
    score2: mapResult.score2 || 0,
    forfeit: mapResult.forfeit || null,
  };
}

// ── Sync ──────────────────────────────────────────────────────────────────────

/**
 * Sync entire tournament state to Supabase (upsert all tables).
 * Fire-and-forget safe: always resolves, never throws.
 * Call this from the localStorage useEffect in App.jsx as a side-effect.
 *
 * @param {object} tournament - Full tournament state from App.jsx
 * @param {string|null} activeDivisionId
 * @returns {Promise<{ ok: boolean, error?: string, reason?: string }>}
 */
export async function syncTournament(tournament, activeDivisionId = null) {
  if (!isSupabaseEnabled) return { ok: false, reason: 'disabled' };

  const tid = tournamentSlug(tournament.name);
  if (!tid || tid === 'unnamed') return { ok: false, reason: 'no-name' };

  try {
    // 1. Upsert tournament row
    const { error: tErr } = await supabase
      .from('tournaments')
      .upsert({
        id: tid,
        name: tournament.name,
        mode: tournament.mode || '4on4',
        start_date: tournament.startDate || null,
        end_date: tournament.endDate || null,
        active_division_id: activeDivisionId || null,
        settings: tournament.settings || {},
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    if (tErr) throw tErr;

    // 2. Upsert each division and its nested data
    for (let i = 0; i < (tournament.divisions || []).length; i++) {
      const div = tournament.divisions[i];

      const { error: dErr } = await supabase
        .from('divisions')
        .upsert(uiDivisionToDB(div, tid, i), { onConflict: 'id' });
      if (dErr) throw dErr;

      // 3. Upsert teams (delete orphans handled by cascade on division delete)
      if (div.teams?.length) {
        const teamRows = div.teams.map((t, idx) => uiTeamToDB(t, div.id, tid, idx));
        const { error: teamErr } = await supabase
          .from('teams')
          .upsert(teamRows, { onConflict: 'id' });
        if (teamErr) throw teamErr;
      }

      // 4. Upsert matches
      if (div.schedule?.length) {
        const matchRows = div.schedule.map(m => uiMatchToDB(m, div.id, tid));
        const { error: matchErr } = await supabase
          .from('matches')
          .upsert(matchRows, { onConflict: 'id' });
        if (matchErr) throw matchErr;

        // Upsert match_maps for all matches that have maps
        const allMaps = div.schedule.flatMap(m =>
          (m.maps || []).map(mp => uiMapToDB(mp, m.id, div.id))
        );
        if (allMaps.length) {
          const { error: mapErr } = await supabase
            .from('match_maps')
            .upsert(allMaps, { onConflict: 'id' });
          if (mapErr) throw mapErr;
        }
      }

      // 5. Upsert bracket JSONB
      if (div.bracket && Object.keys(div.bracket).length) {
        const { error: bErr } = await supabase
          .from('brackets')
          .upsert({
            division_id: div.id,
            tier_id: null,
            bracket_data: div.bracket,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'division_id,tier_id' });
        if (bErr) throw bErr;
      }
    }

    return { ok: true };
  } catch (err) {
    console.warn('[Supabase] syncTournament failed:', err.message);
    return { ok: false, error: err.message };
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * List all tournaments for the landing screen selector.
 * Returns lightweight summary rows (no divisions/teams).
 */
export async function listTournaments() {
  if (!isSupabaseEnabled) return [];

  const { data, error } = await supabase
    .from('tournaments')
    .select('id, name, mode, start_date, end_date, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    console.warn('[Supabase] listTournaments failed:', error.message);
    return [];
  }

  return (data || []).map(t => ({
    id: t.id,
    name: t.name,
    mode: t.mode,
    startDate: t.start_date,
    endDate: t.end_date,
    updatedAt: t.updated_at,
  }));
}

/**
 * Load a full tournament from Supabase, returning UI-shaped state.
 * Returns null if not found or Supabase is disabled.
 */
export async function loadTournament(tournamentId) {
  if (!isSupabaseEnabled) return null;

  const { data: tData, error: tErr } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();
  if (tErr || !tData) return null;

  const { data: divData } = await supabase
    .from('divisions')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('sort_order');

  const divisions = await Promise.all((divData || []).map(async divRow => {
    const div = dbDivisionToUI(divRow);

    // Teams
    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .eq('division_id', div.id)
      .order('sort_order');
    div.teams = (teamData || []).map(dbTeamToUI);

    // Matches
    const { data: matchData } = await supabase
      .from('matches')
      .select('*')
      .eq('division_id', div.id)
      .order('round_num')
      .order('id');

    // Match maps (batch fetch for all matches)
    const matchMapsByMatchId = {};
    if (matchData?.length) {
      const matchIds = matchData.map(m => m.id);
      const { data: mapData } = await supabase
        .from('match_maps')
        .select('*')
        .in('match_id', matchIds);
      (mapData || []).forEach(mp => {
        if (!matchMapsByMatchId[mp.match_id]) matchMapsByMatchId[mp.match_id] = [];
        matchMapsByMatchId[mp.match_id].push({
          id: mp.id,
          map: mp.map_name,
          score1: mp.score1,
          score2: mp.score2,
          forfeit: mp.forfeit,
        });
      });
    }

    div.schedule = (matchData || []).map(m => ({
      ...dbMatchToUI(m),
      maps: matchMapsByMatchId[m.id] || [],
    }));

    // Bracket
    const { data: bracketData } = await supabase
      .from('brackets')
      .select('bracket_data')
      .eq('division_id', div.id)
      .is('tier_id', null)
      .maybeSingle();
    if (bracketData) {
      div.bracket = bracketData.bracket_data;
    }

    return div;
  }));

  return {
    id: tData.id,
    name: tData.name,
    mode: tData.mode,
    startDate: tData.start_date,
    endDate: tData.end_date,
    settings: tData.settings || {},
    divisions,
    activeDivisionId: tData.active_division_id || (divisions.length > 0 ? divisions[0].id : null),
  };
}

// ── Aliases ───────────────────────────────────────────────────────────────────

/**
 * Get all aliases for a tournament (including global aliases).
 */
export async function getAliases(tournamentId) {
  if (!isSupabaseEnabled) return [];

  const { data, error } = await supabase
    .from('team_aliases')
    .select('*')
    .or(`tournament_id.eq.${tournamentId},is_global.eq.true`);

  if (error) {
    console.warn('[Supabase] getAliases failed:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Add a new alias mapping.
 */
export async function addAlias({ tournamentId, teamId, alias, canonical, isGlobal = false, source = 'manual' }) {
  if (!isSupabaseEnabled) return null;

  const { data, error } = await supabase
    .from('team_aliases')
    .insert({
      tournament_id: isGlobal ? null : tournamentId,
      team_id: teamId || null,
      alias: alias.toLowerCase().trim(),
      canonical,
      is_global: isGlobal,
      source,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Audit log ─────────────────────────────────────────────────────────────────

/**
 * Write an audit log entry (fire-and-forget).
 */
export async function logAudit({ tournamentId, action, entityType, entityId, actor = 'admin', diff }) {
  if (!isSupabaseEnabled) return;
  await supabase.from('audit_log').insert({
    tournament_id: tournamentId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    actor,
    diff: diff || null,
  });
}
