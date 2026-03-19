## Context

Orc's tmux layout currently creates one window per agent. With the
four-tier hierarchy (root → project → goal → engineer), a project with
2 goals and 3 engineers each produces 9 windows. This is flat and
loses hierarchical context.

The desired layout mirrors the agent hierarchy using panes:

```
Window: myproject
┌────────────────────────┬──────────────────┐
│                        │  goal: fix-auth  │
│   Project Orchestrator ├──────────────────┤
│   (main pane, ~60%)    │  goal: add-api   │
│                        ├──────────────────┤
│                        │  goal: refactor  │
└────────────────────────┴──────────────────┘

Window: myproject/fix-auth
┌────────────────────────┬──────────────────┐
│                        │  eng: bd-a1b2    │
│   Goal Orchestrator    ├──────────────────┤
│   (main pane, ~60%)    │  eng: bd-c3d4    │
│                        ├──────────────────┤
│                        │  eng: bd-e5f6    │
└────────────────────────┴──────────────────┘
```

Tab bar reduces from N windows to a clean hierarchy:
```
orc │ status │ myproject │ myproject/fix-auth │ myproject/add-api
```

## Goals / Non-Goals

**Goals:**
- Mirror agent hierarchy in TUI layout (panes inside windows)
- Auto-overflow to numbered windows when panes won't fit
- Never constrain worker capacity for layout reasons
- Pane-aware teardown with rebalancing

**Non-Goals:**
- Changing the agent hierarchy or orchestration logic
- Custom layout configurability beyond what tmux provides
- Animated transitions or TUI chrome

## Decisions

### Decision: Use `main-vertical` as the default layout

The `main-vertical` tmux layout keeps the orchestrator (pane 0) as the
large left pane and stacks child agents in the right column. This
preserves the orchestrator's readability while showing child status.

**Alternatives considered:**
- `tiled`: equal space for all panes — wastes space on the orchestrator
  which needs more room for planning output
- `main-horizontal`: stacks vertically — agent CLIs are wider than tall,
  so horizontal stacking wastes vertical space
- Custom layout strings: fragile across terminal resizes

### Decision: Overflow via numbered windows, not capacity limits

When a new pane would violate min-size constraints, create an overflow
window (`base:2`, `base:3`). This preserves user-configured
`max_workers` and never artificially limits capacity.

**How overflow works:**
1. Before splitting, simulate the split and check min-size
2. If any pane would be too small, find or create the next overflow
   window
3. Overflow windows use the same `main-vertical` layout but have no
   "main" orchestrator pane — all panes are equal-sized children
4. The orchestrator pane only exists in the primary window (`:1`)

**Alternatives considered:**
- Limiting `max_workers` per goal to 3: artificially constrains work
  capacity for cosmetic reasons — rejected by user
- Separate monitoring windows: duplicates information, adds mental
  overhead

### Decision: Orchestrator pane is always pane 0 in the primary window

The first pane (pane 0) in each primary window is always the
orchestrator (project orch in the project window, goal orch in the
goal window). This is a stable convention that teardown and rebalancing
can rely on: never kill pane 0 when tearing down a child.

### Decision: Review panes split the engineer's pane, not a new window

When an engineer signals review, the review pane splits the engineer's
pane within the goal window (horizontal split, right side). This keeps
the review visually co-located with the engineer. After review
completes, the review pane is killed and the engineer pane reclaims
the space.

If the engineer is in an overflow window, the review split happens
in that overflow window.

## Risks / Trade-offs

- **Small panes:** With 4+ children in a right column, each gets very
  little vertical space. Mitigated by overflow at min-size thresholds.
  The existing `_pane_min_size_check()` handles this.

- **Pane identification:** tmux pane indices shift when panes are
  killed. We rely on pane titles (already implemented via
  `_tmux_find_pane()`) rather than indices for discovery.

- **Agent interactivity:** Only one pane per window can be "active"
  (receive input). Users navigate with `Ctrl-B + arrows`. This is
  standard tmux behavior but may be unfamiliar. `/orc:view` docs
  should explain navigation.

## Open Questions

None — design is straightforward application of existing tmux
primitives and the pane registry/layout engine already in `_common.sh`.
