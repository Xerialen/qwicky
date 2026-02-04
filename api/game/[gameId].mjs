import axios from 'axios';

const HUB_DB_URL = "https://ncsphkjfominimxztjip.supabase.co/rest/v1/v1_games";

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { gameId } = req.query;

  if (!gameId) {
    return res.status(400).json({ error: 'gameId is required' });
  }

  const HUB_HEADERS = {
    "apikey": process.env.SUPABASE_KEY,
    "Authorization": `Bearer ${process.env.SUPABASE_KEY}`,
    "Content-Type": "application/json"
  };

  try {
    console.log(`[${new Date().toISOString()}] Fetching game ${gameId}...`);

    // 1. Hub Lookup
    const hubRes = await axios.get(`${HUB_DB_URL}?id=eq.${gameId}&select=*`, {
      headers: HUB_HEADERS
    });

    if (!hubRes.data || hubRes.data.length === 0) {
      return res.status(404).json({ error: `Game ${gameId} not found` });
    }

    const game = hubRes.data[0];

    // 2. Build stats URL
    let statsUrl = null;
    if (game.demo_sha256) {
      const chk = game.demo_sha256;
      statsUrl = `https://d.quake.world/${chk.substring(0,3)}/${chk}.mvd.ktxstats.json`;
    } else {
      statsUrl = game.demo_source_url || game.url;
    }

    if (!statsUrl) {
      return res.json({ status: 'partial', message: "No demo path found", meta: game });
    }

    // 3. Fetch stats
    try {
      console.log(`[DEBUG] Fetching stats: ${statsUrl}`);
      const statsRes = await axios.get(statsUrl, {
        headers: {
          'User-Agent': 'QuakeStatsBot/1.0',
          'Accept': '*/*',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        },
        timeout: 10000
      });
      return res.json({ status: 'success', data: statsRes.data });
    } catch (statsErr) {
      console.error(`[ERROR] Stats fetch failed: ${statsErr.message}`);
      return res.status(202).json({
        status: 'pending',
        message: "Stats not ready or blocked",
        debug_error: statsErr.message
      });
    }
  } catch (error) {
    console.error(`[ERROR] Handler failed:`, error.message);
    return res.status(500).json({ error: 'Failed', details: error.message });
  }
}
