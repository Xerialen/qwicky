// api/wiki.mjs
// Consolidated wiki endpoint — routes via ?action= query parameter.
//
// GET  ?action=scan&q=...              — fuzzy search wiki pages
// GET  ?action=scan&prefix=...         — deep scan of tournament prefix
// GET  ?action=get-sections&page=...   — page section structure
// POST ?action=scaffold                — batch create pages with boilerplate
// POST ?action=publish                 — publish content to a page
// POST ?action=publish-section         — publish to specific section or body
// POST ?action=auto-publish            — server-side auto-publish from Supabase
// PUT  ?action=config-tournament       — persist tournament wikiConfig
// PUT  ?action=config-division         — persist division wikiConfig

import {
  createWikiClient, searchPages, listPages,
  getSections, getPageContent, findBoilerplateBoundary,
  editPage, findSectionByHeading,
} from './wiki/_wikiClient.mjs';
import { assembleBoilerplate } from './wiki/_boilerplate.mjs';
import { createClient } from '@supabase/supabase-js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getSupabase() {
  return createClient(process.env.QWICKY_SUPABASE_URL, process.env.QWICKY_SUPABASE_SERVICE_KEY);
}

// ── Action handlers ──────────────────────────────────────────────────────────

async function handleScan(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

  const { q, prefix } = req.query || {};
  if (!q && !prefix) {
    return res.status(400).json({ ok: false, error: 'Provide &q=search+terms or &prefix=Page_Prefix' });
  }

  const client = createWikiClient();

  if (q && !prefix) {
    const results = await searchPages(client, q, 30);
    const groups = new Map();
    for (const title of results) {
      const parts = title.split('/');
      const root2 = parts.length >= 2 ? parts.slice(0, 2).join('/') : parts[0];
      const root1 = parts[0];
      const root = results.some(t => t.startsWith(root2 + '/') && t !== root2) ? root2 : root1;
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(title);
    }

    const tournaments = [...groups.entries()].map(([root, pages]) => ({
      root,
      pages: [...new Set(pages)].sort(),
      matchCount: pages.length,
    }));
    return res.status(200).json({ ok: true, tournaments });
  }

  // Deep scan mode
  const pageNames = await listPages(client, prefix);
  const pages = [];

  for (const title of pageNames) {
    const [sectionsResult, contentResult] = await Promise.all([
      getSections(client, title),
      getPageContent(client, title),
    ]);

    const pageInfo = {
      title,
      exists: contentResult.exists,
      sections: sectionsResult.sections || [],
      hasContent: false,
      boilerplate: null,
      bodyPreview: '',
    };

    if (contentResult.exists && contentResult.content) {
      const content = contentResult.content;
      const boundary = findBoilerplateBoundary(content);
      const boilerplateText = content.slice(0, boundary);
      const body = content.slice(boundary).trim();

      pageInfo.hasContent = body.length > 0 && !body.startsWith('{{Abbr/TBD}}');
      pageInfo.bodyPreview = body.slice(0, 200);

      const navboxMatch = boilerplateText.match(/\{\{(\w[\w\s]*?Navbox|[A-Z]+\s*navbox)\}\}/i);
      const tabsMatch = boilerplateText.match(/\{\{Tabs static[\s\S]*?\|This=(\d+)/);
      const infoboxMatch = boilerplateText.match(/\{\{Infobox\s+(league|lan)/i);

      pageInfo.boilerplate = {
        navbox: navboxMatch ? navboxMatch[1] : null,
        tabIndex: tabsMatch ? parseInt(tabsMatch[1]) : null,
        infoboxType: infoboxMatch ? infoboxMatch[1] : null,
      };
    }

    pages.push(pageInfo);
  }

  const hasPlayoffsPage = pages.some(p => p.title.toLowerCase().includes('playoff'));
  const hasDivisionPages = pages.some(p => /division|div\s?\d/i.test(p.title));
  const suggestedLayout = hasPlayoffsPage && hasDivisionPages ? 'multi-page' : 'single-page';

  return res.status(200).json({ ok: true, prefix, pages, suggestedLayout, pageCount: pages.length });
}

async function handleGetSections(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

  const { page } = req.query || {};
  if (!page) return res.status(400).json({ ok: false, error: 'page parameter required' });

  const client = createWikiClient();
  const result = await getSections(client, page);
  return res.status(200).json(result);
}

async function handleScaffold(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { pages, boilerplate, skipExisting = true, summary = 'Created via QWICKY' } = req.body || {};

  if (!pages?.length || !boilerplate) {
    return res.status(400).json({ error: 'pages and boilerplate are required' });
  }
  if (!boilerplate.tabs?.length) {
    return res.status(400).json({ error: 'boilerplate.tabs must be a non-empty array' });
  }

  const client = createWikiClient();
  const created = [];
  const skipped = [];
  const errors = [];

  for (const page of pages) {
    const { title, contentBody = '{{Abbr/TBD}}' } = page;
    if (!title) { errors.push({ title: '(empty)', error: 'Missing page title' }); continue; }

    try {
      if (skipExisting) {
        const existing = await getPageContent(client, title);
        if (existing.exists) { skipped.push({ title, reason: 'already exists' }); continue; }
      }

      const boilerplateText = assembleBoilerplate(boilerplate, title);
      const fullContent = boilerplateText + '\n\n' + contentBody;

      const result = await editPage(client, title, fullContent, {
        summary: `${summary} — ${title.split('/').pop()}`,
      });

      if (result.ok) created.push({ title, pageUrl: result.pageUrl });
      else errors.push({ title, error: result.error || 'Edit failed' });
    } catch (err) {
      errors.push({ title, error: err.message });
    }
  }

  return res.json({
    ok: errors.length === 0, created, skipped, errors,
    total: { created: created.length, skipped: skipped.length, errors: errors.length },
  });
}

async function handlePublish(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const { pageTitle, content, section, summary, credentials } = req.body || {};
  if (!pageTitle || !content) {
    return res.status(400).json({ ok: false, error: 'pageTitle and content are required' });
  }

  const client = createWikiClient(credentials);
  const result = await editPage(client, pageTitle, content, { section, summary });
  return res.status(result.ok ? 200 : 502).json(result);
}

async function handlePublishSection(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const { pageName, sectionHeading, content, summary } = req.body || {};
  if (!pageName || !content) {
    return res.status(400).json({ ok: false, error: 'pageName and content are required' });
  }

  const client = createWikiClient();

  if (sectionHeading) {
    const sectionIndex = await findSectionByHeading(client, pageName, sectionHeading);
    if (sectionIndex === null) {
      const { sections } = await getSections(client, pageName);
      return res.status(404).json({
        ok: false,
        error: `Section "${sectionHeading}" not found on page "${pageName}"`,
        availableSections: sections.map(s => s.heading),
      });
    }

    const editSummary = summary || `Updated ${sectionHeading} via QWICKY`;
    const result = await editPage(client, pageName, content, { section: sectionIndex, summary: editSummary });
    return res.status(result.ok ? 200 : 502).json(result);
  }

  // Full-page body publish: preserve boilerplate
  const page = await getPageContent(client, pageName);
  if (!page.exists) {
    const result = await editPage(client, pageName, content, { summary: summary || 'Created via QWICKY' });
    return res.status(result.ok ? 200 : 502).json(result);
  }

  const boundary = findBoilerplateBoundary(page.content);
  const boilerplate = page.content.slice(0, boundary).trimEnd();
  const newContent = boilerplate + '\n' + content;
  const result = await editPage(client, pageName, newContent, { summary: summary || 'Updated via QWICKY' });
  return res.status(result.ok ? 200 : 502).json(result);
}

async function handleAutoPublish(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const { tournamentId, divisionId } = req.body || {};
  if (!tournamentId) return res.status(400).json({ ok: false, error: 'tournamentId required' });

  const supabase = getSupabase();

  const { data: tournament, error: tErr } = await supabase
    .from('tournaments').select('id, name, settings').eq('id', tournamentId).single();

  if (tErr || !tournament) return res.json({ ok: false, error: 'Tournament not found' });
  if (!tournament.settings?.wikiAutoPublish) return res.json({ ok: false, error: 'Wiki auto-publish not enabled' });

  const divQuery = supabase
    .from('divisions')
    .select('id, name, format, num_groups, teams_per_group, advance_count, group_stage_best_of, group_stage_type, group_meetings, points_win, points_loss, tie_breakers, playoff_format, playoff_teams, wiki_config')
    .eq('tournament_id', tournamentId);
  if (divisionId) divQuery.eq('id', divisionId);

  const { data: divisions } = await divQuery;
  if (!divisions?.length) return res.json({ ok: false, error: 'No divisions found' });

  // Dynamic import to avoid bundling qwikiMarkup at module level
  const { calculateStandings, generateStandingsWiki, generateMatchListWiki, generateBracketWiki } =
    await import('../src/utils/qwikiMarkup.js');

  const results = [];

  for (const divRow of divisions) {
    const wikiConfig = divRow.wiki_config || {};
    if (!wikiConfig.enabled || !wikiConfig.targets?.length) continue;

    const [{ data: teamData }, { data: matchData }] = await Promise.all([
      supabase.from('teams').select('*').eq('division_id', divRow.id),
      supabase.from('matches').select('*').eq('division_id', divRow.id),
    ]);

    const teams = (teamData || []).map(t => ({
      name: t.name, tag: t.tag, country: t.country,
      players: t.players || '', aliases: t.aliases || [], group: t.group,
    }));

    const matchIds = (matchData || []).map(m => m.id);
    let mapsByMatch = {};
    if (matchIds.length > 0) {
      const { data: mapData } = await supabase.from('match_maps').select('*').in('match_id', matchIds);
      (mapData || []).forEach(mp => {
        if (!mapsByMatch[mp.match_id]) mapsByMatch[mp.match_id] = [];
        mapsByMatch[mp.match_id].push({
          id: mp.id, map: mp.map_name, score1: mp.score1, score2: mp.score2, forfeit: mp.forfeit,
        });
      });
    }

    const schedule = (matchData || []).map(m => ({
      id: m.id, team1: m.team1, team2: m.team2, status: m.status,
      round: m.round, group: m.group, roundNum: m.round_num,
      bestOf: m.best_of, date: m.match_date, time: m.match_time,
      maps: mapsByMatch[m.id] || [], forfeit: m.forfeit,
    }));

    const division = {
      ...divRow, name: divRow.name, teams, schedule,
      pointsWin: divRow.points_win ?? 3, pointsLoss: divRow.points_loss ?? 0,
      groupStageType: divRow.group_stage_type || 'bestof',
      tieBreakers: divRow.tie_breakers || ['mapDiff', 'fragDiff', 'headToHead'],
      advanceCount: divRow.advance_count || 2,
    };

    const hasBracketTarget = wikiConfig.targets.some(t => t.type === 'bracket');
    if (hasBracketTarget) {
      const { data: bracketData } = await supabase
        .from('brackets').select('bracket_data').eq('division_id', divRow.id).is('tier_id', null).maybeSingle();
      if (bracketData) division.bracket = bracketData.bracket_data;
    }

    const generators = {
      standings: () => {
        const standings = calculateStandings(schedule, division);
        return generateStandingsWiki(standings, teams, division, {});
      },
      matches: () => generateMatchListWiki(schedule, teams, division, {}),
      bracket: () => division.bracket ? generateBracketWiki(division.bracket, schedule, teams, division, {}) : null,
      full: () => {
        const standings = calculateStandings(schedule, division);
        return generateStandingsWiki(standings, teams, division, {}) + '\n' + generateMatchListWiki(schedule, teams, division, {});
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
          const sectionIndex = await findSectionByHeading(wikiClient, target.page, target.section);
          if (sectionIndex !== null) {
            result = await editPage(wikiClient, target.page, markup, {
              section: sectionIndex, summary: `Updated ${target.type} via QWICKY auto-publish`,
            });
          } else {
            result = { ok: false, error: `Section "${target.section}" not found` };
          }
        } else {
          const page = await getPageContent(wikiClient, target.page);
          if (page.exists) {
            const boundary = findBoilerplateBoundary(page.content);
            const boilerplate = page.content.slice(0, boundary).trimEnd();
            result = await editPage(wikiClient, target.page, boilerplate + '\n' + markup, {
              summary: `Updated ${target.type} via QWICKY auto-publish`,
            });
          } else {
            let fullContent = markup;
            if (tournament?.settings?.wikiConfig) {
              const wc = tournament.settings.wikiConfig;
              if (wc.pages?.length > 0 && (wc.navbox || Object.keys(wc.infobox || {}).length > 0)) {
                const tabs = wc.pages.map(p => ({ name: p.name, link: p.link }));
                const bp = assembleBoilerplate({ navbox: wc.navbox, infobox: wc.infobox || {}, tabs }, target.page);
                fullContent = bp + '\n\n' + markup;
              }
            }
            result = await editPage(wikiClient, target.page, fullContent, {
              summary: 'Created via QWICKY auto-publish',
            });
          }
        }
        results.push({ division: divRow.name, target: target.type, page: target.page, ...result });
      } catch (err) {
        results.push({ division: divRow.name, target: target.type, page: target.page, ok: false, error: err.message });
      }
    }

    await supabase.from('audit_log').insert({
      tournament_id: tournamentId, action: 'wiki_auto_publish',
      entity_type: 'division', entity_id: divRow.id,
      actor: 'auto-publish-engine', diff: { results },
    }).catch(() => {});
  }

  return res.json({ ok: true, results });
}

async function handleConfigTournament(req, res) {
  if (req.method !== 'PUT') return res.status(405).json({ ok: false, error: 'PUT only' });

  const { tournamentId, wikiConfig } = req.body || {};
  if (!tournamentId || !wikiConfig) {
    return res.status(400).json({ ok: false, error: 'tournamentId and wikiConfig required' });
  }

  const supabase = getSupabase();

  const { data: tournament, error: readErr } = await supabase
    .from('tournaments').select('settings').eq('id', tournamentId).single();
  if (readErr) return res.status(404).json({ ok: false, error: 'Tournament not found' });

  const settings = tournament.settings || {};
  const updatedSettings = {
    ...settings,
    wikiAutoPublish: wikiConfig.enabled ?? settings.wikiAutoPublish ?? false,
    wikiConfig,
  };

  const { error: writeErr } = await supabase
    .from('tournaments')
    .update({ settings: updatedSettings, updated_at: new Date().toISOString() })
    .eq('id', tournamentId);
  if (writeErr) throw writeErr;

  return res.json({ ok: true });
}

async function handleConfigDivision(req, res) {
  if (req.method !== 'PUT') return res.status(405).json({ ok: false, error: 'PUT only' });

  const { divisionId, wikiConfig } = req.body || {};
  if (!divisionId || !wikiConfig) {
    return res.status(400).json({ ok: false, error: 'divisionId and wikiConfig required' });
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from('divisions')
    .update({ wiki_config: wikiConfig, updated_at: new Date().toISOString() })
    .eq('id', divisionId);
  if (error) throw error;

  return res.json({ ok: true });
}

// ── Router ───────────────────────────────────────────────────────────────────

const actions = {
  'scan': handleScan,
  'get-sections': handleGetSections,
  'scaffold': handleScaffold,
  'publish': handlePublish,
  'publish-section': handlePublishSection,
  'auto-publish': handleAutoPublish,
  'config-tournament': handleConfigTournament,
  'config-division': handleConfigDivision,
};

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query?.action;
  const fn = actions[action];

  if (!fn) {
    return res.status(400).json({
      ok: false,
      error: `Missing or unknown action. Valid: ${Object.keys(actions).join(', ')}`,
    });
  }

  try {
    return await fn(req, res);
  } catch (err) {
    console.error(`[wiki/${action}] Error:`, err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
