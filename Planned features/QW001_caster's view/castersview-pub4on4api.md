Let me review the uploaded file and the existing project context to give you a thorough comparison.

## QW Stats API vs Direct Supabase: Analysis

### Benefits of Switching

**1. Simpler Integration**
- No auth headers needed (Supabase requires the anon key on every request)
- Clean REST endpoints with intuitive parameters vs PostgREST query syntax (`cs.{tag}`, `eq.`, `fts.`)
- No need to worry about URL-encoding PostgREST array containment operators

**2. Pre-computed Analytics**
- H2H, form, map stats, and roster endpoints return exactly the shape you need — no client-side aggregation
- The roster endpoint gives you efficiency, avg damage, win rates per player — stuff you'd currently need to fetch ktxstats for each game and compute yourself
- Map win rates with avg frag diff come ready-made

**3. Caster View Enablement**
- This API is essentially purpose-built for the caster view feature you have on the horizon
- Common opponent analysis becomes: call `/api/form` for both teams, cross-reference opponents
- Recent form tracking is a single endpoint call

**4. CORS is Open**
- You can call it directly from the browser — no Vercel proxy needed for these endpoints
- Eliminates the serverless function hop for match data queries

**5. Data Quality**
- Mix/pickup games pre-filtered out (you'd need to filter `matchtag` yourself with Supabase)
- 15-minute sync means near-real-time without you managing cache TTLs

### Implications & Risks

**1. External Dependency**
- This is ParadokS's personal API at `poker-affiliate.org` — no SLA, single point of failure
- If it goes down, all match data features break. With Supabase you're hitting QWHub's own infrastructure
- You should keep the Supabase fallback path, at least initially

**2. Missing Capabilities**
- **No game-by-game detail fetch** — no equivalent to `GET /api/game/[gameId]` that returns full ktxstats. You still need `d.quake.world` for detailed stats
- **No player full-text search** — Supabase gives you `players_fts=fts.paradok`
- **No matchtag filtering** — can't distinguish prac vs tournament games
- **No server hostname** — Supabase returns `server_hostname`
- **4on4 only** — the API description says "4on4 match data." Your tool supports multiple modes
- **No pagination** — just `limit`, no offset/cursor. Large result sets may be truncated

**3. Data Shape Differences**
- Game IDs, timestamps, and field names differ from what `parseMatch` and `dataTransformer.js` expect
- `result` is "W"/"L"/"D" from one team's perspective vs raw frag counts on both sides
- No `demo_source_url`, no `color` arrays, no `name_color` — scoreboard rendering won't work from this API alone

**4. Team Name Resolution Still Needed**
- Both APIs require lowercase tags, so your existing `.toLowerCase()` logic stays
- But the new API doesn't return the rich team/player metadata (colors, ping, etc.)

### What You Still Need Supabase/ktxstats For

- Discord bot game lookups (fetch by game ID → get ktxstats)
- Scoreboard rendering (colors, pings, player details)
- Non-4on4 modes
- Individual game imports in DivisionResults
- Any feature that needs full per-player weapon/item stats per game

### Implementation Plan for Claude Code

Here's a phased approach:

---

**Phase 1: Add QW Stats API Service (non-breaking)**

```
Create src/services/QWStatsService.js
- Base URL: https://qw-api.poker-affiliate.org
- Methods: getH2H(teamA, teamB, opts), getForm(team, opts), 
  getMapStats(team, opts), getRoster(team, opts), getHealth()
- All params lowercase-enforced
- Error handling with fallback flag
- No auth needed, direct browser fetch
```

**Phase 2: Integrate into Caster View / Team Analysis**

```
- Wire QWStatsService into any new "team analysis" or 
  "caster view" components
- Use /api/form for recent results display
- Use /api/h2h for matchup preview
- Use /api/maps for map pick/ban insights  
- Use /api/roster for lineup info
```

**Phase 3: Replace Supabase for Team Query Features (Teams tab)**

```
- The planned "Teams section enhancement" (query teams that 
  played recently) can use /api/roster and /api/form instead 
  of querying Supabase v1_games directly
- Simpler code, better data shape for that use case
```

**Phase 4: Dual-source with Graceful Fallback**

```
- For any feature that COULD use either API, try QW Stats 
  first, fall back to Supabase
- Keep QWHubService.js intact for game-by-game imports, 
  Discord bot, and scoreboard rendering
- Add health check on app init to determine availability
```

---

### Claude Code Prompt (Phase 1)

```markdown
## Task: Add QW Stats API Service

Create `src/services/QWStatsService.js` — a new service for the 
QW Stats API (https://qw-api.poker-affiliate.org).

### Requirements:
1. Export functions: getH2H, getForm, getMapStats, getRoster, checkHealth
2. All team params must be lowercased before sending
3. Use fetch (not axios) since no auth headers needed
4. Handle errors gracefully — return { error, data } shape
5. Add JSDoc comments with param types matching the API docs
6. URL-encode special chars in team tags (e.g. ]sr[ → %5Dsr%5B)

### API Reference:
- GET /api/h2h?teamA=X&teamB=Y&months=N&limit=N&map=X
- GET /api/form?team=X&months=N&limit=N&map=X  
- GET /api/maps?team=X&vsTeam=Y&months=N
- GET /api/roster?team=X&months=N
- GET /health

### Notes:
- This is a BROWSER-CALLABLE API (no CORS issues, no proxy needed)
- Do NOT modify QWHubService.js — that stays for game imports
- Follow existing code conventions from CLAUDE.md
- No TypeScript, plain JS with ES module exports
```

### Recommendation

Use the QW Stats API as a **complementary source** rather than a full replacement. It's perfect for the analytical/caster features you're planning, but Supabase remains essential for game imports, Discord bot, and anything requiring full per-player detail. Think of it as: **QW Stats API for aggregate insights, Supabase+ktxstats for individual game operations.**