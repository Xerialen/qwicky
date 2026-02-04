# QuakeWorld Tournament Admin

A React-based tournament administration application with full support for multiple divisions, each with their own teams, schedules, standings, and playoff brackets.

## Features

- **Multi-Division Support**: Create multiple divisions (e.g., Div 1, Div 2, Pro, Amateur)
- **Per-Division Settings**: Each division has its own format, teams, and rules
- **Flexible Formats**: Group stage Bo1/3/5/7, separate playoff formats (QF/SF/Final)
- **Team Management**: Add teams individually or bulk import
- **Schedule Generation**: Auto-generate group stage or add matches manually
- **Results Import**: Fetch from API or import JSON files
- **Auto Standings**: Calculated automatically from results
- **Playoff Brackets**: Visual bracket with auto-updating scores
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
│   └── matchLogic.js          # Parsing utilities
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

## Tech Stack

- React 18 + Vite
- Tailwind CSS
- localStorage persistence

## License

MIT
