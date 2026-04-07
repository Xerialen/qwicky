import { createClient } from '@libsql/client';

let client = null;

export function getClient() {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DB_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

export async function getGameByHubId(hubId) {
  const c = getClient();
  const r = await c.execute({
    sql: `SELECT g.sha256, g.mode, g.map, g.date, g.duration, g.server,
                 g.team1, g.team2, g.score1, g.score2, g.winner, g.raw_ktxstats
          FROM games g
          JOIN hub_ids h ON g.sha256 = h.sha256
          WHERE h.hub_id = ?`,
    args: [hubId],
  });
  return r.rows.length > 0 ? r.rows[0] : null;
}

export async function insertGame({ hubId, sha256, mode, ktxstats }) {
  const c = getClient();
  const data = typeof ktxstats === 'string' ? JSON.parse(ktxstats) : ktxstats;
  const raw = typeof ktxstats === 'string' ? ktxstats : JSON.stringify(ktxstats);
  const players = data.players || [];
  if (players.length === 0) return false;

  let team1, team2, score1, score2;
  const teamsList = data.teams;

  if (mode === '1on1') {
    if (players.length < 2) return false;
    team1 = players[0].name || '';
    team2 = players[1].name || '';
    score1 = players[0].stats?.frags ?? players[0].frags ?? 0;
    score2 = players[1].stats?.frags ?? players[1].frags ?? 0;
  } else {
    if (!teamsList || teamsList.length < 2) return false;
    team1 = teamsList[0];
    team2 = teamsList[1];
    const scores = {};
    for (const p of players) {
      const t = p.team || '';
      scores[t] = (scores[t] || 0) + (p.stats?.frags ?? p.frags ?? 0);
    }
    score1 = scores[teamsList[0]] || 0;
    score2 = scores[teamsList[1]] || 0;
  }

  const winner = score1 > score2 ? team1 : (score2 > score1 ? team2 : 'draw');

  const batch = [
    {
      sql: `INSERT OR IGNORE INTO games (sha256, mode, map, date, duration, server,
            team1, team2, score1, score2, winner, raw_ktxstats)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [sha256, mode, data.map || '', data.date || '', data.duration || null,
             data.hostname || '', team1, team2, score1, score2, winner, raw],
    },
  ];

  for (const p of players) {
    const s = p.stats || {};
    const dmg = p.dmg || {};
    const w = p.weapons || {};
    const items = p.items || {};
    const rl = w.rl || {};
    const lg = w.lg || {};

    batch.push({
      sql: `INSERT OR IGNORE INTO player_games
            (sha256, player_name, team, mode, map, date, frags, deaths, kills,
             damage_given, damage_taken, damage_enemy_weapons, taken_to_die,
             rl_kills_enemy, rl_dropped, rl_picked_up, rl_hits,
             lg_kills_enemy, lg_dropped, lg_acc_attacks, lg_acc_hits,
             quad_pickups, pent_pickups, ra_pickups, ya_pickups, ga_pickups, mh_pickups)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        sha256, p.name || '', mode === '1on1' ? (p.name || '') : (p.team || ''),
        mode, data.map || '', data.date || '',
        s.frags ?? 0, s.deaths ?? 0, s.kills ?? 0,
        dmg.given ?? 0, dmg.taken ?? 0,
        dmg['enemy-weapons'] ?? 0, dmg['taken-to-die'] ?? 0,
        rl.kills?.enemy ?? 0, rl.pickups?.dropped ?? 0,
        rl.pickups?.['total-taken'] ?? 0, rl.acc?.hits ?? 0,
        lg.kills?.enemy ?? 0, lg.pickups?.dropped ?? 0,
        lg.acc?.attacks ?? 0, lg.acc?.hits ?? 0,
        items.q?.took ?? 0, items.p?.took ?? 0,
        items.ra?.took ?? 0, items.ya?.took ?? 0,
        items.ga?.took ?? 0, items.health_100?.took ?? 0,
      ],
    });
  }

  if (hubId) {
    batch.push({
      sql: `INSERT OR IGNORE INTO hub_ids (hub_id, sha256, mode) VALUES (?, ?, ?)`,
      args: [hubId, sha256, mode],
    });
  }

  try {
    await c.batch(batch);
    return true;
  } catch (err) {
    console.error('[Turso] Insert failed:', err.message);
    return false;
  }
}

export async function discoverGames({ mode, startDate, endDate, teamAliases1, teamAliases2 }) {
  const c = getClient();
  const allAliases = [...teamAliases1, ...teamAliases2];
  const placeholders = allAliases.map(() => '?').join(',');

  const r = await c.execute({
    sql: `SELECT g.sha256, g.mode, g.map, g.date, g.duration, g.server,
                 g.team1, g.team2, g.score1, g.score2, g.winner, h.hub_id
          FROM games g
          LEFT JOIN hub_ids h ON g.sha256 = h.sha256
          WHERE g.mode = ?
            AND g.date >= ?
            AND g.date <= ?
            AND (g.team1 IN (${placeholders}) OR g.team2 IN (${placeholders}))
          ORDER BY g.date`,
    args: [mode, startDate, endDate, ...allAliases, ...allAliases],
  });

  const set1 = new Set(teamAliases1.map(a => a.toLowerCase()));
  const set2 = new Set(teamAliases2.map(a => a.toLowerCase()));

  return r.rows.filter(g => {
    const t1 = g.team1.toLowerCase();
    const t2 = g.team2.toLowerCase();
    return (set1.has(t1) && set2.has(t2)) || (set1.has(t2) && set2.has(t1));
  });
}

export async function getGamePlayers(sha256) {
  const c = getClient();
  const r = await c.execute({
    sql: `SELECT player_name, team FROM player_games WHERE sha256 = ?`,
    args: [sha256],
  });
  return r.rows;
}

export async function getTeamAliases(teamName) {
  const c = getClient();
  const r = await c.execute({
    sql: `SELECT alias FROM team_aliases
          WHERE canonical = (SELECT canonical FROM team_aliases WHERE alias = ?)`,
    args: [teamName],
  });
  if (r.rows.length > 0) {
    return r.rows.map(row => row.alias);
  }
  return [teamName];
}
