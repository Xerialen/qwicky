// Turso client using HTTP API directly (no @libsql/client dependency).
// This avoids compatibility issues with Vercel serverless.

const TURSO_URL = () => {
  const url = process.env.TURSO_DB_URL || '';
  return url.replace(/^libsql:\/\//, 'https://') + '/v2/pipeline';
};
const TURSO_TOKEN = () => process.env.TURSO_AUTH_TOKEN;

async function tursoQuery(sql, args = []) {
  const stmts = [{
    type: 'execute',
    stmt: {
      sql,
      args: args.map(a => {
        if (a === null || a === undefined) return { type: 'null' };
        if (typeof a === 'number') return { type: 'integer', value: String(a) };
        return { type: 'text', value: String(a) };
      }),
    },
  }, { type: 'close' }];

  const res = await fetch(TURSO_URL(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TURSO_TOKEN()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests: stmts }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Turso HTTP ${res.status}`);
  }

  const data = await res.json();
  const result = data.results?.[0]?.response?.result;
  if (!result) {
    const err = data.results?.[0]?.response?.error;
    throw new Error(err?.message || 'Turso query failed');
  }

  // Convert Turso row format to plain objects
  const cols = result.cols.map(c => c.name);
  return result.rows.map(row =>
    Object.fromEntries(cols.map((name, i) => [name, row[i]?.value ?? null]))
  );
}

async function tursoBatch(statements) {
  const reqs = statements.map(({ sql, args = [] }) => ({
    type: 'execute',
    stmt: {
      sql,
      args: args.map(a => {
        if (a === null || a === undefined) return { type: 'null' };
        if (typeof a === 'number') return { type: 'integer', value: String(a) };
        return { type: 'text', value: String(a) };
      }),
    },
  }));
  reqs.push({ type: 'close' });

  const res = await fetch(TURSO_URL(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TURSO_TOKEN()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests: reqs }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`Turso batch HTTP ${res.status}`);
  }
}

export async function getGameByHubId(hubId) {
  const rows = await tursoQuery(
    `SELECT g.sha256, g.mode, g.map, g.date, g.duration, g.server,
            g.team1, g.team2, g.score1, g.score2, g.winner, g.raw_ktxstats
     FROM games g
     JOIN hub_ids h ON g.sha256 = h.sha256
     WHERE h.hub_id = ?`,
    [hubId]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function insertGame({ hubId, sha256, mode, ktxstats }) {
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
      args: [sha256, mode, data.map || '', data.date || '', data.duration || 0,
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
    await tursoBatch(batch);
    return true;
  } catch (err) {
    console.error('[Turso] Insert failed:', err.message);
    return false;
  }
}

export async function discoverGames({ mode, startDate, endDate, teamAliases1, teamAliases2 }) {
  const allAliases = [...teamAliases1, ...teamAliases2];
  const placeholders = allAliases.map(() => '?').join(',');

  const rows = await tursoQuery(
    `SELECT g.sha256, g.mode, g.map, g.date, g.duration, g.server,
            g.team1, g.team2, g.score1, g.score2, g.winner, h.hub_id
     FROM games g
     LEFT JOIN hub_ids h ON g.sha256 = h.sha256
     WHERE g.mode = ?
       AND g.date >= ?
       AND g.date <= ?
       AND (g.team1 IN (${placeholders}) OR g.team2 IN (${placeholders}))
     ORDER BY g.date`,
    [mode, startDate, endDate, ...allAliases, ...allAliases]
  );

  const set1 = new Set(teamAliases1.map(a => a.toLowerCase()));
  const set2 = new Set(teamAliases2.map(a => a.toLowerCase()));

  return rows.filter(g => {
    const t1 = (g.team1 || '').toLowerCase();
    const t2 = (g.team2 || '').toLowerCase();
    return (set1.has(t1) && set2.has(t2)) || (set1.has(t2) && set2.has(t1));
  });
}

export async function getGamePlayers(sha256) {
  return tursoQuery(
    `SELECT player_name, team FROM player_games WHERE sha256 = ?`,
    [sha256]
  );
}

export async function getTeamAliases(teamName) {
  const rows = await tursoQuery(
    `SELECT alias FROM team_aliases
     WHERE canonical = (SELECT canonical FROM team_aliases WHERE alias = ?)`,
    [teamName]
  );
  if (rows.length > 0) {
    return rows.map(row => row.alias);
  }
  return [teamName];
}
