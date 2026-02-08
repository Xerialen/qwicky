# Qwicky Runbook

Operational reference for the Qwicky application (QuakeWorld Tournament Admin).

## What It Is

Qwicky is a React single-page application for managing competitive QuakeWorld esports tournaments. It handles team management, match scheduling, standings, playoff brackets, and MediaWiki export. All tournament data is persisted in the user's browser via `localStorage` -- there is no application database for the frontend.

## Architecture Overview

```
┌───────────────────────────────────┐
│        Discord Channels           │
│   Players post hub.quakeworld.nu  │
│   URLs to submit match results    │
└──────────────┬────────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│       QWICKY Discord Bot         │
│  Node.js (discord.js v14)        │
│  Runs on host / always-on server │
│  Repo: qwicky-discord-bot        │
└──────┬───────────────┬───────────┘
       │ fetch ktxstats│ store submissions
       ▼               ▼
┌────────────┐  ┌─────────────────┐
│ QW Hub     │  │ QWICKY Supabase │
│ Supabase + │  │ match_submissions│
│ d.quake.   │  │ tournament_     │
│ world      │  │ channels        │
└────────────┘  └────────┬────────┘
       ▲                 │ read/approve/reject
       │                 ▼
┌──────┴──────────────────────────────────────────┐
│                    Clients (Browser)             │
│         React 18 SPA + localStorage persistence  │
└──────────────┬──────────────────────┬───────────┘
               │  Static assets       │  /api/* calls
               ▼                      ▼
┌──────────────────────┐  ┌──────────────────────────┐
│   Vercel CDN / Edge  │  │  Vercel Serverless Fns   │
│   (static hosting)   │  │  Node.js runtime         │
└──────────────────────┘  └─────┬──────────┬─────────┘
                                │          │
                                ▼          ▼
                       ┌────────────┐ ┌──────────────┐
                       │  QW Hub    │ │ QuakeStats   │
                       │  Supabase  │ │ d.quake.world│
                       │  (v1_games)│ │              │
                       └────────────┘ └──────────────┘
```

**Key points:**
- The frontend is fully static. Tournament data lives in the user's browser (`localStorage`).
- Vercel serverless functions proxy external game data and manage Discord submissions.
- The Discord bot is a separate always-on Node.js process that listens for hub URLs and stores submissions in Supabase.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18.2, Vite 5.0, Tailwind CSS 3.4 |
| Module System | ES Modules (`package.json` has `"type": "module"`) |
| Build Config | PostCSS (`.cjs` format for CommonJS compatibility) |
| API | Vercel Serverless Functions (Node.js, ES modules `.mjs`) |
| Discord bot | Node.js, discord.js v14 (separate repo: `qwicky-discord-bot`) |
| QWICKY Supabase | Discord submissions (`match_submissions`, `tournament_channels`) |
| QW Hub Supabase | Game metadata (`v1_games`) |
| QuakeStats | Demo stats (`d.quake.world`) — ktxstats JSON |
| Persistence | Browser localStorage (no app database for tournament state) |
| HTTP client | Axios |

## Deployment

### Primary: Vercel

Vercel is the primary deployment target. It serves both the static SPA and the serverless API functions.

**How it works:**
- Vercel auto-detects the Vite project and builds via `npm run build` (output: `dist/`)
- Serverless functions are auto-deployed from the `api/` directory
- Configuration is minimal -- `vercel.json` only specifies `{ "version": 2 }`
- Vercel handles CDN distribution, SSL, and function routing

**Serverless functions deployed:**
| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Health check, returns `{ status: 'ok', timestamp }` |
| `GET /api/game/[gameId]` | Fetches game from QW Hub Supabase, then retrieves ktxstats JSON from QuakeStats |
| `GET /api/submissions/[tournamentId]` | Lists Discord submissions (query param `?status=pending\|approved\|all`) |
| `POST /api/submission/[submissionId]/approve` | Marks a submission as approved |
| `POST /api/submission/[submissionId]/reject` | Marks a submission as rejected |

**Environment variables required on Vercel:**
| Variable | Purpose |
|----------|---------|
| `SUPABASE_KEY` | API key for QW Hub Supabase REST access (game data) |
| `QWICKY_SUPABASE_URL` | QWICKY Supabase instance URL (submissions) |
| `QWICKY_SUPABASE_SERVICE_KEY` | Service key for QWICKY Supabase (submissions) |
| `VITE_API_BASE_URL` | API base URL exposed to the frontend (build-time) |

### Secondary: GitHub Pages

A GitHub Actions workflow (`.github/workflows/node.js.yml`) provides an alternative static deployment to GitHub Pages on push to `main`. This deploys the frontend only -- serverless functions are not available on GitHub Pages, so API calls will not work unless pointed at an external host.

### Docker (Local Development)

A `docker-compose.yml` is provided for containerized local development:
- Image: `node:20-alpine`
- Mounts the project directory into `/app`
- Runs `npm install && npm run dev -- --host`
- Exposes on port `3000`

## Running Locally

```bash
npm install
npm run dev        # Vite dev server on port 5175
npm run build      # Production build to dist/
npm run preview    # Preview production build
```

The Vite dev server proxies `/api/*` requests to `http://localhost:3001`, so if you need the API functions locally you'll need a local backend on that port (or use `vercel dev`).

### Build Configuration Notes

- **ES Modules**: `package.json` includes `"type": "module"`, treating all `.js` files as ES modules
- **PostCSS Config**: Uses `.cjs` extension (`postcss.config.cjs`) to maintain CommonJS compatibility
- **Vite Config**: Pure ES module (`vite.config.js`) - no CJS warnings
- **API Functions**: Use `.mjs` extension in the `api/` directory for Vercel serverless functions

## Discord Bot (`qwicky-discord-bot`)

The Discord bot is a separate Node.js application that runs as an always-on process. It is **not** deployed to Vercel — it needs to be running on a host machine.

**Repository:** `qwicky-discord-bot` (sibling directory to `qwicky`)

### What it does
1. Listens for messages containing `hub.quakeworld.nu` URLs in registered Discord channels
2. Extracts game IDs from URLs (supports `/game/{id}`, `/qtv/{id}`, `/games?gameId={id}`)
3. Fetches the game record from QW Hub Supabase, then fetches the full ktxstats JSON via `demo_sha256`
4. Stores the ktxstats JSON as `game_data` in the QWICKY Supabase `match_submissions` table
5. Replies with a Discord embed showing team names, scores, map, and mode

### Slash Commands
| Command | Permission | Purpose |
|---------|-----------|---------|
| `/register <tournament-id> [division-id]` | Manage Channels | Link a Discord channel to a QWICKY tournament |
| `/unregister` | Manage Channels | Unlink a channel |
| `/status` | — | Show which tournament a channel is linked to |

### Running the bot
```bash
cd qwicky-discord-bot
npm install
npm start          # Production
npm run dev        # Development (--watch mode)
```

### Environment variables (`.env`)
| Variable | Purpose |
|----------|---------|
| `DISCORD_TOKEN` | Bot authentication token |
| `DISCORD_CLIENT_ID` | Bot application client ID |
| `SUPABASE_URL` | QWICKY Supabase URL (submissions storage) |
| `SUPABASE_SERVICE_KEY` | QWICKY Supabase service key |
| `HUB_SUPABASE_KEY` | QW Hub Supabase anon key (game lookups) |

### Process management
The bot currently runs as a foreground Node.js process. For production, consider running it with `pm2`, `systemd`, or similar to ensure restarts on crash:
```bash
# Example with pm2
pm2 start src/index.js --name qwicky-bot
pm2 save
```

## External Dependencies

| Service | Used By | Failure Impact |
|---------|---------|---------------|
| **QW Hub Supabase** (`ncsphkjfominimxztjip.supabase.co`) | `api/game/[gameId]`, Discord bot | Game data import fails; rest of app unaffected |
| **QuakeStats** (`d.quake.world`) | `api/game/[gameId]`, Discord bot | ktxstats fetch fails; no scores or player data available |
| **QWICKY Supabase** (`ypszoognrteuevcsfwqr.supabase.co`) | `api/submissions/*`, Discord bot | Discord submissions cannot be stored or retrieved |
| **Discord API** | Discord bot | Bot goes offline; existing submissions in DB still accessible |

If all external services are down, the app still functions fully for manual tournament management — only the automated game import and Discord submission features are affected.

## Operational Notes

- **No application database for tournament state.** All tournament data lives in the user's browser (`localStorage`). There is nothing to back up or migrate server-side for user tournament data.
- **QWICKY Supabase stores Discord submissions only.** The `match_submissions` and `tournament_channels` tables are the only server-side persistent state. Losing this data means Discord submissions need to be re-submitted.
- **Serverless functions are stateless.** No caching layer, no sessions. Each request is independent.
- **CORS is open** (`*`) on all API endpoints. This is intentional — the API serves public game data and submissions are managed by the admin.
- **No authentication on the web app.** The app is a local admin tool, not a multi-tenant service. The Discord bot uses channel registration as a lightweight access control.
- **The Discord bot is a separate long-running process.** It must be running for URL detection to work. If it crashes, submissions stop but the web app continues to function normally.
- **Build output** goes to `dist/`. Vite handles tree-shaking and Tailwind purges unused CSS.
- **Node.js 20** is the target runtime (specified in CI and Docker).

## Health Check

```
GET /api/health
→ 200 { "status": "ok", "timestamp": "2026-02-06T..." }
```

## Monitoring Considerations

Since the frontend is entirely client-side with localStorage, the server-side components to monitor are:
1. **Vercel function invocations** — check for elevated error rates on `/api/game/*` and `/api/submissions/*`
2. **QW Hub Supabase availability** — the `SUPABASE_KEY` must remain valid
3. **QWICKY Supabase availability** — the `QWICKY_SUPABASE_SERVICE_KEY` must remain valid
4. **QuakeStats uptime** — third-party dependency, no SLA
5. **Discord bot process** — ensure it stays running (check with `ps aux | grep "node src/index"`); consider pm2 or systemd for auto-restart
