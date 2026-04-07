import { getGameByHubId, insertGame } from '../lib/tursoClient.mjs';

const HUB_DB_URL = 'https://ncsphkjfominimxztjip.supabase.co/rest/v1/v1_games';
const HUB_ANON_KEY = process.env.HUB_ANON_KEY || process.env.SUPABASE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { gameId } = req.query;
  if (!gameId) return res.status(400).json({ error: 'gameId is required' });

  try {
    // 1. Try Turso
    console.log(`[game/${gameId}] TURSO_DB_URL set:`, !!process.env.TURSO_DB_URL, 'url prefix:', (process.env.TURSO_DB_URL || '').substring(0, 20));
    const cached = await getGameByHubId(Number(gameId));
    if (cached && cached.raw_ktxstats) {
      return res.json({ status: 'success', data: JSON.parse(cached.raw_ktxstats) });
    }

    // 2. Fallback: Hub + d.quake.world
    if (!HUB_ANON_KEY) {
      return res.status(404).json({
        error: 'Game not yet indexed. Try again after the nightly sync.',
      });
    }

    console.log(`[game/${gameId}] Not in Turso, fetching from Hub...`);

    const hubRes = await fetch(
      `${HUB_DB_URL}?id=eq.${gameId}&select=id,demo_sha256,mode`,
      {
        headers: {
          apikey: HUB_ANON_KEY,
          Authorization: `Bearer ${HUB_ANON_KEY}`,
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!hubRes.ok) {
      return res.status(502).json({ error: `Hub returned ${hubRes.status}` });
    }

    const hubData = await hubRes.json();
    if (!hubData || hubData.length === 0) {
      return res.status(404).json({ error: `Game ${gameId} not found` });
    }

    const game = hubData[0];
    const sha256 = game.demo_sha256;
    if (!sha256) {
      return res.status(404).json({ error: 'No demo hash for this game' });
    }

    // 3. Fetch ktxstats
    const prefix = sha256.substring(0, 3);
    const statsUrl = `https://d.quake.world/${prefix}/${sha256}.mvd.ktxstats.json`;
    const statsRes = await fetch(statsUrl, {
      headers: { 'User-Agent': 'Qwicky/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!statsRes.ok) {
      return res.status(202).json({
        status: 'pending',
        message: 'Demo stats not available yet',
      });
    }

    const ktxstats = await statsRes.json();

    // 4. Insert into Turso (non-blocking)
    const mode = game.mode === 'duel' ? '1on1'
      : game.mode === '2on2tdm' ? '2on2'
      : game.mode === '4on4tdm' ? '4on4'
      : game.mode;

    insertGame({ hubId: game.id, sha256, mode, ktxstats }).catch(err => {
      console.error(`[game/${gameId}] Turso insert failed:`, err.message);
    });

    return res.json({ status: 'success', data: ktxstats });
  } catch (error) {
    console.error(`[game/${gameId}] Error:`, error.message);
    return res.status(500).json({ error: 'Failed', details: error.message });
  }
}
