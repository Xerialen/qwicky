# QuakeWorld Tournament Admin

A React-based tournament administration application with full support for multiple divisions, each with their own teams, schedules, standings, and playoff brackets.

## Features

- **Multi-Division Support**: Create multiple divisions (e.g., Div 1, Div 2, Pro, Amateur)
- **Per-Division Settings**: Each division has its own format, teams, and rules
- **Flexible Formats**: Group stage, Single/Double-Elimination, Multi-Tier Playoffs
- **Enhanced Team Import**: Multiple format support (CSV, natural format with flags 🇸🇪, simple text)
  - Validation and duplicate detection
  - Preview before import with conflict resolution
- **Schedule Generation**: Auto-generate group stage or add matches manually
  - Multi-tier support: dynamic round selection per playoff tier
  - Drag-and-drop round reordering
- **Discord Integration**: Submit match results via Discord bot
- **Results Import**: Fetch from API, Discord submissions, or JSON files
- **Auto Standings**: Calculated automatically with configurable tie-breakers
- **Playoff Brackets**: Visual bracket with auto-updating scores (single/double/multi-tier)
- **Wiki Export**: Generate MediaWiki markup for each division
- **Save/Load**: Full tournament backup and restore

## Structure

```
Tournament
├── Name, Mode, Dates
├── Division 1
│   ├── Format Settings (groups, playoffs, points)
│   ├── Teams
│   ├── Schedule
│   ├── Standings (auto-calculated)
│   ├── Bracket
│   └── Wiki Export
├── Division 2
│   └── ... (own teams, schedule, etc.)
└── Division 3...
```

## Workflow

1. **Tournament Info** → Set tournament name, mode, dates
2. **Create Divisions** → Add divisions with their own format settings
3. **For each Division**:
   - **Setup** → Configure groups, playoff format, points system
   - **Teams** → Add teams (single or bulk)
   - **Schedule** → Generate or manually add matches
   - **Results** → Import game results
   - **Standings** → View auto-calculated tables
   - **Bracket** → Configure playoff bracket
   - **Wiki** → Export to MediaWiki format

## Setup

```bash
npm install
npm run dev
```

## Project Structure

```
src/
├── App.jsx                    # Main app with division state
├── components/
│   ├── Header.jsx             # Navigation with division dropdown
│   ├── TournamentInfo.jsx     # Basic tournament info
│   ├── DivisionManager.jsx    # Create/manage divisions
│   ├── DivisionView.jsx       # Division sub-tab container
│   ├── DataManager.jsx        # Save/Load/Reset
│   └── division/
│       ├── DivisionSetup.jsx      # Format & rules
│       ├── DivisionTeams.jsx      # Team management
│       ├── DivisionSchedule.jsx   # Match schedule
│       ├── DivisionResults.jsx    # Import results
│       ├── DivisionStandings.jsx  # Group tables
│       ├── DivisionBracket.jsx    # Playoff bracket
│       └── DivisionWiki.jsx       # Wiki export
├── utils/
│   ├── matchLogic.js          # Match parsing & standings
│   ├── teamImport.js          # Team import with validation
│   ├── wikiExport.js          # MediaWiki generation
│   └── statsLogic.js          # QuakeWorld stats
└── hooks/
    └── useLocalStorage.js
```

## Format Settings Per Division

**Group Stage:**
- Number of groups
- Teams per group
- Series format (Bo1/3/5/7)
- Teams advancing to playoffs
- Points for Win/Draw/Loss

**Playoffs:**
- Quarter Finals format
- Semi Finals format
- Grand Final format
- 3rd Place match (optional)

## API Integration

For API fetching, your proxy should provide:
```
GET /api/game/:gameId
```

Returning:
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

## Team Import Formats

The enhanced team import system supports multiple input formats:

**CSV Format:**
```
Team Name, TAG, country, Group, players
Slackers, SLK, se, A, ParadokS Zero grisling Phrenic
```

**Natural Format (with flag emojis):**
```
Slackers [SLK] 🇸🇪 - ParadokS, Zero, grisling, Phrenic
Hell Xpress (hx) 🇸🇪: Splash, ok98, Shaka, mm
```

**Simple Format:**
```
Team Name
```

Features:
- Automatic tag generation from team name
- Flag emoji to country code conversion (🇸🇪 → se)
- Validation with error/warning reporting
- Duplicate detection (within import and against existing teams)
- Preview with conflict resolution options

## Tech Stack

- React 18 + Vite 5
- Tailwind CSS 3.4
- ES Modules (package.json `"type": "module"`)
- PostCSS + Autoprefixer
- localStorage persistence

## License

MIT
