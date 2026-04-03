// api/stats.mjs
// Consolidated stats endpoint backed by Turso qw-stats database.
// Routes by `action` query param: leaderboard | h2h | player | game
//
// GET /api/stats?action=leaderboard&mode=4on4&stat=damage_given&period=all&limit=25
// GET /api/stats?action=h2h&team1=[hx]&team2=0151&mode=4on4
// GET /api/stats?action=player&name=Milton&mode=4on4
// GET /api/stats?action=game&sha256=abc123

import { turso } from "./_turso.mjs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Valid numeric stat columns in player_games
const VALID_STATS = new Set([
  "frags", "deaths", "kills",
  "damage_given", "damage_taken",
  "damage_enemy_weapons",
  "taken_to_die",
  "rl_kills_enemy", "rl_dropped", "rl_picked_up", "rl_hits",
  "lg_kills_enemy", "lg_dropped",
  "quad_pickups", "pent_pickups",
  "ra_pickups", "ya_pickups", "ga_pickups", "mh_pickups",
]);

// lg_pct is a derived stat, not a raw column
const DERIVED_STATS = new Set(["lg_pct"]);

function setCors(res) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.setHeader(k, v);
  }
}

// ── action=leaderboard ───────────────────────────────────────────────────────

async function handleLeaderboard(req, res) {
  const { mode = "4on4", stat = "damage_given", period = "all", limit = "25" } = req.query;

  if (!VALID_STATS.has(stat) && !DERIVED_STATS.has(stat)) {
    return res.status(400).json({ status: "error", message: `Unknown stat: ${stat}` });
  }

  const limitNum = Math.min(parseInt(limit, 10) || 25, 100);
  const minGames = period === "all" ? 10 : 3;

  let dateFilter = "";
  if (period === "30d") {
    dateFilter = `AND pg.date >= datetime('now', '-30 days')`;
  } else if (period === "7d") {
    dateFilter = `AND pg.date >= datetime('now', '-7 days')`;
  }

  let selectExpr, orderBy;
  if (stat === "lg_pct") {
    selectExpr = `ROUND(100.0 * SUM(pg.lg_acc_hits) / NULLIF(SUM(pg.lg_acc_attacks), 0), 1) as value`;
    orderBy = `value`;
  } else {
    selectExpr = `ROUND(AVG(pg.${stat}), 1) as value`;
    orderBy = `value`;
  }

  const sql = `
    SELECT
      COALESCE(pa.canonical, pg.player_name) as player,
      COUNT(*) as games,
      ${selectExpr}
    FROM player_games pg
    LEFT JOIN player_aliases pa ON pa.alias = pg.player_name
    WHERE pg.mode = ?
    ${dateFilter}
    GROUP BY COALESCE(pa.canonical, pg.player_name)
    HAVING games >= ? AND value IS NOT NULL
    ORDER BY ${orderBy} DESC
    LIMIT ?
  `;

  const result = await turso.execute({ sql, args: [mode, minGames, limitNum] });
  return res.json({ status: "success", data: result.rows });
}

// ── action=h2h ───────────────────────────────────────────────────────────────

async function handleH2H(req, res) {
  const { team1, team2, mode = "4on4", limit = "20" } = req.query;

  if (!team1 || !team2) {
    return res.status(400).json({ status: "error", message: "team1 and team2 required" });
  }

  const limitNum = Math.min(parseInt(limit, 10) || 20, 100);

  const sql = `
    SELECT
      date,
      map,
      COALESCE(ta1.canonical, team1) as team1,
      COALESCE(ta2.canonical, team2) as team2,
      score1,
      score2,
      winner,
      sha256
    FROM games g
    LEFT JOIN team_aliases ta1 ON ta1.alias = g.team1
    LEFT JOIN team_aliases ta2 ON ta2.alias = g.team2
    WHERE g.mode = ?
      AND (
        (g.team1 = ? AND g.team2 = ?)
        OR (g.team1 = ? AND g.team2 = ?)
      )
    ORDER BY g.date DESC
    LIMIT ?
  `;

  const result = await turso.execute({ sql, args: [mode, team1, team2, team2, team1, limitNum] });
  return res.json({ status: "success", data: result.rows });
}

// ── action=player ─────────────────────────────────────────────────────────────

async function handlePlayer(req, res) {
  const { name, mode = "4on4", limit = "20" } = req.query;

  if (!name) {
    return res.status(400).json({ status: "error", message: "name required" });
  }

  const limitNum = Math.min(parseInt(limit, 10) || 20, 50);

  // Resolve all aliases for this player
  const aliasRes = await turso.execute({
    sql: `SELECT alias FROM player_aliases WHERE canonical = ? UNION SELECT ?`,
    args: [name, name],
  });
  const aliases = aliasRes.rows.map(r => r[0] || r.alias);

  if (aliases.length === 0) aliases.push(name);

  // Build IN clause
  const placeholders = aliases.map(() => "?").join(", ");

  // Aggregate stats
  const statsRes = await turso.execute({
    sql: `
      SELECT
        COUNT(*) as games,
        ROUND(AVG(frags), 1) as avg_frags,
        ROUND(AVG(damage_given), 0) as avg_damage_given,
        ROUND(AVG(damage_enemy_weapons), 0) as avg_ewep,
        ROUND(100.0 * SUM(lg_acc_hits) / NULLIF(SUM(lg_acc_attacks), 0), 1) as lg_pct,
        ROUND(AVG(rl_hits), 1) as avg_rl_hits,
        ROUND(AVG(quad_pickups), 1) as avg_quads,
        ROUND(AVG(ra_pickups + ya_pickups + ga_pickups), 1) as avg_armors
      FROM player_games
      WHERE player_name IN (${placeholders}) AND mode = ?
    `,
    args: [...aliases, mode],
  });

  // Recent games
  const recentRes = await turso.execute({
    sql: `
      SELECT pg.sha256, pg.date, pg.map, pg.team,
             pg.frags, pg.damage_given, pg.damage_enemy_weapons,
             g.score1, g.score2, g.team1, g.team2, g.winner
      FROM player_games pg
      LEFT JOIN games g ON g.sha256 = pg.sha256
      WHERE pg.player_name IN (${placeholders}) AND pg.mode = ?
      ORDER BY pg.date DESC
      LIMIT ?
    `,
    args: [...aliases, mode, limitNum],
  });

  return res.json({
    status: "success",
    data: {
      player: name,
      aliases,
      stats: statsRes.rows[0] || null,
      recent_games: recentRes.rows,
    },
  });
}

// ── action=game ───────────────────────────────────────────────────────────────

async function handleGame(req, res) {
  const { sha256 } = req.query;

  if (!sha256) {
    return res.status(400).json({ status: "error", message: "sha256 required" });
  }

  const gameRes = await turso.execute({
    sql: `SELECT * FROM games WHERE sha256 = ?`,
    args: [sha256],
  });

  if (!gameRes.rows.length) {
    return res.status(404).json({ status: "error", message: `Game ${sha256} not found` });
  }

  const playersRes = await turso.execute({
    sql: `
      SELECT pg.*,
             COALESCE(pa.canonical, pg.player_name) as canonical_name
      FROM player_games pg
      LEFT JOIN player_aliases pa ON pa.alias = pg.player_name
      WHERE pg.sha256 = ?
      ORDER BY pg.team, pg.frags DESC
    `,
    args: [sha256],
  });

  return res.json({
    status: "success",
    data: {
      game: gameRes.rows[0],
      players: playersRes.rows,
    },
  });
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ status: "error", message: "GET only" });

  const { action } = req.query;

  try {
    switch (action) {
      case "leaderboard": return await handleLeaderboard(req, res);
      case "h2h":         return await handleH2H(req, res);
      case "player":      return await handlePlayer(req, res);
      case "game":        return await handleGame(req, res);
      default:
        return res.status(400).json({
          status: "error",
          message: `Unknown action: ${action}. Valid: leaderboard, h2h, player, game`,
        });
    }
  } catch (err) {
    console.error(`[stats] action=${action} error:`, err.message);
    return res.status(500).json({ status: "error", message: "Database query failed" });
  }
}
