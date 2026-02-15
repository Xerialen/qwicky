Good question. Let me think about this practically given your setup.

## Recommended Approach

**Use Claude Sonnet 4 via Claude Code** for all of these. Here's why:

- These are all frontend-only changes — JSX, CSS, small new components
- No complex architectural decisions or ambiguous design tradeoffs
- The CLAUDE.md file gives Sonnet everything it needs to match your conventions
- Sonnet is roughly 5x cheaper than Opus and handles this class of work well

## Batching Strategy

Group by dependency and file overlap to minimize context thrashing:

**Batch 1 — DivisionSetup.jsx changes (items 1 + 8)**
Conditional field visibility + format selection cards. Both modify the same file, same render flow. One prompt, one branch.

**Batch 2 — New shared components (items 3 + 5)**
Create `EmptyState.jsx` and `DangerButton.jsx`, then wire them into DivisionManager, DataManager, DivisionStandings, DivisionBracket, DivisionWiki. These are new files with simple integration points.

**Batch 3 — DivisionView.jsx (item 2)**
Workflow progress indicator. Touches DivisionView only, but needs to read division state, so do it after batches 1-2 so the tab structure is stable.

**Batch 4 — DivisionResults.jsx (item 4)**
Bulk operation progress. This file is ~920 lines and the async logic is delicate (stale closures). Give it a focused prompt with explicit instructions about the batching pattern from CLAUDE.md.

**Batch 5 — DivisionSchedule.jsx (item 6)**
Drag-and-drop affordance. Isolated to one file, low risk.

**Batch 6 — DivisionWiki.jsx (item 7)**
Copy feedback. Small, self-contained.

**Batch 7 — App.jsx (item 11)**
Undo snapshot. Touches the root state provider, so do it last when everything else is stable.

## Prompt Structure for Each Batch

Give Claude Code a prompt like:

```
Read CLAUDE.md for project conventions. On branch feature/ux-batch-1, 
implement these two changes to DivisionSetup.jsx:

1. [paste the specific fix description + code from the audit]
2. [paste the second fix]

Match existing Tailwind classes and dark theme. No logic changes 
to how division data is stored. Test by running npm run dev.
```

## What NOT to Batch

Don't combine items that touch different files with complex interactions. Specifically, keep item 4 (Results async flow) and item 11 (undo snapshots) as solo tasks — both touch sensitive state management.

## Cost Estimate

At Sonnet rates, the seven batches are probably 15-25 minutes of Claude Code time total. These are all "read file, add JSX, create component" tasks — exactly Sonnet's sweet spot. You'd burn through Opus tokens quickly for no real quality gain on this type of work.

**Reserve Opus for:** the item 9 (auto-create default division) and item 10 (result import reconciliation) from the deep dive section, since those involve actual flow logic and cross-component state changes.