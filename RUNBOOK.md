# Qwicky Runbook

Operational reference for the Qwicky application (QuakeWorld Tournament Admin).

## What It Is

Qwicky is a React single-page application for managing competitive QuakeWorld esports tournaments. It handles team management, match scheduling, standings, playoff brackets, and MediaWiki export. All tournament data is persisted in the user's browser via `localStorage` -- there is no application database for the frontend.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Clients (Browser)                 │
│         React 18 SPA + localStorage persistence      │
└──────────────┬──────────────────────┬───────────────┘
               │  Static assets       │  /api/* calls
               ▼                      ▼
┌──────────────────────┐  ┌──────────────────────────┐
│   Vercel CDN / Edge  │  │  Vercel Serverless Fns   │
│   (static hosting)   │  │  Node.js runtime         │
└──────────────────────┘  └─────┬──────────┬─────────┘
                                │          │
                                ▼          ▼
                       ┌────────────┐ ┌──────────────┐
                       │  Supabase  │ │ QuakeStats   │
                       │  (v1_games)│ │ d.quake.world│
                       └────────────┘ └──────────────┘
```

**Key point:** The frontend is fully static. The only server-side component is two lightweight Vercel serverless functions that proxy external game data.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18.2, Vite 5.0, Tailwind CSS 3.4 |
| API | Vercel Serverless Functions (Node.js, ES modules) |
| External data | Supabase (game metadata), QuakeStats (demo stats) |
| Persistence | Browser localStorage (no app database) |
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
| `GET /api/game/[gameId]` | Fetches game data from Supabase, then retrieves demo stats from QuakeStats |

**Environment variables required on Vercel:**
| Variable | Purpose |
|----------|---------|
| `SUPABASE_KEY` | API key for Supabase REST access (used server-side only) |
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
```

The Vite dev server proxies `/api/*` requests to `http://localhost:3001`, so if you need the API functions locally you'll need a local backend on that port (or use `vercel dev`).

## External Dependencies

| Service | Used By | Failure Impact |
|---------|---------|---------------|
| **Supabase** (`ncsphkjfominimxztjip.supabase.co`) | `api/game/[gameId]` | Game data import fails; rest of app unaffected |
| **QuakeStats** (`d.quake.world`) | `api/game/[gameId]` | Detailed match stats unavailable; partial response returned |

If both external services are down, the app still functions fully for manual tournament management -- only the automated game import feature is affected.

## Operational Notes

- **No application database.** All tournament state lives in the user's browser. There is nothing to back up or migrate server-side for user data.
- **Serverless functions are stateless.** No caching layer, no sessions. Each request is independent.
- **CORS is open** (`*`) on both API endpoints. This is intentional -- the API serves public game data.
- **No authentication.** The app is a local tool, not a multi-tenant service.
- **Build output** goes to `dist/`. Vite handles tree-shaking and Tailwind purges unused CSS.
- **Node.js 20** is the target runtime (specified in CI and Docker).

## Health Check

```
GET /api/health
→ 200 { "status": "ok", "timestamp": "2026-02-06T..." }
```

## Monitoring Considerations

Since the frontend is entirely client-side with localStorage, the only server-side components to monitor are:
1. **Vercel function invocations** -- check for elevated error rates on `/api/game/*`
2. **Supabase availability** -- the `SUPABASE_KEY` must remain valid
3. **QuakeStats uptime** -- third-party dependency, no SLA
