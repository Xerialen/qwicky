# QW Stats API — Collaborator Guide

Public API serving QuakeWorld 4on4 match data from 18,000+ games (2022–present). Data auto-syncs from [QWHub](https://hub.quakeworld.nu) every 15 minutes.

## Base URL

```
https://qw-api.poker-affiliate.org
```

No authentication required. All responses are JSON. CORS is open.

---

## Endpoints

### Health Check
```
GET /health
→ { "status": "ok", "service": "qw-stats-api" }
```

### Sync Status
```
GET /api/sync-status
→ { "lastSync": { "imported": 3, "totalGames": 18372, "at": "2026-02-08T21:58:35Z" }, ... }
```
Check when the database last pulled new games and how many are in it.

---

### Head-to-Head
```
GET /api/h2h?teamA=book&teamB=oeks&months=3&limit=10
GET /api/h2h?teamA=book&teamB=oeks&map=dm2&months=6&limit=20
```
Direct matchup history between two teams. Results from teamA's perspective (W/L/D).

**Parameters:**
| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| teamA | yes | — | First team tag (lowercase) |
| teamB | yes | — | Second team tag (lowercase) |
| map | no | all | Filter by map (dm2, dm3, e1m2, schloss, phantombase) |
| months | no | 3 | How far back to look |
| limit | no | 10 | Max games returned |

**Response:**
```json
{
  "teamA": "book",
  "teamB": "oeks",
  "total": 4,
  "games": [
    {
      "id": 12345,
      "playedAt": "2026-01-15T20:30:00Z",
      "map": "dm2",
      "teamAFrags": 280,
      "teamBFrags": 195,
      "result": "W",
      "demoSha256": "abc123..."
    }
  ]
}
```

---

### Recent Form
```
GET /api/form?team=book&months=3&limit=10
GET /api/form?team=book&map=dm3&months=6
```
A team's recent results against all opponents.

**Parameters:**
| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| team | yes | — | Team tag (lowercase) |
| map | no | all | Filter by map |
| months | no | 3 | How far back |
| limit | no | 10 | Max games |

**Response:**
```json
{
  "team": "book",
  "total": 8,
  "games": [
    {
      "id": 12346,
      "playedAt": "2026-02-01T21:00:00Z",
      "map": "dm3",
      "teamFrags": 310,
      "oppFrags": 220,
      "opponent": "oeks",
      "result": "W",
      "demoSha256": "def456..."
    }
  ]
}
```

---

### Map Stats
```
GET /api/maps?team=book&months=6
GET /api/maps?team=book&vsTeam=oeks&months=6
```
Win rates per map for a team. Optionally filtered to a specific opponent.

**Parameters:**
| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| team | yes | — | Team tag (lowercase) |
| vsTeam | no | all opponents | Compare against specific team |
| months | no | 6 | How far back |

**Response:**
```json
{
  "team": "book",
  "totalGames": 47,
  "maps": [
    { "map": "dm2", "games": 15, "wins": 10, "losses": 5, "winRate": 67, "avgFragDiff": 42.3 },
    { "map": "dm3", "games": 12, "wins": 7, "losses": 5, "winRate": 58, "avgFragDiff": 18.1 }
  ]
}
```

---

### Roster
```
GET /api/roster?team=book&months=3
```
Player activity for a team — who played, how often, how well.

**Parameters:**
| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| team | yes | — | Team tag (lowercase) |
| months | no | 3 | How far back |

**Response:**
```json
{
  "team": "book",
  "totalPlayers": 7,
  "totalGames": 23,
  "players": [
    { "player": "ParadokS", "games": 20, "wins": 14, "winRate": 70, "eff": 52.3, "avgDmg": 4821, "lastPlayed": "2026-02-08T20:00:00Z" },
    { "player": "Milton", "games": 18, "wins": 15, "winRate": 83, "eff": 61.1, "avgDmg": 6102, "lastPlayed": "2026-02-07T21:30:00Z" }
  ]
}
```

---

## Important Notes

- **Team tags must be lowercase.** The API stores everything lowercase. Use `book` not `Book`, `]sr[` not `]SR[`.
- **Only clan games are included.** Mix/pickup games (team names like "red", "blue", "mix") are filtered out.
- **`demoSha256`** in game results can be used to fetch detailed per-player stats (weapons, damage, items) from QWHub's S3: `https://d.quake.world/{sha[0:3]}/{sha}.mvd.ktxstats.json`
- **Data freshness:** New games appear within 15 minutes of being played on QWHub.

---

## Need Different Data?

The API serves pre-computed queries. If you need data in a shape these endpoints don't provide, **don't query the database directly** — instead:

1. Describe what you need (what question are you trying to answer?)
2. Include example input/output if possible
3. Send it to ParadokS — he'll add a new endpoint

Examples of things that can be added quickly:
- Top players by efficiency/damage
- Player career stats across all teams
- Game listings with filters (map, date range, team)
- Team rankings or streaks
- Any aggregation the raw data supports

The database has **full per-player stats for every game**: frags, kills, deaths, damage given/taken, weapon accuracy (SG/RL/LG), item control (RA/YA/Quad timing), speed, streaks, and more. If it's in ktxstats, we have it.

---

## Quick Test

```bash
# Check it's alive
curl https://qw-api.poker-affiliate.org/health

# Book vs oeks last 6 months
curl "https://qw-api.poker-affiliate.org/api/h2h?teamA=book&teamB=oeks&months=6"

# SR's recent form
curl "https://qw-api.poker-affiliate.org/api/form?team=%5Dsr%5B&months=3"

# Database freshness
curl https://qw-api.poker-affiliate.org/api/sync-status
```

Note: `]sr[` URL-encodes to `%5Dsr%5B`.
