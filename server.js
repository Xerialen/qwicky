require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3001;

const HUB_DB_URL = "https://ncsphkjfominimxztjip.supabase.co/rest/v1/v1_games";

// API Keys
const HUB_HEADERS = {
  "apikey": process.env.SUPABASE_KEY,
  "Authorization": `Bearer ${process.env.SUPABASE_KEY}`,
  "Content-Type": "application/json"
};

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/game/:gameId', async (req, res) => {
  const { gameId } = req.params;
  try {
    console.log(`[${new Date().toLocaleTimeString()}] Fetching game ${gameId}...`);

    // 1. Hub Lookup
    const hubRes = await axios.get(`${HUB_DB_URL}?id=eq.${gameId}&select=*`, { headers: HUB_HEADERS });
    if (!hubRes.data || hubRes.data.length === 0) return res.status(404).json({ error: `Game ${gameId} not found` });
    const game = hubRes.data[0];

    // 2. Build URL exactly like the Python script does
    let statsUrl = null;
    if (game.demo_sha256) {
        const chk = game.demo_sha256;
        statsUrl = `https://d.quake.world/${chk.substring(0,3)}/${chk}.mvd.ktxstats.json`;
    } else {
        statsUrl = game.demo_source_url || game.url;
    }

    if (!statsUrl) return res.json({ status: 'partial', message: "No demo path found", meta: game });

    // 3. Get Stats (The Python Disguise)
    try {
      console.log(`[DEBUG] Fetching: ${statsUrl}`);
      const statsRes = await axios.get(statsUrl, {
        headers: { 
          'User-Agent': 'QuakeStatsBot/1.0',
          'Accept': '*/*', 
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        },
        timeout: 10000
      });
      res.json({ status: 'success', data: statsRes.data });
      
    } catch (statsErr) {
      console.error(`[ERROR] Fetch failed: ${statsErr.message}`);
      res.status(202).json({ 
          status: 'pending', 
          message: "Stats not ready or blocked", 
          debug_error: statsErr.message
      });
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    res.status(500).json({ error: 'Failed', details: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Proxy Active on Port ${PORT}`));
