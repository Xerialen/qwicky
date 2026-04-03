import axios from 'axios';
import { turso } from "../_turso.mjs";

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

  try {
    console.log(`[${new Date().toISOString()}] Fetching game ${gameId}...`);

    // 1. Turso lookup by sha256
    const dbRes = await turso.execute({
      sql: `SELECT sha256 FROM games WHERE sha256 = ?`,
      args: [gameId],
    });

    if (!dbRes.rows.length) {
      return res.status(404).json({ error: `Game ${gameId} not found` });
    }

    const sha256 = dbRes.rows[0][0] || dbRes.rows[0].sha256;

    // 2. Build ktxstats URL from sha256
    const statsUrl = `https://d.quake.world/${sha256.substring(0, 3)}/${sha256}.mvd.ktxstats.json`;

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
