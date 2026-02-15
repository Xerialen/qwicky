# Qwicky UX Audit Report

## Part 1: Executive UX Summary

Qwicky is a power-user tool built by a domain expert for domain experts. The architecture is sound — localStorage persistence, flat division model, and the multi-tier playoff system show thoughtful engineering. However, the UX carries the marks of feature-driven development: capabilities were added as needed without a unified interaction design pass. The result is a tool that *works* but demands tribal knowledge to operate efficiently.

**Top 3 Critical Bottlenecks:**

1. **No progressive disclosure — everything is visible at once.** DivisionSetup presents every possible configuration field simultaneously regardless of the selected format. A user creating a simple single-elimination bracket still sees group stage fields, multi-tier options, and tie-breaker configuration. This violates the "recognition rather than recall" heuristic and creates decision paralysis.

2. **The workflow is implicit, not guided.** The tab system (Info → Divisions → Setup → Teams → Schedule → Results → Standings → Bracket → Wiki) represents a sequential workflow, but there's zero indication of progress, completion state, or what's required before the next step works. A user can jump to Wiki export before adding any teams and get a blank output with no explanation.

3. **Bulk operations lack feedback and confidence.** The Discord submission flow (approve/bulk approve/reprocess) performs multiple async operations with no visible progress, no undo, and the documented concern about stale closures suggests the UI can silently fail. The team import preview is better designed but still dumps users into a modal with no clear escape hatch if the parsed results look wrong.

---

## Part 2: Quick Wins (Immediate Action Items)

### 1. Conditional Field Visibility in DivisionSetup

**Location:** `DivisionSetup.jsx`

**The Issue:** All format-specific fields render regardless of the selected `division.format`. A user picking "single-elim" sees group stage settings (numGroups, teamsPerGroup, groupMeetings, matchPace) that are irrelevant to them. This is the single biggest source of cognitive overload.

**The Fix:** Wrap field sections in conditional renders based on `division.format`. Group fields only for `"groups"` and `"multi-tier"`. Tier config only for `"multi-tier"`. Playoff bracket settings only when a playoff phase exists.

**Code Implementation:**

```jsx
// In DivisionSetup.jsx, wrap the group-stage settings section:

{(division.format === 'groups' || division.format === 'multi-tier') && (
  <section className="qw-panel p-4 space-y-4">
    <h3 className="text-sm font-semibold text-qw-accent uppercase tracking-wide">
      Group Stage Settings
    </h3>
    {/* numGroups, teamsPerGroup, groupMeetings, matchPace, etc. */}
  </section>
)}

{(division.format === 'single-elim' || division.format === 'double-elim' || 
  division.format === 'groups') && (
  <section className="qw-panel p-4 space-y-4">
    <h3 className="text-sm font-semibold text-qw-accent uppercase tracking-wide">
      Playoff Settings
    </h3>
    {/* playoffFormat, playoffTeams, round best-of settings */}
  </section>
)}

{division.format === 'multi-tier' && (
  <section className="qw-panel p-4 space-y-4">
    <h3 className="text-sm font-semibold text-qw-accent uppercase tracking-wide">
      Tier Configuration
    </h3>
    {/* playoffTiers config */}
  </section>
)}
```

---

### 2. Workflow Progress Indicator in DivisionView

**Location:** `DivisionView.jsx`

**The Issue:** The sub-tabs are presented as equal-weight navigation items. There's no indication of which steps are complete, which are required, or what order to follow. A first-time user has no idea that "Teams" must precede "Schedule" must precede "Results."

**The Fix:** Add completion badges/dots to each sub-tab and a subtle sequential indicator. This requires no logic changes — just reading existing division state.

**Code Implementation:**

```jsx
// Add this helper above or inside DivisionView.jsx:

function getTabStatus(tabId, division) {
  switch (tabId) {
    case 'setup':
      return division.format ? 'complete' : 'empty';
    case 'teams':
      return division.teams?.length > 0 ? 'complete' : 'empty';
    case 'schedule':
      return division.schedule?.length > 0 ? 'complete' : 'empty';
    case 'results': {
      const hasResults = division.schedule?.some(m => m.maps?.length > 0);
      return hasResults ? 'complete' : 'empty';
    }
    case 'standings':
    case 'bracket':
    case 'wiki':
      return 'optional';
    default:
      return 'empty';
  }
}

// In the tab rendering loop:
const statusColors = {
  complete: 'bg-qw-win',    // #00FF88
  empty: 'bg-zinc-600',
  optional: 'bg-zinc-700'
};

{subTabs.map((tab, i) => {
  const status = getTabStatus(tab.id, division);
  return (
    <button
      key={tab.id}
      onClick={() => setActiveSubTab(tab.id)}
      className={`relative flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors
        ${activeSubTab === tab.id 
          ? 'bg-qw-accent/20 text-qw-accent' 
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
    >
      {/* Completion dot */}
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColors[status]}`} />
      {tab.label}
      {/* Step number for sequential guidance */}
      <span className="text-[10px] text-zinc-600 ml-auto">{i + 1}</span>
    </button>
  );
})}
```

---

### 3. Empty State Messaging

**Location:** `DivisionStandings.jsx`, `DivisionBracket.jsx`, `DivisionWiki.jsx`

**The Issue:** Jumping to Standings, Bracket, or Wiki before completing prerequisites shows either a blank screen or broken output. There's no guidance telling the user what they need to do first.

**The Fix:** Add contextual empty states that direct users to the prerequisite step.

**Code Implementation:**

```jsx
// Reusable empty state component — create src/components/EmptyState.jsx

export default function EmptyState({ icon, title, description, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-4xl mb-3 opacity-40">{icon}</span>
      <h3 className="text-lg font-medium text-zinc-300 mb-1">{title}</h3>
      <p className="text-sm text-zinc-500 max-w-md mb-4">{description}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="qw-btn text-sm px-4 py-2">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// Usage in DivisionStandings.jsx:
if (!division.schedule?.length) {
  return (
    <EmptyState
      icon="📊"
      title="No matches scheduled yet"
      description="Generate a schedule first, then import results. Standings will calculate automatically."
      actionLabel="Go to Schedule"
      onAction={() => onTabChange('schedule')}
    />
  );
}

// Usage in DivisionWiki.jsx:
if (!division.teams?.length) {
  return (
    <EmptyState
      icon="📝"
      title="Nothing to export yet"
      description="Add teams and match results before generating wiki markup."
      actionLabel="Go to Teams"
      onAction={() => onTabChange('teams')}
    />
  );
}
```

Note: `onTabChange` would need to be threaded down as a prop from `DivisionView.jsx` — a minimal wiring change.

---

### 4. Loading & In-Progress States for Async Operations

**Location:** `DivisionResults.jsx`

**The Issue:** The "Approve All" and "Reprocess All" buttons trigger multiple sequential API calls and data transformations with no visible feedback. The user has no idea if it's working, stuck, or failed. Per the CLAUDE.md notes on stale closures, silent failures are a real risk.

**The Fix:** Add a progress indicator during bulk operations and disable the trigger button.

**Code Implementation:**

```jsx
// Add state at the top of DivisionResults component:
const [bulkProgress, setBulkProgress] = useState(null); // { current: 0, total: 0 }

// Modify handleBulkApprove:
const handleBulkApprove = async () => {
  const pending = submissions.filter(s => s.status === 'pending');
  setBulkProgress({ current: 0, total: pending.length });
  
  const allParsedMaps = [];
  
  for (let i = 0; i < pending.length; i++) {
    try {
      const parsed = parseMatch(pending[i].game_id, pending[i].game_data);
      if (parsed) allParsedMaps.push(...parsed.maps);
      await approveSubmission(pending[i].id);
      setBulkProgress(prev => ({ ...prev, current: i + 1 }));
    } catch (err) {
      console.error(`Failed on submission ${pending[i].id}:`, err);
      // Continue processing remaining — don't break the batch
    }
  }
  
  if (allParsedMaps.length > 0) {
    addMapsInBatch(allParsedMaps); // Single call as required
  }
  
  setBulkProgress(null);
  await fetchSubmissions();
};

// In the JSX, replace the bulk approve button:
<button
  onClick={handleBulkApprove}
  disabled={bulkProgress !== null}
  className="qw-btn text-sm px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
>
  {bulkProgress 
    ? `Processing ${bulkProgress.current}/${bulkProgress.total}...`
    : `Approve All (${submissions.filter(s => s.status === 'pending').length})`
  }
</button>

{/* Optional: progress bar below the button */}
{bulkProgress && (
  <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-2 overflow-hidden">
    <div 
      className="bg-qw-accent h-full rounded-full transition-all duration-300"
      style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
    />
  </div>
)}
```

---

### 5. Destructive Action Confirmation

**Location:** `DivisionManager.jsx`, `DataManager.jsx`

**The Issue:** Deleting a division or resetting tournament data likely happens with a single click (or at most a `window.confirm`). For a tool with no server-side backup where all data lives in localStorage, accidental deletion is catastrophic.

**The Fix:** Replace `window.confirm` with an inline confirmation pattern — a two-step "click to confirm" that resets after 3 seconds.

**Code Implementation:**

```jsx
// Create src/components/DangerButton.jsx

import { useState, useEffect } from 'react';

export default function DangerButton({ label, confirmLabel, onConfirm, className = '' }) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  return (
    <button
      onClick={() => {
        if (confirming) {
          onConfirm();
          setConfirming(false);
        } else {
          setConfirming(true);
        }
      }}
      className={`px-3 py-1.5 text-sm rounded-md transition-all duration-200 ${
        confirming
          ? 'bg-red-600 text-white ring-2 ring-red-400 ring-offset-1 ring-offset-zinc-900'
          : 'bg-zinc-800 text-red-400 hover:bg-zinc-700'
      } ${className}`}
    >
      {confirming ? confirmLabel || 'Click again to confirm' : label}
    </button>
  );
}

// Usage in DivisionManager.jsx:
<DangerButton
  label="Delete Division"
  confirmLabel="Confirm Delete"
  onConfirm={() => deleteDivision(div.id)}
/>

// Usage in DataManager.jsx:
<DangerButton
  label="Reset All Data"
  confirmLabel="This will erase everything. Click to confirm."
  onConfirm={handleReset}
  className="w-full"
/>
```

---

### 6. Drag-and-Drop Affordance in Schedule

**Location:** `DivisionSchedule.jsx`

**The Issue:** Per CLAUDE.md, matches support drag-and-drop reordering between rounds, but there's no visual indication that items are draggable. Users must discover this by accident. The HTML5 DnD API also provides no native visual cue on touch devices.

**The Fix:** Add a grip handle icon and a subtle hover/focus state to draggable match rows.

**Code Implementation:**

```jsx
// Inside the match row component in DivisionSchedule.jsx:

<div
  draggable
  onDragStart={handleDragStart}
  onDragOver={handleDragOver}
  onDrop={handleDrop}
  className="group flex items-center gap-2 p-2 rounded-md bg-zinc-800/50 
             hover:bg-zinc-800 cursor-grab active:cursor-grabbing 
             transition-colors duration-150"
>
  {/* Drag handle */}
  <span className="flex-shrink-0 text-zinc-600 group-hover:text-zinc-400 transition-colors"
        title="Drag to reorder between rounds">
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <circle cx="3" cy="2" r="1.2"/>
      <circle cx="9" cy="2" r="1.2"/>
      <circle cx="3" cy="6" r="1.2"/>
      <circle cx="9" cy="6" r="1.2"/>
      <circle cx="3" cy="10" r="1.2"/>
      <circle cx="9" cy="10" r="1.2"/>
    </svg>
  </span>
  
  {/* Rest of match row content */}
  {/* ... */}
</div>
```

Add a CSS class for the drop target highlight:

```css
/* In index.css */
.drop-target-active {
  outline: 2px dashed #FFB300;
  outline-offset: -2px;
  background-color: rgba(255, 179, 0, 0.05);
}
```

---

### 7. Wiki Export Preview with Copy Feedback

**Location:** `DivisionWiki.jsx`

**The Issue:** The wiki export is the terminal deliverable of the entire workflow — yet copying 1000+ lines of MediaWiki markup likely relies on a basic textarea with no "copied!" confirmation. Users can't verify what they're copying without reading raw wikitext.

**The Fix:** Add a copy-to-clipboard button with visual confirmation, and a character/line count for confidence.

**Code Implementation:**

```jsx
// In DivisionWiki.jsx, around the output textarea:

const [copied, setCopied] = useState(false);

const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(wikiOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch {
    // Fallback for older browsers
    textareaRef.current?.select();
    document.execCommand('copy');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
};

// JSX:
<div className="relative">
  <div className="flex items-center justify-between mb-2">
    <span className="text-xs text-zinc-500">
      {wikiOutput.split('\n').length} lines · {wikiOutput.length.toLocaleString()} characters
    </span>
    <button
      onClick={handleCopy}
      className={`text-xs px-3 py-1 rounded transition-all duration-200 ${
        copied
          ? 'bg-qw-win/20 text-qw-win'
          : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
      }`}
    >
      {copied ? '✓ Copied!' : 'Copy to Clipboard'}
    </button>
  </div>
  <textarea
    ref={textareaRef}
    readOnly
    value={wikiOutput}
    className="w-full h-96 bg-zinc-900 text-zinc-300 text-xs font-mono p-3 
               rounded-lg border border-zinc-800 resize-y"
  />
</div>
```

---

### 8. Format Selection with Visual Cards

**Location:** `DivisionSetup.jsx`

**The Issue:** The format selector (`"groups"`, `"single-elim"`, `"double-elim"`, `"multi-tier"`) is likely a standard `<select>` dropdown. These four options are the most consequential choice in the entire setup flow, and they deserve more visual weight and explanation.

**The Fix:** Replace the dropdown with card-style radio buttons that include a brief description.

**Code Implementation:**

```jsx
const FORMAT_OPTIONS = [
  { 
    value: 'groups', 
    label: 'Group Stage + Playoffs',
    desc: 'Round-robin groups → elimination bracket',
    icon: '🏆'
  },
  { 
    value: 'single-elim', 
    label: 'Single Elimination',
    desc: 'One loss and you\'re out',
    icon: '⚡'
  },
  { 
    value: 'double-elim', 
    label: 'Double Elimination',
    desc: 'Winners & losers brackets',
    icon: '🔄'
  },
  { 
    value: 'multi-tier', 
    label: 'Multi-Tier Playoffs',
    desc: 'Gold/Silver/Bronze brackets from group standings',
    icon: '🥇'
  }
];

// Replace the <select> with:
<div className="grid grid-cols-2 gap-3">
  {FORMAT_OPTIONS.map(opt => (
    <button
      key={opt.value}
      type="button"
      onClick={() => updateDivision('format', opt.value)}
      className={`text-left p-3 rounded-lg border-2 transition-all duration-200 ${
        division.format === opt.value
          ? 'border-qw-accent bg-qw-accent/10 text-white'
          : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{opt.icon}</span>
        <span className="font-medium text-sm">{opt.label}</span>
      </div>
      <p className="text-xs text-zinc-500">{opt.desc}</p>
    </button>
  ))}
</div>
```

---

## Part 3: Deep Dive — Primary User Flow Analysis

### The Core Flow: Tournament Creation → Wiki Export

The happy path is: **Info → Create Division → Setup → Teams → Schedule → Import Results → (Standings auto-calc) → Bracket → Wiki Export.**

#### Flow Issues Identified

**1. Division creation is disconnected from first-use.**

When a user creates a new tournament, they land on the Info tab. They then navigate to "Divisions" to create one, then must click into that division, then navigate through sub-tabs. This is three navigation hops before any real work begins. For the overwhelmingly common case (single-division tournament), this is unnecessary friction.

*Recommendation:* When a tournament has zero divisions, auto-create a "Default" division and navigate directly to its Setup tab. Add a "Add Division" action within the DivisionView if multi-division is needed. This removes one full navigation layer for 80%+ of use cases. This is a moderate logic change in `App.jsx` — worth it given how many users will encounter it.

**2. Schedule → Results gap.**

The schedule generates match shells (team1, team2, date, round). Results are imported separately via Discord, API fetch, or JSON. But the connection between a schedule match and an imported result relies on team name matching — and per CLAUDE.md, this matching is case-insensitive but depends on team tag configuration being correct. If a user's team tags don't match the hub's team names, results silently fail to associate.

*Recommendation (low-effort):* After result import, show a reconciliation summary: "5 of 8 maps matched to scheduled games. 3 unmatched:" with the team names that didn't resolve. This is a display-only change in `DivisionResults.jsx` — parse the result of `addMapsInBatch` and show which maps didn't find a home.

**3. Wiki Export has no "preview what it'll look like" mode.**

The export generates raw MediaWiki markup in a textarea. For the target audience (tournament admins posting to Liquipedia/quakeworld.nu), there's a significant cognitive gap between raw wikitext and the rendered output. Admins must copy, paste into the wiki editor, preview, find issues, go back to Qwicky, adjust, re-export, and re-paste.

*Recommendation (medium effort, high value):* Add a "Rendered Preview" toggle that applies basic MediaWiki-to-HTML transformation for the most common elements (tables, bold, links, templates rendered as placeholders). This doesn't need to be perfect — even a 70% accurate preview would save significant round-trips. This would be a new utility function but no business logic changes.

**4. No undo for any operation.**

There is no undo anywhere in the application. Combined with localStorage-only persistence, this means any mistake (wrong team deleted, wrong result approved, wrong bracket seed) requires either manual reconstruction or loading a previously saved JSON backup — if one exists. The DataManager save/load feature exists but requires proactive use.

*Recommendation (low effort):* Auto-save a snapshot to a separate localStorage key before any destructive operation (delete division, bulk approve, reset bracket). Expose a single "Undo last change" option in the header or DataManager. Implementation: save `JSON.stringify(tournament)` to `qwicky_undo_snapshot` before the operation, and provide a restore button. One key, one snapshot, minimal storage overhead.

```jsx
// In App.jsx, add a snapshot helper:
const saveUndoSnapshot = () => {
  try {
    localStorage.setItem('qwicky_undo_snapshot', JSON.stringify(tournament));
  } catch (e) {
    console.warn('Undo snapshot failed:', e);
  }
};

const restoreUndoSnapshot = () => {
  const snap = localStorage.getItem('qwicky_undo_snapshot');
  if (snap) {
    setTournament(JSON.parse(snap));
    localStorage.removeItem('qwicky_undo_snapshot');
  }
};

// Call saveUndoSnapshot() before deleteDivision, handleReset, addMapsInBatch, etc.
// Expose restoreUndoSnapshot via DataManager or a subtle header link.
```

---

### Information Architecture Assessment

The current tab hierarchy is reasonable for the feature set. The main issue is **tab overload within a division** — nine sub-tabs (Setup, Teams, Schedule, Results, Standings, Bracket, Stats, Wiki) is pushing the limit of horizontal tab navigation. On narrower viewports, this likely wraps or overflows.

Two consolidation opportunities that wouldn't change logic:

- **Merge Standings into Bracket.** Standings are the input to bracket seeding. Showing them as a section above the bracket (collapsible) creates a clearer data flow and reduces tab count by one.
- **Merge Stats into Results.** Player stats are derived from imported results. Showing them as an expandable section within Results ("View Player Stats") is more contextual than a separate tab.

These are structural suggestions — implement only if tab count becomes a usability complaint from actual users.

---

### Summary Priority Matrix

| # | Fix | Effort | Impact | Priority |
|---|-----|--------|--------|----------|
| 1 | Conditional field visibility | Low | High | **P0** |
| 2 | Workflow progress indicator | Low | High | **P0** |
| 3 | Empty state messaging | Low | High | **P0** |
| 4 | Bulk operation progress | Medium | High | **P1** |
| 5 | Destructive action confirmation | Low | Medium | **P1** |
| 6 | Drag-and-drop affordance | Low | Medium | **P1** |
| 7 | Wiki copy feedback | Low | Medium | **P2** |
| 8 | Format selection cards | Low | Medium | **P2** |
| 9 | Auto-create default division | Medium | High | **P1** |
| 10 | Result import reconciliation | Medium | High | **P1** |
| 11 | Single-level undo | Medium | High | **P1** |

Items 1–3 are the highest-leverage changes. They require almost no logic changes, only JSX conditionals and new presentational components, yet they address the three critical bottlenecks identified in Part 1.