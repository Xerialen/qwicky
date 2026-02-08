# Caster View Implementation Guide

## Overview

This document provides a complete implementation guide for the Caster View feature in QWICKY. The feature provides tournament casters with intelligent match analysis based on common opponent performance, recent form, map statistics, and player performance trends.

## Feature Scope

### Core Capabilities

1. **Common Opponents Analysis** - Shows how each team performed against shared opponents, revealing patterns and advantages
2. **Recent Form & Momentum** - Tracks last 5 maps, win streaks, and performance trends
3. **Map Performance** - Win rates and scoring patterns per map
4. **Player Spotlight** - Identifies hot/cold players based on K/D ratio and recent performance
5. **Auto-Generated Insights** - Talking points for casters based on statistical analysis
6. **Previous Meetings** - Compact display of direct matchups (if any exist)

### UI Modes

- **Full View** - Comprehensive analysis for pre-match preparation
- **Overlay Mode** (optional Phase 2) - Clean, stream-ready display with key stats only

## Architecture

### Data Flow

```
division.rawMaps (ktxstats data)
    ↓
casterStats.js utility functions
    ↓ (calculate)
- Common opponent performance
- Recent form analysis  
- Map statistics
- Player performance
    ↓
DivisionCasterView.jsx component
    ↓ (render)
Caster-friendly UI with insights
```

### File Structure

```
src/
├── utils/
│   └── casterStats.js          # NEW - All statistical calculations
├── components/
│   └── division/
│       └── DivisionCasterView.jsx  # NEW - Main component
└── App.jsx                     # Modified - Add caster view to division tabs
```

## Implementation Plan

### Phase 1: Core Statistics (Days 1-2)

**File:** `src/utils/casterStats.js`

Create utility functions for all statistical calculations:

#### 1.1 Common Opponents Analysis

```javascript
/**
 * Find teams that both team1 and team2 have faced
 * @returns {string[]} Array of normalized team names
 */
export const findCommonOpponents = (team1, team2, rawMaps) => {
  // 1. Get all opponents for team1
  // 2. Get all opponents for team2
  // 3. Return intersection (exclude each other)
}

/**
 * Calculate performance metrics vs a specific opponent
 * @returns {Object} wins, losses, mapDiff, fragDiff, avgScore, dominance
 */
export const getPerformanceVsOpponent = (team, opponent, rawMaps) => {
  // 1. Filter maps where team played opponent
  // 2. Calculate wins/losses/draws
  // 3. Calculate frag differentials
  // 4. Return aggregated stats
}

/**
 * Full common opponent analysis with advantage detection
 * @returns {Object} breakdown array + summary with patterns
 */
export const analyzeCommonOpponents = (team1, team2, rawMaps) => {
  // 1. Get common opponents
  // 2. For each opponent, get both teams' performance
  // 3. Determine who had advantage (>15% dominance difference)
  // 4. Calculate aggregate stats (avg dominance, consistency)
  // 5. Return structured analysis
}
```

**Key Logic:**
- Use case-insensitive team matching (via `normalizeTeam` helper)
- Weight by significance (number of maps played)
- Consistency = 1 - standard deviation of win rates
- Advantage threshold = 15% dominance difference

#### 1.2 Recent Form Analysis

```javascript
/**
 * Analyze last N maps for momentum and trends
 * @param {number} lastN - Number of recent maps to analyze (default 5)
 * @returns {Object} record, streak, momentum, trend, map results
 */
export const analyzeRecentForm = (team, rawMaps, lastN = 5) => {
  // 1. Get all maps for team, sorted by date
  // 2. Take last N maps
  // 3. Calculate W-L-D record
  // 4. Detect current streak (wins/losses)
  // 5. Calculate weighted momentum (recent = higher weight)
  // 6. Determine trend (rising/falling/stable) by comparing first half vs second half
  // 7. Return structured form data
}
```

**Momentum Calculation:**
```javascript
// Weight recent maps more heavily
// Map 1: 0.2, Map 2: 0.4, Map 3: 0.6, Map 4: 0.8, Map 5: 1.0
momentum = Σ(result_value × weight) / Σ(weights)
// where result_value = 1 (win), 0 (loss), 0.5 (draw)
```

**Trend Detection:**
- Rising: 2nd half wins > 1st half wins + 1
- Falling: 2nd half wins < 1st half wins - 1
- Stable: Otherwise

#### 1.3 Map Statistics (Reuse Existing)

```javascript
/**
 * Already exists in codebase - calculate per-map performance
 */
export const calculateMapStats = (team, rawMaps) => {
  // Return: { mapName: { wins, losses, winRate, avgScoreDiff, ... } }
}
```

#### 1.4 Player Performance (Reuse/Enhance Existing)

```javascript
/**
 * Calculate player stats across tournament
 */
export const calculatePlayerStats = (rawMaps) => {
  // For each player:
  // - mapsPlayed, totalFrags, totalDeaths
  // - kdRatio, fragsPerMap
  // - trend (hot/cold based on last 3 vs tournament avg)
}

/**
 * Identify standout performers
 */
export const getPlayerSpotlight = (playerStats, minMaps = 3) => {
  // Return top 3 K/D (hot hands) and bottom 3 (struggling)
}
```

#### 1.5 Auto-Generated Insights

```javascript
/**
 * Generate caster talking points based on statistical analysis
 * @returns {Array<Object>} Array of insight objects with type and text
 */
export const generateCasterInsights = (team1, team2, rawMaps) => {
  const insights = [];
  
  // Analyze common opponents
  // - If one team dominates common matchups, add advantage insight
  // - If consistency gap exists, add consistency insight
  
  // Analyze momentum
  // - If one team hot (>70%) and other cold (<50%), add momentum insight
  // - If win streak vs recent losses, add form insight
  
  // Check H2H
  // - If they've met, add historical context
  
  return insights;
}
```

**Insight Types:**
- `advantage` - Common opponent dominance
- `consistency` - Performance variance
- `momentum` - Hot/cold streaks
- `history` - Direct matchup context

### Phase 2: UI Component (Days 3-4)

**File:** `src/components/division/DivisionCasterView.jsx`

#### 2.1 Component Structure

```javascript
import React, { useState, useMemo } from 'react';
import {
  calculateHeadToHead,
  analyzeCommonOpponents,
  analyzeRecentForm,
  calculateMapStats,
  calculatePlayerStats,
  getPlayerSpotlight,
  generateCasterInsights
} from '../../utils/casterStats';

export default function DivisionCasterView({ division }) {
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [overlayMode, setOverlayMode] = useState(false);
  
  // Extract playoff matches from bracket
  const playoffMatches = useMemo(() => {
    const matches = [];
    
    if (!division.bracket) return matches;
    
    // Extract from single-elimination bracket
    if (division.bracket.format === 'single') {
      const { winners, thirdPlace } = division.bracket;
      
      // Flatten all rounds
      if (winners.round32) matches.push(...winners.round32);
      if (winners.round16) matches.push(...winners.round16);
      if (winners.round12) matches.push(...winners.round12);
      if (winners.quarterFinals) matches.push(...winners.quarterFinals);
      if (winners.semiFinals) matches.push(...winners.semiFinals);
      if (winners.final) matches.push(winners.final);
      if (thirdPlace) matches.push(thirdPlace);
    }
    
    // Extract from double-elimination bracket
    else if (division.bracket.format === 'double') {
      // Similar flattening for winners + losers brackets
      // ...
    }
    
    // Filter out TBD matches and add metadata
    return matches
      .filter(m => m.team1 && m.team2)
      .map(m => ({
        ...m,
        id: m.id || `${m.team1}-${m.team2}`,
        maps: extractMapPool(m, division) // Helper to get Bo3/5/7 map pool
      }));
  }, [division.bracket]);
  
  // Calculate stats only when match selected
  const matchStats = useMemo(() => {
    if (!selectedMatch) return null;
    
    const { team1, team2 } = selectedMatch;
    
    return {
      commonOpp: analyzeCommonOpponents(team1, team2, division.rawMaps || []),
      team1Form: analyzeRecentForm(team1, division.rawMaps || []),
      team2Form: analyzeRecentForm(team2, division.rawMaps || []),
      team1MapStats: calculateMapStats(team1, division.rawMaps || []),
      team2MapStats: calculateMapStats(team2, division.rawMaps || []),
      h2h: calculateHeadToHead(team1, team2, division.rawMaps || []),
      insights: generateCasterInsights(team1, team2, division.rawMaps || [])
    };
  }, [selectedMatch, division.rawMaps]);
  
  // Calculate player stats once for entire division
  const allPlayerStats = useMemo(() => 
    calculatePlayerStats(division.rawMaps || []),
    [division.rawMaps]
  );
  
  const spotlight = useMemo(() => {
    if (!selectedMatch) return null;
    
    const all = getPlayerSpotlight(allPlayerStats);
    
    // Filter for current matchup teams
    return {
      hotHands: all.hotHands.filter(p => 
        p.team === selectedMatch.team1 || p.team === selectedMatch.team2
      ),
      struggling: all.struggling.filter(p => 
        p.team === selectedMatch.team1 || p.team === selectedMatch.team2
      )
    };
  }, [selectedMatch, allPlayerStats]);
  
  // Render match selector if no match selected
  if (!selectedMatch) {
    return <MatchSelector matches={playoffMatches} onSelect={setSelectedMatch} />;
  }
  
  // Render full analysis
  return (
    <div className={overlayMode ? 'overlay-mode' : ''}>
      <Header 
        match={selectedMatch}
        onBack={() => setSelectedMatch(null)}
        overlayMode={overlayMode}
        onToggleOverlay={() => setOverlayMode(!overlayMode)}
      />
      
      <CommonOpponentsSection data={matchStats.commonOpp} />
      <RecentFormSection team1={matchStats.team1Form} team2={matchStats.team2Form} />
      <MapPerformanceSection 
        team1Stats={matchStats.team1MapStats}
        team2Stats={matchStats.team2MapStats}
        mapPool={selectedMatch.maps}
      />
      <PlayerSpotlightSection spotlight={spotlight} />
      <CasterInsightsSection insights={matchStats.insights} />
      <PreviousMeetingsSection h2h={matchStats.h2h} />
    </div>
  );
}
```

#### 2.2 Sub-Components

Break down into smaller, focused components:

**MatchSelector.jsx**
```javascript
const MatchSelector = ({ matches, onSelect }) => (
  <div className="qw-panel p-6">
    <h2 className="text-xl font-bold text-qw-accent mb-4">Caster View</h2>
    <p className="text-qw-muted mb-6">
      Select a playoff match to view detailed statistics and insights
    </p>
    
    <div className="space-y-2">
      {matches.map(match => (
        <button
          key={match.id}
          onClick={() => onSelect(match)}
          className="w-full qw-btn-secondary text-left p-4 hover:bg-qw-accent/10"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">
              {match.team1} vs {match.team2}
            </span>
            <span className="text-sm text-qw-muted">{match.round}</span>
          </div>
        </button>
      ))}
    </div>
  </div>
);
```

**CommonOpponentsSection.jsx**
```javascript
const CommonOpponentsSection = ({ data }) => {
  if (!data || data.breakdown.length === 0) return null;
  
  return (
    <div className="qw-panel p-6 mb-6">
      <h2 className="text-xl font-bold mb-4 text-qw-accent">
        🎯 Common Opponents Analysis
      </h2>
      
      <p className="text-qw-muted mb-6">
        Both teams have faced {data.breakdown.length} common opponents
      </p>
      
      {/* For each common opponent */}
      <div className="space-y-4">
        {data.breakdown.map(({ opponent, team1Result, team2Result, advantage }) => (
          <OpponentComparison
            key={opponent}
            opponent={opponent}
            team1Result={team1Result}
            team2Result={team2Result}
            advantage={advantage}
          />
        ))}
      </div>
      
      {/* Summary box */}
      <PatternSummary summary={data.summary} />
    </div>
  );
};
```

**OpponentComparison.jsx**
```javascript
const OpponentComparison = ({ opponent, team1Result, team2Result, advantage }) => (
  <div className="border border-gray-700 rounded-lg p-4">
    <h3 className="font-bold mb-3">vs {opponent}</h3>
    
    <div className="grid grid-cols-2 gap-4">
      {/* Team 1 side */}
      <div className={`p-3 rounded ${
        advantage === 'team1' 
          ? 'bg-qw-win/10 border border-qw-win/30' 
          : 'bg-black/20'
      }`}>
        <div className="font-semibold mb-2">Team 1</div>
        <div className="text-sm space-y-1">
          <div className="font-bold">
            {team1Result.wins}-{team1Result.losses}
          </div>
          <div className="text-qw-muted">
            {team1Result.fragDiff > 0 ? '+' : ''}{team1Result.fragDiff} frags
          </div>
          <div className="text-qw-muted">
            {team1Result.avgScore} avg score
          </div>
        </div>
        {advantage === 'team1' && (
          <div className="mt-2 text-xs text-qw-win">✓ Advantage</div>
        )}
      </div>
      
      {/* Team 2 side - mirror structure */}
      {/* ... */}
    </div>
  </div>
);
```

**RecentFormSection.jsx**
```javascript
const RecentFormSection = ({ team1, team2 }) => (
  <div className="qw-panel p-6 mb-6">
    <h2 className="text-xl font-bold mb-4 text-qw-accent">
      🔥 Recent Form & Momentum
    </h2>
    
    {/* Team 1 Form */}
    <TeamFormDisplay form={team1} />
    
    {/* Team 2 Form */}
    <TeamFormDisplay form={team2} />
  </div>
);

const TeamFormDisplay = ({ form }) => (
  <div className="mb-6">
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-bold">{form.team}</h3>
      <div className="flex items-center gap-4">
        <span className="text-sm">Last 5: {form.record}</span>
        {form.winStreak > 0 && (
          <span className="text-qw-win text-sm">
            Win streak: {form.winStreak}
          </span>
        )}
        <span className="text-2xl">
          {form.trend === 'rising' ? '↗' : 
           form.trend === 'falling' ? '↘' : '→'}
        </span>
      </div>
    </div>
    
    {/* 5 recent maps as cards */}
    <div className="grid grid-cols-5 gap-2">
      {form.last5Maps.map((m, idx) => (
        <MapResultCard key={idx} result={m} />
      ))}
    </div>
    
    <p className="text-sm text-qw-muted mt-2">
      Momentum: {getMomentumLabel(form.momentum)} ({form.trend} trend)
    </p>
  </div>
);
```

**CasterInsightsSection.jsx**
```javascript
const CasterInsightsSection = ({ insights }) => {
  if (!insights || insights.length === 0) return null;
  
  return (
    <div className="qw-panel p-6 mb-6 bg-qw-accent/5 border-2 border-qw-accent/30">
      <h2 className="text-xl font-bold mb-4 text-qw-accent">
        💡 Key Talking Points
      </h2>
      
      <div className="space-y-3">
        {insights.map((insight, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <span className="text-qw-accent text-xl flex-shrink-0">•</span>
            <p className="text-sm leading-relaxed">{insight.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Phase 3: Integration (Day 5)

#### 3.1 Add Tab to DivisionView

**File:** `src/components/DivisionView.jsx`

```javascript
const subTabs = [
  { id: 'setup', label: 'Setup' },
  { id: 'teams', label: 'Teams' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'results', label: 'Results' },
  { id: 'standings', label: 'Standings' },
  { id: 'bracket', label: 'Bracket' },
  { id: 'stats', label: 'Stats' },
  { id: 'caster', label: 'Caster View' },  // NEW
  { id: 'wiki', label: 'Wiki' }
];

// In renderSubContent switch:
case 'caster':
  return <DivisionCasterView division={division} />;
```

#### 3.2 Helper Utilities

**Add to `casterStats.js`:**

```javascript
/**
 * Normalize team name for case-insensitive matching
 */
export const normalizeTeam = (teamName) => {
  if (!teamName) return '';
  return teamName.toString().toLowerCase().trim();
};

/**
 * Extract map pool from bracket match based on Bo setting
 */
export const extractMapPool = (match, division) => {
  // Look up bestOf setting for this round
  const bestOf = match.bestOf || division.playoffFinalBestOf || 3;
  
  // Return expected number of maps
  // This is a placeholder - actual implementation depends on
  // how map pools are configured in division setup
  return [];
};

/**
 * Get momentum label from score
 */
export const getMomentumLabel = (momentum) => {
  if (momentum > 0.7) return 'Strong';
  if (momentum > 0.5) return 'Moderate';
  return 'Weak';
};
```

### Phase 4: Testing & Polish (Day 6)

#### 4.1 Test Cases

Create test scenarios with sample data:

1. **Two teams with multiple common opponents**
   - Verify advantage detection
   - Check consistency calculations
   - Validate pattern summary

2. **Teams with recent form variance**
   - Rising trend team vs falling trend team
   - Win streak detection
   - Momentum calculation accuracy

3. **Edge cases**
   - No common opponents (new teams)
   - Only 1-2 maps played
   - Teams that haven't met
   - Missing player data

4. **Visual validation**
   - All stats display correctly
   - Colors convey meaning (green=advantage, red=disadvantage)
   - Responsive layout works on different screen sizes

#### 4.2 Polish Checklist

- [ ] Add loading states for calculations
- [ ] Handle empty data gracefully (show helpful messages)
- [ ] Add tooltips to explain metrics (e.g., "dominance = win rate")
- [ ] Ensure consistent number formatting (1 decimal for averages, 0 for counts)
- [ ] Test with real tournament data from past events
- [ ] Validate all normalizeTeam calls for case-insensitive matching
- [ ] Add print-friendly CSS (optional)

## Optional Enhancements (Phase 5)

### Overlay Mode

Add clean, stream-ready view:

**CSS:** `src/index.css`

```css
.overlay-mode {
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  padding: 2rem;
  max-width: 900px;
  margin: 0 auto;
}

.overlay-mode .qw-panel {
  background: rgba(30, 30, 46, 0.7);
  border: 1px solid rgba(255, 179, 0, 0.4);
}

.overlay-mode h2 {
  font-size: 1.25rem;
}

.overlay-mode .text-sm {
  font-size: 0.875rem;
}
```

**Component changes:**
- Hide detailed breakdowns in overlay mode
- Show only summary stats
- Larger fonts for readability
- Minimal chrome (no back button, no extra borders)

### Export to Image/PDF

Use html2canvas or similar:

```javascript
const exportAsImage = async () => {
  const element = document.getElementById('caster-view-content');
  const canvas = await html2canvas(element);
  const image = canvas.toDataURL('image/png');
  
  // Trigger download
  const link = document.createElement('a');
  link.download = `caster-view-${team1}-vs-${team2}.png`;
  link.href = image;
  link.click();
};
```

### Match Prediction Algorithm

Enhanced prediction using:
- Common opponent performance (40% weight)
- Map pool matchup (30% weight)
- Recent momentum (20% weight)
- Direct H2H if exists (10% weight)

```javascript
export const predictMatchup = (team1, team2, rawMaps, mapPool) => {
  const commonOpp = analyzeCommonOpponents(team1, team2, rawMaps);
  const team1Form = analyzeRecentForm(team1, rawMaps);
  const team2Form = analyzeRecentForm(team2, rawMaps);
  const h2h = calculateHeadToHead(team1, team2, rawMaps);
  
  // Weight factors
  const weights = {
    commonOpp: 0.4,
    maps: 0.3,
    momentum: 0.2,
    h2h: 0.1
  };
  
  // Calculate component scores (0-1 range)
  const scores = {
    commonOpp: commonOpp.summary.team1AvgDominance / 
               (commonOpp.summary.team1AvgDominance + commonOpp.summary.team2AvgDominance),
    maps: calculateMapPoolAdvantage(team1, team2, mapPool, rawMaps),
    momentum: team1Form.momentum / (team1Form.momentum + team2Form.momentum),
    h2h: h2h.totalMaps > 0 
      ? h2h.team1Wins / (h2h.team1Wins + h2h.team2Wins)
      : 0.5
  };
  
  // Weighted average
  const team1Probability = Object.keys(weights).reduce((sum, key) => 
    sum + (scores[key] * weights[key]), 0
  );
  
  return {
    team1Probability,
    team2Probability: 1 - team1Probability,
    confidence: getConfidenceLevel(commonOpp, h2h),
    breakdown: scores
  };
};
```

## Data Requirements

### Existing Data Structures Used

All calculations rely on `division.rawMaps`:

```javascript
{
  gameId: "12345",
  date: "2024-01-15 20:00:00",
  map: "dm3",
  mode: "4on4",
  team1: "Slackers",
  team2: "Fusion",
  score1: 150,
  score2: 120,
  players: [
    {
      name: "Milton",
      team: "Slackers",
      stats: {
        frags: 45,
        deaths: 32,
        // ... other ktxstats
      }
    }
    // ... more players
  ]
}
```

**No schema changes required** - all data already exists in current QWICKY structure.

## Testing Data

For development, create fixture data:

```javascript
// test/fixtures/casterViewData.js
export const mockTournamentData = {
  rawMaps: [
    // Group stage games
    {
      gameId: "1",
      date: "2024-02-01 20:00:00",
      map: "dm3",
      team1: "Slackers",
      team2: "The Viper Squad",
      score1: 155,
      score2: 140,
      players: [/* ... */]
    },
    {
      gameId: "2",
      date: "2024-02-01 21:00:00",
      map: "dm2",
      team1: "Fusion",
      team2: "The Viper Squad",
      score1: 142,
      score2: 158,
      players: [/* ... */]
    },
    // ... 20+ more games to create patterns
  ]
};
```

Use in development:
```javascript
// In DivisionCasterView.jsx during testing
const rawMaps = division.rawMaps || mockTournamentData.rawMaps;
```

## Success Criteria

The feature is complete when:

1. ✅ Casters can select any playoff match
2. ✅ Common opponents analysis shows all shared matchups with advantage indicators
3. ✅ Recent form displays last 5 maps with visual win/loss indicators
4. ✅ Momentum and trends are calculated accurately
5. ✅ Map statistics show win rates and scoring patterns
6. ✅ Player spotlight identifies top 3 hot/cold players
7. ✅ Auto-generated insights provide 3-5 relevant talking points
8. ✅ Previous meetings section shows direct H2H (if exists)
9. ✅ All calculations handle edge cases (no data, missing teams, etc.)
10. ✅ UI is visually clear and uses QWICKY's dark mode theme

## Implementation Notes

### Case-Insensitive Matching

**CRITICAL:** All team name comparisons must use `normalizeTeam()`:

```javascript
// WRONG
if (m.team1 === team1) { ... }

// CORRECT
if (normalizeTeam(m.team1) === normalizeTeam(team1)) { ... }
```

This ensures "Slackers" matches "slackers" and "SLACKERS".

### Performance Optimization

Use `useMemo` aggressively:
- Calculate stats only when match changes
- Don't recalculate player stats for every match
- Cache common opponent lookups

### Error Handling

Always provide fallbacks:

```javascript
const commonOpp = analyzeCommonOpponents(team1, team2, rawMaps || []);

if (!commonOpp || commonOpp.breakdown.length === 0) {
  return <NoCommonOpponentsMessage />;
}
```

### Styling Consistency

Follow QWICKY conventions:
- `qw-panel` for card containers
- `qw-accent` for highlights (#FFB300)
- `qw-win` for positive indicators (#00FF88)
- `qw-loss` for negative indicators (#FF3366)
- `qw-muted` for secondary text

## Development Workflow

1. **Branch:** `feature/caster-view`
2. **Commits:**
   - `feat: add caster stats utility functions`
   - `feat: add common opponents analysis`
   - `feat: add recent form tracking`
   - `feat: add caster view component`
   - `feat: integrate caster view into division tabs`
   - `test: add caster view test fixtures`
   - `polish: improve caster view styling`

3. **Testing:**
   - Use real tournament data from past QW events
   - Test with 4-team, 8-team, and 16-team brackets
   - Verify on different screen sizes

4. **Review checklist:**
   - All calculations tested with edge cases
   - No console errors/warnings
   - Responsive on mobile
   - Follows existing code patterns
   - Uses QWICKY color scheme
   - No hard-coded team names in logic

## Estimated Timeline

- **Day 1-2:** Implement `casterStats.js` utilities
- **Day 3-4:** Build `DivisionCasterView` component and sub-components
- **Day 5:** Integration, testing, bug fixes
- **Day 6:** Polish UI, handle edge cases, documentation

**Total: 6 days**

## Future Enhancements

Ideas for post-MVP:

1. **Historical comparison** - "Team X performing 20% better than Season 1"
2. **Live updates** - Real-time stats during match (requires live scoring)
3. **Voice script generator** - AI-generated caster commentary
4. **Favorite matchups** - Save/bookmark key matches for quick access
5. **Multi-language support** - Caster view in Swedish/Finnish/etc.
6. **Advanced predictions** - ML-based win probability
7. **Player vs player** - Individual duels analysis (Milton vs Sniper on dm3)

## Questions for Clarification

Before starting implementation:

1. Should caster view be available for group stage matches, or playoffs only?
2. What's the minimum number of maps played before showing stats? (Currently set to 3)
3. Should we include "tie" games in calculations, or only count wins/losses?
4. For overlay mode, do you want it to be a separate URL/route for OBS Browser Source?
5. Any specific color schemes for stream overlays (team colors, etc.)?

---

**Ready to implement?** Start with Phase 1 (caster stats utilities) and test thoroughly before moving to UI. The math is the hard part - the UI is just presentation.
