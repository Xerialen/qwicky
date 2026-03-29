import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tournamentId, divisionName, roundNum, group, matches, deadline } = req.body;

  if (!tournamentId || !matches || !Array.isArray(matches)) {
    return res.status(400).json({ error: 'tournamentId and matches[] are required' });
  }

  const supabase = createClient(process.env.QWICKY_SUPABASE_URL, process.env.QWICKY_SUPABASE_SERVICE_KEY);

  try {
    // Fetch registered channels for this tournament
    const { data: channels, error: chErr } = await supabase
      .from('tournament_channels')
      .select('discord_channel_id')
      .eq('tournament_id', tournamentId);

    if (chErr) throw chErr;
    if (!channels || channels.length === 0) {
      return res.status(200).json({ ok: true, channels: 0, message: 'No registered channels' });
    }

    // Enqueue one notification per channel
    const rows = channels.map(ch => ({
      tournament_id: tournamentId,
      channel_id: ch.discord_channel_id,
      notification_type: 'post_schedule',
      payload: {
        division_name: divisionName || null,
        round_num: roundNum || null,
        group: group || null,
        deadline: deadline || null,
        matches: matches.map(m => ({
          team1: m.team1,
          team2: m.team2,
          date: m.date || null,
          time: m.time || null,
          bestOf: m.bestOf || null,
          status: m.status || 'scheduled',
        })),
      },
    }));

    const { error: insertErr } = await supabase
      .from('discord_notifications')
      .insert(rows);

    if (insertErr) throw insertErr;

    return res.json({ ok: true, channels: channels.length });
  } catch (err) {
    console.error('Error posting schedule to Discord:', err);
    return res.status(500).json({ error: 'Failed to enqueue schedule post', details: err.message });
  }
}
