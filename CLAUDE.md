# CLAUDE.md - AI Assistant Guide for Qwicky

This document provides guidance for AI assistants working with the Qwicky codebase (QuakeWorld Tournament Admin).

## Project Overview

Qwicky is a React-based Single Page Application for managing competitive QuakeWorld esports tournaments. It supports multi-division tournament management with features including team management, scheduling, standings calculation, playoff brackets, and MediaWiki export.

**Tech Stack:**
- React 18.2 with Vite 5.0
- Tailwind CSS 3.4 with custom cyberpunk theme
- Axios for HTTP requests
- Vercel serverless functions for API layer
- localStorage for data persistence

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
│   ├── App.jsx                    # Root component, tournament state management
│   ├── main.jsx                   # React entry point
│   ├── index.css                  # Global styles with cyberpunk theme
│   ├── components/
│   │   ├── Header.jsx             # Navigation bar with division dropdown
│   │   ├── TournamentInfo.jsx     # Tournament metadata editor
│   │   ├── DivisionManager.jsx    # Create/edit/delete divisions
│   │   ├── DivisionView.jsx       # Division tab container
│   │   ├── DataManager.jsx        # Save/Load/Reset functionality
│   │   └── division/              # Per-division components
│   │       ├── DivisionSetup.jsx      # Format & rule configuration
│   │       ├── DivisionTeams.jsx      # Team management
│   │       ├── DivisionSchedule.jsx   # Match scheduling
│   │       ├── DivisionResults.jsx    # Result import (API/JSON)
│   │       ├── DivisionStandings.jsx  # Group stage standings
│   │       ├── DivisionBracket.jsx    # Playoff bracket UI
│   │       ├── DivisionStats.jsx      # Player statistics
│   │       └── DivisionWiki.jsx       # MediaWiki export
│   ├── utils/
│   │   ├── matchLogic.js          # Match parsing, standings calculation
│   │   ├── wikiExport.js          # MediaWiki markup generation
│   │   └── statsLogic.js          # QuakeWorld-specific stats
│   ├── services/
│   │   ├── api.js                 # Axios API client
│   │   └── dataTransformer.js     # API response transformers
│   └── hooks/
│       └── useLocalStorage.js     # localStorage persistence hook
├── api/                           # Vercel serverless functions
│   ├── game/[gameId].mjs          # Fetch game stats
│   └── health.mjs                 # Health check endpoint
├── vite.config.js                 # Vite configuration
├── tailwind.config.js             # Tailwind theme customization
└── vercel.json                    # Vercel deployment config
```

## Architecture & Data Flow

### Component Hierarchy

```
App.jsx (state provider)
├── Header (navigation, division dropdown)
└── Tab Router:
    ├── "info" → TournamentInfo
    ├── "divisions" → DivisionManager
    ├── "division" → DivisionView
    │   ├── "setup" → DivisionSetup
    │   ├── "teams" → DivisionTeams
    │   ├── "schedule" → DivisionSchedule
    │   ├── "results" → DivisionResults
    │   ├── "standings" → DivisionStandings
    │   ├── "bracket" → DivisionBracket
    │   ├── "stats" → DivisionStats
    │   └── "wiki" → DivisionWiki
    └── "data" → DataManager
```

### Key Data Structures

**Tournament Object:**
```javascript
{
  name: string,
  mode: string,           // e.g., "4on4"
  startDate: string,
  endDate: string,
  divisions: Division[],
  activeDivisionId: string
}
```

**Division Object:**
```javascript
{
  id: string,
  name: string,
  format: {
    groups: number,
    teamsPerGroup: number,
    seriesFormat: string,  // "Bo1", "Bo3", "Bo5", "Bo7"
    advancingTeams: number,
    points: { win, draw, loss }
  },
  teams: Team[],
  schedule: Match[],
  bracket: BracketData,
  standings: StandingsData,
  players: Player[],
  rawMaps: RawMapData[]
}
```

**Team Object:**
```javascript
{
  id: string,
  name: string,
  tag: string,            // Short team identifier
  country: string,
  players: string[]
}
```

**Match Object:**
```javascript
{
  id: string,
  team1: string,
  team2: string,
  status: string,         // "pending", "played"
  date: string,
  maps: MapResult[],
  scores: { team1: number, team2: number }
}
```

## Code Conventions

### React Patterns
- **Functional components only** - use hooks for state and side effects
- **State management** - useState for local state, lifted state in App.jsx for global data
- **Props drilling** - data passed through component tree (no Redux/Context for global state)
- **Custom hooks** - useLocalStorage for persistence

### Naming Conventions
- **Components**: PascalCase (`DivisionSetup.jsx`)
- **Utilities**: camelCase (`matchLogic.js`)
- **Functions**: verb-first (`parseMatch`, `calculateStandings`)
- **Constants**: UPPER_SNAKE_CASE (`STORAGE_KEY`, `SERIES_GAP_MS`)
- **Booleans**: is/show/has prefix (`isPlayed`, `showAddForm`)

### CSS/Styling
- **Tailwind utility classes** in all components
- **Custom theme** with `qw-*` color prefix (qw-amber, qw-blue, qw-green, qw-red)
- **Custom fonts**: Orbitron (display), Rajdhani (body), JetBrains Mono (mono)
- **Custom components**: `qw-panel`, `qw-btn`, `qw-label` classes
- **Hard edges** - no border radius (cyberpunk aesthetic)

### File Organization
- One component per file
- Related division components in `src/components/division/`
- Business logic in `src/utils/`
- API integration in `src/services/`

## Important Files

| File | Lines | Purpose |
|------|-------|---------|
| `App.jsx` | ~550 | Root component, tournament/division state, bracket generation |
| `DivisionWiki.jsx` | ~900 | MediaWiki export (most complex) |
| `DivisionResults.jsx` | ~670 | Result import from API/JSON |
| `DivisionBracket.jsx` | ~520 | Playoff bracket visualization |
| `DivisionSchedule.jsx` | ~470 | Match scheduling |
| `matchLogic.js` | ~210 | Core parsing and standings calculation |
| `dataTransformer.js` | ~330 | API response transformation |
| `statsLogic.js` | ~350 | QuakeWorld stats calculations |

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
Response: Game stats from Supabase/QuakeStats
```

### External Services
- **Supabase**: Database (`v1_games` table)
- **QuakeStats**: Demo stats (`https://d.quake.world/`)
- **API Proxy**: Via shortener URL in `.env`

### Expected Game API Response
```json
{
  "teams": ["Team A", "Team B"],
  "date": "2024-01-15 20:00",
  "map": "dm3",
  "mode": "4on4",
  "team_stats": {
    "Team A": { "frags": 150 },
    "Team B": { "frags": 120 }
  }
}
```

## Development Workflow

### Local Development
1. Run `npm run dev` - starts Vite on port 5175
2. API proxy configured to `localhost:3001` for local backend testing
3. Hot Module Replacement enabled for fast iteration

### Building
1. `npm run build` - outputs to `/dist`
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
2. Add tab to `DivisionView.jsx`
3. Add state handling in `App.jsx` if needed
4. Use Tailwind classes matching existing theme

### Modifying Standings Calculation
- Edit `src/utils/matchLogic.js`
- Key function: `calculateStandings(allMatches)`
- Tie-breaker logic also in this file

### Updating Wiki Export
- Edit `src/components/division/DivisionWiki.jsx`
- Supporting utilities in `src/utils/wikiExport.js`
- MediaWiki markup templates are inline

### Adding API Endpoint
1. Create file in `api/` directory
2. Use `.mjs` extension for ES modules
3. Export default async function handler

## Gotchas & Notes

1. **Swedish comments** appear in some config files (vite.config.js)
2. **localStorage persistence** - tournament data saved automatically via useLocalStorage hook
3. **Team matching** uses multiple strategies: tag, name, lowercase comparison
4. **Series detection** uses 2-hour timestamp gap threshold (`SERIES_GAP_MS`)
5. **Backup files** exist (e.g., `DivisionSchedule (copy 1).jsx`) - can be ignored
6. **No TypeScript** - project uses plain JavaScript
7. **No unit tests** - manual testing required

## Environment Variables

Create `.env` file from `.env.example`:
```
VITE_API_BASE_URL=<your-api-endpoint>
```

## Key Business Logic

### Match Parsing (`matchLogic.js`)
- `unicodeToAscii(name)` - Cleans QuakeWorld's special character encoding
- `parseMatch(gameId, jsonData)` - Parses match from various formats
- `calculateStandings(allMatches)` - Generates standings from results
- `getSeriesSummary(allMatches)` - Groups maps into series

### Stats Calculation (`statsLogic.js`)
- QuakeWorld-specific: frags, deaths, damage, armor
- Weapon accuracy tracking
- Item opportunity analysis
- Quake color code parsing

### Data Transformation (`dataTransformer.js`)
- `transformToDivision(apiData, divisionName)` - Full API to internal format
- `buildBracketFromGames(playoffGames, teams)` - Auto-generate bracket structure
