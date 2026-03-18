// api/wiki/auto-publish.mjs
// Server-side wiki auto-publish. Called by auto-approve after a successful
// approval — publishes wiki content without any browser involvement.
//
// POST /api/wiki/auto-publish
// Body: { tournamentId, divisionId }
//
// Loads tournament data from Supabase, generates wiki markup, publishes
// to configured targets. Fire-and-forget — errors are logged, not fatal.

import { createClient } from '@supabase/supabase-js';
import {
  createWikiClient, editPage, findSectionByHeading,
  getPageContent, findBoilerplateBoundary,
} from './_wikiClient.mjs';
import {
  calculateStandings,
  generateStandingsWiki,
  generateMatchListWiki,
  generateBracketWiki,
} from '../../src/utils/qwikiMarkup.js';

const supabase = createClient(
  process.env.QWICKY_SUPABASE_URL,
  process.env.QWICKY_SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { tournamentId, divisionId } = req.body || {};
  if (!tournamentId) {
    return res.status(400).json({ ok: false, error: 'tournamentId required' });
  }

  try {
    // 1. Load tournament settings
    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .select('id, name, settings')
      .eq('id', tournamentId)
      .single();

    if (tErr || !tournament) {
      return res.json({ ok: false, error: 'Tournament not found' });
    }

    if (!tournament.settings?.wikiAutoPublish) {
      return res.json({ ok: false, error: 'Wiki auto-publish not enabled' });
    }

    // 2. Load division(s) — either specific or all
    const divQuery = supabase
      .from('divisions')
      .select('id, name, format, num_groups, teams_per_group, advance_count, group_stage_best_of, group_stage_type, group_meetings, points_win, points_loss, tie_breakers, playoff_format, playoff_teams, wiki_config')
      .eq('tournament_id', tournamentId);

    if (divisionId) divQuery.eq('id', divisionId);

    const { data: divisions } = await divQuery;
    if (!divisions?.length) {
      return res.json({ ok: false, error: 'No divisions found' });
    }

    const results = [];

    for (const divRow of divisions) {
      const wikiConfig = divRow.wiki_config || {};
      if (!wikiConfig.enabled || !wikiConfig.targets?.length) continue;

      // 3. Load teams and schedule for this division
      const [{ data: teamData }, { data: matchData }] = await Promise.all([
        supabase.from('teams').select('*').eq('division_id', divRow.id),
        supabase.from('matches').select('*').eq('division_id', divRow.id),
      ]);

      const teams = (teamData || []).map(t => ({
        name: t.name, tag: t.tag, country: t.country,
        players: t.players || '', aliases: t.aliases || [], group: t.group_name,
      }));

      // Load match maps
      const matchIds = (matchData || []).map(m => m.id);
      let mapsByMatch = {};
      if (matchIds.length > 0) {
        const { data: mapData } = await supabase
          .from('match_maps')
          .select('*')
          .in('match_id', matchIds);
        (mapData || []).forEach(mp => {
          if (!mapsByMatch[mp.match_id]) mapsByMatch[mp.match_id] = [];
          mapsByMatch[mp.match_id].push({
            id: mp.id, map: mp.map_name,
            score1: mp.score1, score2: mp.score2, forfeit: mp.forfeit,
          });
        });
      }

      const schedule = (matchData || []).map(m => ({
        id: m.id, team1: m.team1, team2: m.team2, status: m.status,
        round: m.round, group: m.group_name, roundNum: m.round_num,
        bestOf: m.best_of, date: m.match_date, time: m.match_time,
        maps: mapsByMatch[m.id] || [], forfeit: m.forfeit,
      }));

      // Build division object matching frontend shape
      const division = {
        ...divRow,
        name: divRow.name,
        teams,
        schedule,
        pointsWin: divRow.points_win ?? 3,
        pointsLoss: divRow.points_loss ?? 0,
        groupStageType: divRow.group_stage_type || 'bestof',
        tieBreakers: divRow.tie_breakers || ['mapDiff', 'fragDiff', 'headToHead'],
        advanceCount: divRow.advance_count || 2,
      };

      // Load bracket if needed
      const hasBracketTarget = wikiConfig.targets.some(t => t.type === 'bracket');
      if (hasBracketTarget) {
        const { data: bracketData } = await supabase
          .from('brackets')
          .select('bracket_data')
          .eq('division_id', divRow.id)
          .is('tier_id', null)
          .maybeSingle();
        if (bracketData) division.bracket = bracketData.bracket_data;
      }

      // 4. Generate and publish each target
      const generators = {
        standings: () => {
          const standings = calculateStandings(schedule, division);
          return generateStandingsWiki(standings, teams, division, {});
        },
        matches: () => generateMatchListWiki(schedule, teams, division, {}),
        bracket: () => division.bracket
          ? generateBracketWiki(division.bracket, schedule, teams, division, {})
          : null,
        full: () => {
          const standings = calculateStandings(schedule, division);
          return generateStandingsWiki(standings, teams, division, {})
            + '\n' + generateMatchListWiki(schedule, teams, division, {});
        },
      };

      const wikiClient = createWikiClient();

      for (const target of wikiConfig.targets) {
        if (!target.page) continue;
        const markup = generators[target.type]?.();
        if (!markup) continue;

        try {
          let result;
          if (target.section) {
            // Section-based publish
            const sectionIndex = await findSectionByHeading(wikiClient, target.page, target.section);
            if (sectionIndex !== null) {
              result = await editPage(wikiClient, target.page, markup, {
                section: sectionIndex,
                summary: `Updated ${target.type} via QWICKY auto-publish`,
              });
            } else {
              result = { ok: false, error: `Section "${target.section}" not found` };
            }
          } else {
            // Full page body publish (preserve boilerplate)
            const page = await getPageContent(wikiClient, target.page);
            if (page.exists) {
              const boundary = findBoilerplateBoundary(page.content);
              const boilerplate = page.content.slice(0, boundary).trimEnd();
              result = await editPage(wikiClient, target.page, boilerplate + '\n' + markup, {
                summary: `Updated ${target.type} via QWICKY auto-publish`,
              });
            } else {
              result = await editPage(wikiClient, target.page, markup, {
                summary: `Created via QWICKY auto-publish`,
              });
            }
          }

          results.push({ division: divRow.name, target: target.type, page: target.page, ...result });
        } catch (err) {
          results.push({ division: divRow.name, target: target.type, page: target.page, ok: false, error: err.message });
        }
      }

      // 5. Audit log
      await supabase.from('audit_log').insert({
        tournament_id: tournamentId,
        action: 'wiki_auto_publish',
        entity_type: 'division',
        entity_id: divRow.id,
        actor: 'auto-publish-engine',
        diff: { results },
      }).catch(() => {}); // Best-effort audit
    }

    return res.json({ ok: true, results });

  } catch (err) {
    console.error('[wiki/auto-publish] Error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
