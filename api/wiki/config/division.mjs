// api/wiki/config/division.mjs
// Persist division-level wikiConfig (auto-publish targets) to Supabase.
//
// PUT /api/wiki/config/division
// Body: { divisionId, wikiConfig: { enabled, targets: [{ type, page, section }] } }

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PUT') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { divisionId, wikiConfig } = req.body || {};
  if (!divisionId || !wikiConfig) {
    return res.status(400).json({ ok: false, error: 'divisionId and wikiConfig required' });
  }

  const supabase = createClient(process.env.QWICKY_SUPABASE_URL, process.env.QWICKY_SUPABASE_SERVICE_KEY);

  try {
    const { error } = await supabase
      .from('divisions')
      .update({ wiki_config: wikiConfig, updated_at: new Date().toISOString() })
      .eq('id', divisionId);

    if (error) throw error;

    return res.json({ ok: true });
  } catch (err) {
    console.error('[wiki/config/division] Error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
