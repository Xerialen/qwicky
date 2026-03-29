// api/wiki/config/tournament.mjs
// Persist tournament-level wikiConfig to Supabase.
// Merges into tournaments.settings JSONB without overwriting other fields.
//
// PUT /api/wiki/config/tournament
// Body: { tournamentId, wikiConfig: { enabled, seasonPage, navbox, infobox, pages } }

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PUT') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { tournamentId, wikiConfig } = req.body || {};
  if (!tournamentId || !wikiConfig) {
    return res.status(400).json({ ok: false, error: 'tournamentId and wikiConfig required' });
  }

  const supabase = createClient(process.env.QWICKY_SUPABASE_URL, process.env.QWICKY_SUPABASE_SERVICE_KEY);

  try {
    // Read current settings to merge
    const { data: tournament, error: readErr } = await supabase
      .from('tournaments')
      .select('settings')
      .eq('id', tournamentId)
      .single();

    if (readErr) {
      return res.status(404).json({ ok: false, error: 'Tournament not found' });
    }

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
  } catch (err) {
    console.error('[wiki/config/tournament] Error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
