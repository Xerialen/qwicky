// api/discord.mjs
// Consolidated Discord notification endpoint — routes via ?action= query parameter.
//
// POST ?action=post-schedule   — enqueue schedule posting to Discord channels
// POST ?action=post-discovery  — enqueue discovery summary to Discord channels

import { createClient } from '@supabase/supabase-js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getSupabase() {
  return createClient(process.env.QWICKY_SUPABASE_URL, process.env.QWICKY_SUPABASE_SERVICE_KEY);
}

async function enqueueNotifications(supabase, tournamentId, notificationType, payloadBuilder) {
  const { data: channels, error: chErr } = await supabase
    .from('tournament_channels')
    .select('discord_channel_id')
    .eq('tournament_id', tournamentId);

  if (chErr) throw chErr;
  if (!channels || channels.length === 0) {
    return { ok: true, channels: 0, message: 'No registered channels' };
  }

  const rows = channels.map(ch => ({
    tournament_id: tournamentId,
    channel_id: ch.discord_channel_id,
    notification_type: notificationType,
    payload: payloadBuilder(ch),
  }));

  const { error: insertErr } = await supabase.from('discord_notifications').insert(rows);
  if (insertErr) throw insertErr;

  return { ok: true, channels: channels.length };
}

async function handlePostSchedule(req, res) {
  const { tournamentId, divisionName, roundNum, group, matches, deadline } = req.body;
  if (!tournamentId || !matches || !Array.isArray(matches)) {
    return res.status(400).json({ error: 'tournamentId and matches[] are required' });
  }

  const result = await enqueueNotifications(getSupabase(), tournamentId, 'post_schedule', () => ({
    division_name: divisionName || null,
    round_num: roundNum || null,
    group: group || null,
    deadline: deadline || null,
    matches: matches.map(m => ({
      team1: m.team1, team2: m.team2,
      date: m.date || null, time: m.time || null,
      bestOf: m.bestOf || null, status: m.status || 'scheduled',
    })),
  }));

  return res.json(result);
}

async function handlePostDiscovery(req, res) {
  const { tournamentId, candidates, summary } = req.body;
  if (!tournamentId || !candidates || !Array.isArray(candidates)) {
    return res.status(400).json({ error: 'tournamentId and candidates[] are required' });
  }

  const result = await enqueueNotifications(getSupabase(), tournamentId, 'discovery_summary', () => ({
    tournament_id: tournamentId,
    candidates,
    summary: summary || null,
  }));

  return res.json(result);
}

async function handleChannels(req, res) {
  const supabase = getSupabase();

  const { data: channels, error: chErr } = await supabase
    .from('tournament_channels')
    .select('*')
    .order('tournament_id');
  if (chErr) throw chErr;

  const { data: submissions, error: subErr } = await supabase
    .from('match_submissions')
    .select('tournament_id, created_at, game_data')
    .order('created_at', { ascending: false });
  if (subErr) throw subErr;

  const latestByTournament = {};
  for (const sub of submissions) {
    if (!latestByTournament[sub.tournament_id]) latestByTournament[sub.tournament_id] = sub;
  }

  const enriched = channels.map(ch => ({
    ...ch,
    latest_submission_at: latestByTournament[ch.tournament_id]?.created_at || null,
    latest_game_date: latestByTournament[ch.tournament_id]?.game_data?.date || null,
  }));

  return res.json({ channels: enriched });
}

async function handleRunDiscovery(req, res) {
  const { tournamentId, divisionId } = req.body || {};
  if (!tournamentId) return res.status(400).json({ error: 'tournamentId required' });

  const supabase = getSupabase();

  // Load tournament settings
  const { data: tournament } = await supabase
    .from('tournaments').select('settings').eq('id', tournamentId).single();
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

  const discovery = tournament.settings?.discovery || {};
  if (!discovery.enabled) return res.json({ ok: false, error: 'Discovery not enabled' });

  // Check last run to prevent double-runs (12 hour cooldown)
  const { data: lastRuns } = await supabase
    .from('discovery_runs')
    .select('run_at')
    .eq('tournament_id', tournamentId)
    .order('run_at', { ascending: false })
    .limit(1);

  if (lastRuns?.[0]) {
    const hoursSince = (Date.now() - new Date(lastRuns[0].run_at).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 12) {
      return res.json({ ok: false, error: `Last run was ${Math.round(hoursSince)}h ago. Cooldown: 12h.` });
    }
  }

  // Call discovery endpoint internally
  const baseUrl = `https://${req.headers.host || 'qwicky.vercel.app'}`;
  const discoverRes = await fetch(`${baseUrl}/api/discover-games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tournamentId, divisionId }),
  });

  if (!discoverRes.ok) {
    return res.status(502).json({ error: 'Discovery endpoint failed' });
  }

  const { candidates, summary } = await discoverRes.json();
  if (!candidates || candidates.length === 0) {
    // Log empty run
    await supabase.from('discovery_runs').insert({
      tournament_id: tournamentId, division_id: divisionId || null,
      candidates_found: 0, candidates_posted: 0, candidates_auto_imported: 0, duplicates_skipped: 0,
      summary: summary || {},
    });
    return res.json({ ok: true, candidatesFound: 0, posted: 0, autoImported: 0, skippedDuplicates: 0 });
  }

  // Dedup: collect all game IDs from candidates
  const allGameIds = candidates.flatMap(c => c.games.map(g => String(g.id)));

  // Check which are already in match_submissions
  const { data: existingSubs } = await supabase
    .from('match_submissions')
    .select('game_id')
    .eq('tournament_id', tournamentId)
    .in('game_id', allGameIds);
  const knownGameIds = new Set((existingSubs || []).map(s => s.game_id));

  // Check which are already in match_maps
  const { data: existingMaps } = await supabase
    .from('match_maps')
    .select('game_id')
    .not('game_id', 'is', null)
    .in('game_id', allGameIds);
  for (const m of (existingMaps || [])) knownGameIds.add(m.game_id);

  // Filter candidates to only include new games
  const threshold = discovery.threshold || 70;
  const newCandidates = [];
  let duplicatesSkipped = 0;

  for (const candidate of candidates) {
    const newGames = candidate.games.filter(g => !knownGameIds.has(String(g.id)));
    if (newGames.length === 0) {
      duplicatesSkipped += candidate.games.length;
      continue;
    }
    if (candidate.avgConfidence < threshold) continue;
    newCandidates.push({ ...candidate, games: newGames, mapCount: newGames.length });
  }

  let posted = 0;
  let autoImported = 0;

  // Post to Discord if enabled
  if (discovery.postToDiscord !== false && newCandidates.length > 0) {
    const { data: channels } = await supabase
      .from('tournament_channels')
      .select('discord_channel_id')
      .eq('tournament_id', tournamentId);

    if (channels?.length > 0) {
      const rows = channels.map(ch => ({
        tournament_id: tournamentId,
        channel_id: ch.discord_channel_id,
        notification_type: 'discovery_summary',
        payload: { tournament_id: tournamentId, candidates: newCandidates, summary },
      }));
      await supabase.from('discord_notifications').insert(rows);
      posted = newCandidates.length;
    }
  }

  // Auto-import high-confidence games if enabled
  if (discovery.autoImport && discovery.autoImportThreshold) {
    for (const candidate of newCandidates) {
      if (candidate.avgConfidence < discovery.autoImportThreshold) continue;

      for (const game of candidate.games) {
        // Insert as approved submission
        await supabase.from('match_submissions').insert({
          tournament_id: tournamentId,
          game_id: String(game.id),
          game_data: game,
          status: 'approved',
          submitted_by_name: 'auto-discovery',
          submitted_by_discord_id: 'system',
          discord_channel_id: null,
          hub_url: null,
          reviewed_at: new Date().toISOString(),
        }).catch(() => {}); // ignore duplicate constraint violations
      }
      autoImported += candidate.games.length;
    }
  }

  // Log the run
  await supabase.from('discovery_runs').insert({
    tournament_id: tournamentId,
    division_id: divisionId || null,
    candidates_found: newCandidates.length,
    candidates_posted: posted,
    candidates_auto_imported: autoImported,
    duplicates_skipped: duplicatesSkipped,
    summary: summary || {},
  });

  return res.json({
    ok: true,
    candidatesFound: newCandidates.length,
    posted,
    autoImported,
    skippedDuplicates: duplicatesSkipped,
  });
}

const actions = {
  'post-schedule': handlePostSchedule,
  'post-discovery': handlePostDiscovery,
  'run-discovery': handleRunDiscovery,
  'channels': handleChannels,
};

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const action = req.query?.action;
  const fn = actions[action];
  if (!fn) {
    return res.status(400).json({ error: `Unknown action. Valid: ${Object.keys(actions).join(', ')}` });
  }

  try {
    return await fn(req, res);
  } catch (err) {
    console.error(`[discord/${action}] Error:`, err);
    return res.status(500).json({ error: err.message });
  }
}
