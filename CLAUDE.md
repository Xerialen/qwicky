# CLAUDE.md - AI Assistant Guide for Qwicky

This document provides guidance for AI assistants working with the Qwicky codebase (QuakeWorld Tournament Admin).

## Project Overview

Qwicky is a React-based Single Page Application for managing competitive QuakeWorld esports tournaments. It supports multi-division tournament management with features including team management, scheduling (with drag-and-drop round reordering), standings calculation, single/double-elimination and multi-tier playoff brackets, Discord bot integration for match submission, and MediaWiki export.

**Tech Stack:**
- React 18.2 with Vite 5.0
- Tailwind CSS 3.4 with a modern dark-mode theme (Deep Amber/Gold accent)
- Axios for HTTP requests
- Vercel serverless functions for API layer
- Supabase for Discord submission storage (`match_submissions`, `tournament_channels` tables)
- localStorage for tournament data persistence

**Companion project:** The Discord bot lives in a separate repo at `qwicky-discord-bot/` (see Discord Integration section below).

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (runs on port 5175)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
qwicky/
├── src/
│   ├── App.jsx                    # Root component, tournament state, bracket factories
│   ├── main.jsx                   # React entry point
│   ├── index.css                  # Global styles (modern dark mode theme)
│   ├── components/
│   │   ├── Header.jsx             # Static nav bar with division dropdown
│   │   ├── TournamentInfo.jsx     # Tournament metadata editor
│   │   ├── DivisionManager.jsx    # Create/edit/delete divisions
│   │   ├── DivisionView.jsx       # Division tab container & sub-nav
│   │   ├── DataManager.jsx        # Save/Load/Reset functionality
│   │   └── division/              # Per-division components
│   │       ├── DivisionSetup.jsx      # Format, group, playoff & tier config
│   │       ├── DivisionTeams.jsx      # Team management & group assignment
│   │       ├── DivisionSchedule.jsx   # Match scheduling + drag-and-drop
│   │       ├── DivisionResults.jsx    # Result import (Discord/API/JSON)
│   │       ├── DivisionStandings.jsx  # Group stage standings
│   │       ├── DivisionBracket.jsx    # Playoff bracket UI (single/double/multi-tier)
│   │       ├── DivisionStats.jsx      # Player statistics
│   │       └── DivisionWiki.jsx       # MediaWiki export
│   ├── utils/
│   │   ├── matchLogic.js          # Match parsing, standings calculation (API import path)
│   │   ├── wikiExport.js          # MediaWiki markup generation
│   │   └── statsLogic.js          # QuakeWorld-specific stats
│   ├── services/
│   │   ├── api.js                 # Axios API client
│   │   └── dataTransformer.js     # API response transformers
│   └── hooks/
│       └── useLocalStorage.js     # localStorage persistence hook
├── api/                           # Vercel serverless functions
│   ├── game/[gameId].mjs          # Fetch game stats from hub + ktxstats
│   ├── health.mjs                 # Health check endpoint
│   ├── submissions/[tournamentId].mjs  # GET pending/approved Discord submissions
│   └── submission/[submissionId]/
│       ├── approve.mjs            # POST approve a submission
│       └── reject.mjs             # POST reject a submission
├── vite.config.js                 # Vite configuration (has Swedish comments)
├── tailwind.config.js             # Tailwind theme customization
└── vercel.json                    # Vercel deployment config
```

## Architecture & Data Flow

### Component Hierarchy

```
App.jsx (state provider — exports createDefaultDivision, createDefaultBracket)
├── Header (static nav, division dropdown)
└── Tab Router:
    ├── "info"       → TournamentInfo
    ├── "divisions"  → DivisionManager
    ├── "division"   → DivisionView
    │   ├── "setup"      → DivisionSetup
    │   ├── "teams"      → DivisionTeams
    │   ├── "schedule"   → DivisionSchedule
    │   ├── "results"    → DivisionResults
    │   ├── "standings"  → DivisionStandings
    │   ├── "bracket"    → DivisionBracket
    │   ├── "stats"      → DivisionStats
    │   └── "wiki"       → DivisionWiki
    └── "data"       → DataManager
```

### Key Data Structures

**Tournament Object:**
```javascript
{
  name: string,
  mode: string,                 // e.g., "4on4"
  startDate: string,            // YYYY-MM-DD
  endDate: string,
  divisions: Division[],
  activeDivisionId: string | null
}
```

**Division Object** (all fields are flat — no nested `format` sub-object):
```javascript
{
  id: string,                   // "div-<timestamp>"
  name: string,

  // Format selection
  format: string,               // "groups" | "single-elim" | "double-elim" | "multi-tier"

  // Group-stage settings (used when format === "groups" or "multi-tier")
  numGroups: number,            // 1, 2, 3, 4, 6, 8
  teamsPerGroup: number,        // 2–12
  advanceCount: number,         // top N per group advance
  groupStageBestOf: number,     // 1, 2, 3, 5, 7
  groupStageType: string,       // "bestof" (Bo) or "playall" (Go)
  groupMeetings: number,        // 1 = single round-robin, 2 = double, …
  matchPace: string,            // "daily" | "twice-weekly" | "weekly" | "biweekly" | "flexible"

  // Playoff settings (single / double elim path)
  playoffFormat: string,        // "single" | "double"
  playoffTeams: number,         // 4, 8, 12, 16, 32
  playoffR32BestOf: number, playoffR32Type: string,
  playoffR16BestOf: number, playoffR16Type: string,
  playoffQFBestOf: number,  playoffQFType: string,
  playoffSFBestOf: number,  playoffSFType: string,
  playoffFinalBestOf: number, playoffFinalType: string,
  playoff3rdBestOf: number,   playoff3rdType: string,   // 0 = disabled
  // Double-elim extras
  playoffLosersBestOf: number, playoffLosersType: string,
  playoffGrandFinalBestOf: number, playoffGrandFinalType: string,
  playoffBracketReset: boolean,

  // Multi-tier playoffs (used when format === "multi-tier")
  playoffTiers: Tier[],         // see Tier Object below

  // Points & tie-breakers
  pointsWin: number,            // default 3
  pointsLoss: number,           // default 0
  tieBreakers: string[],        // ordered: ["mapDiff", "fragDiff", "headToHead"]

  // Data
  teams: Team[],
  schedule: Match[],
  bracket: BracketData,         // single or double elim structure
  rawMaps: RawMapData[]
}
```

**Tier Object** (inside `playoffTiers`):
```javascript
{
  id: string,
  name: string,                 // "Gold Playoffs", "Silver Playoffs", …
  positions: string,            // "1-4", "5-8", …
  type: string,                 // "single" | "double"
  teams: number,
  bracket: BracketData
}
```

**Team Object:**
```javascript
{
  id: string,
  name: string,
  tag: string,                  // Short identifier
  country: string,
  players: string[],
  group: string                 // "A", "B", … — set via Teams tab
}
```

**Match Object:**
```javascript
{
  id: string,                   // "match-<timestamp>-<group>"
  team1: string,
  team2: string,
  status: string,               // "scheduled" | "live" | "completed"
  round: string,                // "group" | "quarter" | "semi" | "final" | "third" | …
  group: string,                // "A", "B", … (group-stage matches only)
  roundNum: number,             // wave number within the group (1, 2, 3, …)
  meeting: number,              // which round-robin pass (1 = first, 2 = second, …)
  bestOf: number,               // 1, 3, 5, 7
  date: string,                 // YYYY-MM-DD
  time: string,
  maps: MapResult[],            // per-map scores
  forfeit: string | null        // null | "team1" | "team2" (match-level forfeit)
}
```

**MapResult Object:**
```javascript
{
  id: string,
  map: string,                  // map name, e.g. "dm3"
  score1: number,               // team1 frags
  score2: number,               // team2 frags
  forfeit: string | null        // null | "team1" | "team2" (map-level forfeit)
}
```

**BracketData Object** (created by `createDefaultBracket` in App.jsx):
```javascript
// Single elimination
{
  format: 'single',
  teamCount: number,            // 4 | 8 | 12 | 16 | 32
  winners: {
    round32?: BracketMatch[],   // present when teamCount ≥ 32
    round16?: BracketMatch[],   // present when teamCount ≥ 16
    round12?: BracketMatch[],   // present when teamCount ≥ 12
    quarterFinals?: BracketMatch[],
    semiFinals: BracketMatch[2],
    final: BracketMatch
  },
  thirdPlace: BracketMatch
}

// Double elimination adds:
{
  format: 'double',
  winners: { … },               // same tiers as single
  losers: {
    round1…round6: BracketMatch[],
    final: BracketMatch
  },
  grandFinal: BracketMatch,
  bracketReset: { …, needed: boolean }
}
```

## Code Conventions

### React Patterns
- **Functional components only** — use hooks for state and side effects
- **State management** — useState for local state, lifted state in App.jsx for global tournament data
- **Props drilling** — data passed through component tree (no Redux/Context)
- **Custom hooks** — useLocalStorage for persistence

### Naming Conventions
- **Components**: PascalCase (`DivisionSetup.jsx`)
- **Utilities**: camelCase (`matchLogic.js`)
- **Functions**: verb-first (`parseMatch`, `calculateStandings`)
- **Constants**: UPPER_SNAKE_CASE (`STORAGE_KEY`, `SERIES_GAP_MS`)
- **Booleans**: is/show/has prefix (`isPlayed`, `showAddForm`)

### CSS/Styling
- **Tailwind utility classes** in all components
- **Modern dark-mode palette** — Deep Amber/Gold accent (`#FFB300`), dark backgrounds (`#121212` app / `#1E1E2E` cards)
- **Color tokens**: `qw-accent` (amber), `qw-win` (green `#00FF88`), `qw-loss` (red `#FF3366`), `qw-muted` (secondary text)
- **Fonts**: Inter for all UI text; Orbitron only on the QW logo badge (`font-logo`)
- **Custom components**: `qw-panel` (card with 10 px radius + shadow), `qw-btn` (primary amber button), `qw-btn-secondary` (ghost border variant)
- **Rounded corners** — panels 10 px, buttons 6 px (modern aesthetic)
- **Legacy classes neutralised**: `.noise-overlay`, `.scanline`, `.glow-*`, `.animate-pulse-glow` all set to `display:none` / `none` in `index.css`; some still appear in JSX but have no visual effect

### File Organization
- One component per file
- Related division components in `src/components/division/`
- Business logic in `src/utils/`
- API integration in `src/services/`

## Important Files

| File | Lines | Purpose |
|------|-------|---------|
| `App.jsx` | ~546 | Root component, tournament/division state, bracket factories (`createDefaultBracket`) |
| `DivisionWiki.jsx` | ~1261 | MediaWiki export (most complex component) |
| `DivisionResults.jsx` | ~920 | Result import (Discord/API/JSON), series grouping, submission approval |
| `DivisionBracket.jsx` | ~690 | Playoff bracket UI — single, double, multi-tier |
| `DivisionSetup.jsx` | ~647 | Format, group-stage, playoff, tier configuration |
| `DivisionSchedule.jsx` | ~626 | Match scheduling, round-robin generation, drag-and-drop |
| `DivisionTeams.jsx` | ~344 | Team CRUD and group assignment |
| `DivisionStandings.jsx` | ~301 | Group-stage standings with configurable tie-breakers |
| `matchLogic.js` | ~227 | Parsing & standings calc used by the API import path |
| `dataTransformer.js` | ~328 | API response → internal format transformation |
| `statsLogic.js` | ~412 | QuakeWorld stats calculations |

## API Integration

### Vercel Serverless Functions

**Health Check:**
```
GET /api/health
Response: { status: 'ok', timestamp: '...' }
```

**Game Data:**
```
GET /api/game/[gameId]
Response: { status: 'success', data: <ktxstats JSON> }
```
Fetches game record from QuakeWorld Hub Supabase (`v1_games`), extracts `demo_sha256`, then fetches the actual ktxstats JSON from `d.quake.world`.

**Discord Submissions:**
```
GET /api/submissions/[tournamentId]?status=pending|approved|all
Response: { submissions: [...] }

POST /api/submission/[submissionId]/approve
Response: { submission: {...} }

POST /api/submission/[submissionId]/reject
Response: { submission: {...} }
```
Reads/updates `match_submissions` table in the QWICKY Supabase instance.

### External Services
- **QuakeWorld Hub Supabase** (`ncsphkjfominimxztjip.supabase.co`): Game metadata (`v1_games` table)
- **QuakeStats** (`d.quake.world`): ktxstats JSON demo stats
- **QWICKY Supabase** (`ypszoognrteuevcsfwqr.supabase.co`): Discord submissions (`match_submissions`, `tournament_channels` tables)

### ktxstats JSON Format (used by both API proxy and Discord bot)
```json
{
  "teams": ["Team A", "Team B"],
  "date": "2026-01-15 20:00:00 +0000",
  "map": "dm3",
  "mode": "team",
  "duration": 600,
  "players": [
    { "name": "player1", "team": "Team A", "stats": { "frags": 40 } }
  ]
}
```
Note: `team_stats` is present in some formats but NOT in ktxstats team games. Scores are calculated by summing `player.stats.frags` (or `player.frags` for older hub-row format) per team. The `parseMatch` function in `matchLogic.js` handles both.
```

## Development Workflow

### Local Development
1. Run `npm run dev` — starts Vite on port 5175
2. API proxy configured to `localhost:3001` for local backend testing
3. Hot Module Replacement enabled for fast iteration

### Building
1. `npm run build` — outputs to `/dist`
2. PostCSS/Tailwind purges unused CSS
3. Vite tree-shakes for optimization

### Deployment
- **Vercel** (primary): Auto-deploys serverless functions from `/api`
- **GitHub Pages** (alternative): CI workflow builds and deploys to gh-pages

### Docker Development
```bash
docker-compose up
# Runs Node 20 Alpine, mounts app directory, port 3000
```

## Common Tasks

### Adding a New Division Feature
1. Create component in `src/components/division/`
2. Add tab entry in `DivisionView.jsx` (`subTabs` array + `renderSubContent` switch)
3. Add state handling in `App.jsx` if needed
4. Use Tailwind classes matching existing dark-mode theme

### Modifying Standings Calculation
- The standings table (what the user sees) is calculated inside `DivisionStandings.jsx` — this is the authoritative path for the UI.
- `src/utils/matchLogic.js` has a separate `calculateStandings` used only when importing results via the API.
- Tie-breaker order is stored in `division.tieBreakers` and rendered as a draggable list in `DivisionSetup.jsx`.

### Updating Wiki Export
- Edit `src/components/division/DivisionWiki.jsx`
- Supporting utilities in `src/utils/wikiExport.js`
- MediaWiki markup templates are inline

### Adding API Endpoint
1. Create file in `api/` directory
2. Use `.mjs` extension for ES modules
3. Export default async function handler

### Modifying Playoff Brackets
- Bracket structure factories live in `App.jsx`: `createDefaultBracket(format, teamCount)`
- `DivisionSetup.jsx` manages format/tier configuration and calls the factories when format or team count changes.
- `DivisionBracket.jsx` renders the bracket; it supports single-elim (`SingleElimBracket`), double-elim (`DoubleElimBracket`), and multi-tier (renders a bracket per tier).

### Modifying the Schedule / Drag-and-Drop
- Schedule generation (polygon round-robin) and drag-and-drop logic both live in `DivisionSchedule.jsx`.
- Drag uses HTML5 native DnD. A `useRef` (`dragGroupRef`) holds the source group to avoid stale closures; `requestAnimationFrame` delays the opacity state update so the browser doesn't cancel the drag. Only same-group, different-round drops are accepted; the match's `roundNum` and `date` are updated on drop.

## Discord Integration

### Overview

QWICKY has a companion Discord bot (`qwicky-discord-bot`) that lets tournament players submit match results by posting QuakeWorld Hub URLs in registered Discord channels. Submissions appear in QWICKY's Results tab under the "Discord" sub-tab for admin review.

### Data Flow

```
Player posts hub URL in Discord channel
  → Bot extracts game ID from URL
  → Bot fetches ktxstats JSON from QuakeWorld Hub (via demo_sha256)
  → Bot stores submission in Supabase (match_submissions table)
  → Bot replies with embed showing teams, scores, map
  → Admin opens QWICKY → Results → Discord tab
  → Admin clicks Approve / Approve All
  → parseMatch processes ktxstats JSON → addMapsInBatch links to schedule
  → Series detection groups maps by matchup + 2-hour timestamp gap
```

### Key Implementation Details

**DivisionResults.jsx — Discord mode:**
- `fetchSubmissions(includeApproved)` — fetches from `/api/submissions/[tournamentId]` with `?status=pending|all`
- `handleApprove(submission)` — parses game data FIRST, then marks as approved in DB (prevents data loss if parsing fails)
- `handleBulkApprove()` — collects all parsed maps into an array, approves each in DB, then calls `addMapsInBatch` ONCE with the full batch (required for series detection and to avoid stale closure issues)
- `handleReprocess(submission)` — re-imports an already-approved submission without touching the DB
- `handleBulkReprocess()` — same batching pattern for bulk re-import of approved submissions
- "Show Approved" checkbox — toggles fetching approved submissions (for recovery)
- "Reprocess All" button — bulk re-imports approved submissions that weren't properly processed

**parseMatch (matchLogic.js) — format handling:**
- Normalizes `teams` array: handles both string format `["Team A"]` and object format `[{name: "Team A", frags: 150}]`
- Player frags: reads `player.stats?.frags ?? player.frags ?? 0` (ktxstats vs hub-row format)
- Scores: uses `team_stats` if available, otherwise sums from `players` array

**Submission display — score calculation:**
- Hub-row format: reads `teams[0].frags` directly
- ktxstats with `team_stats`: reads `team_stats[teamName].frags`
- ktxstats without `team_stats`: sums `player.stats.frags` from players array per team

### Supabase Tables (QWICKY instance)

**`tournament_channels`** — Maps Discord channels to tournaments
- `discord_channel_id` (unique), `discord_guild_id`, `tournament_id`, `division_id`, `registered_by`

**`match_submissions`** — Stores submitted match results
- `tournament_id`, `game_id` (unique per tournament), `game_data` (JSONB — ktxstats JSON)
- `status`: `pending` → `approved` or `rejected`
- `submitted_by_discord_id`, `submitted_by_name`, `hub_url`

### Environment Variables (Vercel — for submission endpoints)
| Variable | Purpose |
|----------|---------|
| `QWICKY_SUPABASE_URL` | QWICKY Supabase instance URL |
| `QWICKY_SUPABASE_SERVICE_KEY` | Service key for match_submissions access |

## Gotchas & Notes

1. **Swedish comments** appear in `vite.config.js` (e.g., `// Så du kan nå den från nätverket`).
2. **localStorage persistence** — tournament data saved automatically via `useLocalStorage` hook.
3. **Team matching is case-insensitive** throughout: standings lookup, bracket result resolution, and API import all normalise to lowercase before comparing.
4. **Series detection** uses a 2-hour timestamp gap threshold (`SERIES_GAP_MS` in `DivisionResults.jsx`) to split consecutive maps of the same matchup into separate series.
5. **Backup / copy files** exist and can be ignored: `DivisionSchedule (copy 1).jsx`, `DivisionWiki (copy 1).jsx`.
6. **No TypeScript** — project uses plain JavaScript.
7. **No unit tests** — manual testing required.
8. **Legacy cyberpunk remnants** — some JSX still references classes like `.noise-overlay`, `.glow-amber`, `.terminal-label::before`. All are neutralised in `index.css` and produce no visual effect; safe to ignore unless doing a cleanup pass.
9. **Division fields are flat** — do NOT nest group/playoff settings inside a `format` sub-object. Everything (numGroups, playoffQFBestOf, tieBreakers, …) sits directly on the division.
10. **Match status values** are `"scheduled"`, `"live"`, `"completed"` — not `"pending"` or `"played"`.
11. **Header is static** — always shows "QWICKY / tournament admin tools - by Xerial", not the tournament name.
12. **Bulk operations must batch maps** — `handleBulkApprove` and `handleBulkReprocess` must collect all parsed maps FIRST, then call `addMapsInBatch` ONCE. Calling it in a loop causes stale closure reads of `rawMaps` (last write wins) and breaks series detection.
13. **ktxstats has no `team_stats` for team games** — scores must be calculated from the `players` array. Only some formats (e.g., simple JSON exports) include `team_stats`.
14. **Discord bot is a separate project** — lives at `../qwicky-discord-bot/`. Changes to submission handling may require updates in both repos.

## Environment Variables

Create `.env` file from `.env.example`:
```
VITE_API_BASE_URL=<your-api-endpoint>
```

## Key Business Logic

### Schedule Generation (`DivisionSchedule.jsx`)
- Uses the **polygon (circle) method** to produce N-1 rounds where every team plays exactly once per round. Odd team counts get a bye placeholder.
- Dates are auto-calculated from the tournament start date according to `matchPace`.
- Multiple round-robin passes (`groupMeetings`) are supported; home/away sides swap each pass.
- Matches are displayed grouped by `roundNum` ("Round 1", "Round 2", …). Users can drag matches between rounds; the drop handler recalculates the date.

### Match Parsing (`matchLogic.js`)
- `unicodeToAscii(name)` — cleans QuakeWorld's high-bit character encoding.
- `parseMatch(gameId, jsonData)` — parses match from both `team_stats` (simple) and `players[]` (ktxstats full) formats. Also handles 1-on-1 by extracting player names as pseudo-teams.
- `calculateStandings(allMatches)` — standings from raw parsed maps (used in the import path).
- `getSeriesSummary(allMatches)` — groups maps by matchup key for bracket resolution.
- `findBracketMatch(team1, team2, summary)` — case-insensitive lookup of a series result.

### Standings Calculation (`DivisionStandings.jsx`)
- Self-contained `calculateStandings(schedule, division)` that reads from the schedule array directly.
- Awards points per **series win** in Best-Of mode, or per **map win** in Play-All (Go) mode.
- Configurable tie-breaker chain: `mapDiff` (maps won − maps lost), `fragDiff` (frags for − against), `headToHead`.
- Tracks `fragsFor` / `fragsAgainst` per team for the frag-difference tie-breaker.

### Stats Calculation (`statsLogic.js`)
- QuakeWorld-specific: frags, deaths, damage, armor
- Weapon accuracy tracking
- Item opportunity analysis
- Quake color code parsing

### Data Transformation (`dataTransformer.js`)
- `transformToDivision(apiData, divisionName)` — full API response → internal division format.
- `buildBracketFromGames(playoffGames, teams)` — auto-generate bracket structure from imported playoff results.
