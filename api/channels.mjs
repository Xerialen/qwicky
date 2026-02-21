import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const url = process.env.QWICKY_SUPABASE_URL;
  const key = process.env.QWICKY_SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: 'Missing QWICKY_SUPABASE_URL or QWICKY_SUPABASE_SERVICE_KEY env vars' });
  }

  try {
    const supabase = createClient(url, key);

    // Fetch all registered channels
    const { data: channels, error: chErr } = await supabase
      .from('tournament_channels')
      .select('*')
      .order('tournament_id');

    if (chErr) throw chErr;

    // Fetch latest submission per tournament_id (ordered desc so first match = latest)
    const { data: submissions, error: subErr } = await supabase
      .from('match_submissions')
      .select('tournament_id, created_at, game_data')
      .order('created_at', { ascending: false });

    if (subErr) throw subErr;

    // Build map: tournament_id -> latest submission
    const latestByTournament = {};
    for (const sub of submissions) {
      if (!latestByTournament[sub.tournament_id]) {
        latestByTournament[sub.tournament_id] = sub;
      }
    }

    // Enrich channels with latest submission info
    const enriched = channels.map(ch => ({
      ...ch,
      latest_submission_at: latestByTournament[ch.tournament_id]?.created_at || null,
      latest_game_date: latestByTournament[ch.tournament_id]?.game_data?.date || null,
    }));

    return res.json({ channels: enriched });
  } catch (err) {
    console.error('Error fetching channels:', err);
    return res.status(500).json({ error: 'Failed to fetch channels', details: err.message });
  }
}
