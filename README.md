# QW Tournament Admin - Wiki Generator

A QuakeWorld tournament administration tool that fetches tournament data from a Google Sheets API and generates Liquipedia-compatible MediaWiki markup.

## Features

- **Live Data Fetching**: Pulls tournament data from Google Sheets via Apps Script API
- **Standings View**: Display team standings with wins, losses, map differential
- **Schedule View**: Group stage and playoff match schedules with detailed map scores
- **Player Statistics**: Individual player performance metrics
- **Team Management**: View team rosters and information
- **Wiki Export**: Generate professional MediaWiki markup for:
  - Standings tables (GroupTableStart format)
  - Match lists (MatchMaps format)
  - Playoff brackets (4SE, 8SE, 16SE, 32SE bracket templates)
  - Player statistics tables
  - Combined full tournament pages

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure API URL**:
   Copy `.env.example` to `.env` and set your Google Apps Script URL:
   ```
   VITE_API_BASE_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

## API Endpoints

The Google Apps Script API should provide these endpoints via query parameter `?endpoint=`:

- `standings` - Team standings array
- `players` - Player statistics array
- `groupGames` - Group stage matches
- `playoffGames` - Playoff matches
- `teams` - Team information
- `scheduleConfig` - Schedule configuration

### Expected Data Formats

**Standings**:
```json
[
  { "#": 1, "Team": "TeamName", "Games": "3-0", "Maps": "9-2", "Diff": "+7" }
]
```

**Players**:
```json
[
  { "Rank": 1, "Player": "PlayerName", "Maps Played": 12, "Avg Frags": 45.5, "Win Rate": 0.75, "Avg Eff": 0.65, "Avg Dmg": 5200 }
]
```

**Games (Group/Playoff)**:
```json
[
  {
    "round": "Quarter Final",
    "teamA": "Team1",
    "teamB": "Team2", 
    "mapsWonA": "2",
    "mapsWonB": "1",
    "played": 1,
    "date": "2024-01-15",
    "maps": [
      { "mapName": "dm2", "teamAFrags": 150, "teamBFrags": 120, "gameUrl": "https://..." }
    ]
  }
]
```

**Teams**:
```json
[
  { "Team Name": "Full Team Name", "Team Tag": "TAG", "Players": "player1, player2, player3" }
]
```

## Wiki Export Templates

The wiki generator outputs code compatible with Liquipedia's QuakeWorld templates:

- `{{GroupTableStart}}` / `{{GroupTableSlot}}` / `{{GroupTableEnd}}`
- `{{MatchList}}` / `{{MatchMaps}}`
- `{{4SEBracket}}`, `{{8SEBracket}}`, `{{16SEBracket}}`, `{{32SEBracket}}`
- `{{BracketMatchSummary}}`
- `{{TeamAbbr}}`, `{{Abbr}}`

## Project Structure

```
src/
├── components/
│   ├── division/
│   │   └── DivisionWiki.jsx    # Main wiki generator
│   ├── Header.jsx
│   ├── StandingsView.jsx
│   ├── ScheduleView.jsx
│   ├── PlayersView.jsx
│   ├── TeamsView.jsx
│   ├── WikiExport.jsx
│   ├── LoadingSpinner.jsx
│   └── ErrorMessage.jsx
├── hooks/
│   └── useTournamentData.js    # Data fetching hooks
├── services/
│   ├── api.js                  # API client
│   └── dataTransformer.js      # Data transformation layer
├── utils/
│   ├── matchLogic.js           # Match parsing utilities
│   ├── statsLogic.js           # Statistics calculation
│   └── wikiExport.js           # Wiki generation helpers
├── App.jsx
├── main.jsx
└── index.css
```

## Customization

### Changing the API Source

To use a different data source, modify `src/services/api.js` to match your API structure, then update `src/services/dataTransformer.js` to transform the data into the expected division format.

### Modifying Wiki Output

The main wiki generation logic is in `src/components/division/DivisionWiki.jsx`. This file contains generators for:
- Standings tables
- Match lists
- Brackets (4, 8, 16, 32 team single elimination)
- Double elimination brackets

## Credits

Built for the QuakeWorld community. Wiki templates designed for Liquipedia compatibility.
