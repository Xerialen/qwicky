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

const actions = {
  'post-schedule': handlePostSchedule,
  'post-discovery': handlePostDiscovery,
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
