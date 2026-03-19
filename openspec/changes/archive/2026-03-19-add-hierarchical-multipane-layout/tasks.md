# Tasks: Add Hierarchical Multi-Pane TUI Layout

## Phase 1 — Pane Overflow Helper

- [ ] 1.1 Add `_tmux_pane_target()` to `_common.sh` — given a base
      window name, checks if adding a pane would violate min-size
      constraints. If yes, finds or creates the next overflow window
      (`<base>:2`, `<base>:3`). Returns the target window name. Fills
      numbering gaps (prefers `:2` over `:4` when `:2` is available).
- [ ] 1.2 Add `_tmux_split_with_agent()` to `_common.sh` — combines
      split + pane title + pane registry + rebalance (`main-vertical`)
      + agent launch into one helper. Accepts: target window, direction,
      pane title, persona, project path, initial prompt.
- [ ] 1.3 Add `_tmux_overflow_windows()` to `_common.sh` — lists all
      overflow windows for a base name (e.g., `myapp:2`, `myapp:3`).
      Used by teardown to find and destroy overflow windows.
- [ ] 1.4 Smoke test: manually create a window, call
      `_tmux_pane_target` with a very small terminal to trigger
      overflow, verify overflow window is created with correct name.

## Phase 2 — Goal Orchestrator as Pane

- [ ] 2.1 Modify `spawn-goal.sh` to split the project window
      (`$project`) instead of creating a new window. Use
      `_tmux_pane_target()` to determine target (handles overflow).
      Set pane title `goal: <goal>`. Apply `main-vertical` layout.
      Project orchestrator stays as pane 0.
- [ ] 2.2 Handle the "project window is just pane 0" case: first
      goal spawn triggers the initial horizontal split.
- [ ] 2.3 Handle dead/relaunch: if a goal orchestrator pane dies,
      detect it by title and relaunch in the same pane slot.
- [ ] 2.4 Smoke test: `orc spawn-goal myapp fix-auth` splits the
      `myapp` window. Second goal adds another pane. Layout is
      `main-vertical`.

## Phase 3 — Engineer as Pane

- [ ] 3.1 Modify `spawn.sh` — when a goal is provided, split the goal
      window (or its overflow) instead of creating a new window. Use
      `_tmux_pane_target("$project/$goal")` for overflow. Set pane
      title `eng: <bead>`. Apply `main-vertical`. Goal orchestrator
      stays as pane 0.
- [ ] 3.2 Preserve legacy behavior: when no goal is provided, spawn
      continues to create its own window as before.
- [ ] 3.3 Smoke test: `orc spawn myapp bd-abc fix-auth` creates a pane
      in `myapp/fix-auth` window, not a new window. Overflow works when
      terminal is small.

## Phase 4 — Pane-Aware Teardown

- [ ] 4.1 Update `_teardown_bead` in `teardown.sh` — find the
      engineer's pane by title (`eng: <bead>`) in the goal window (and
      overflow windows). Kill that pane, not the whole window.
      Rebalance remaining panes. If the overflow window is now empty,
      destroy it.
- [ ] 4.2 Update `_teardown_goal` in `teardown.sh` — find the goal
      pane by title (`goal: <goal>`) in the project window. Kill all
      engineer panes under the goal (in goal window + overflow windows).
      Destroy all goal overflow windows. Kill the goal pane from the
      project window. Rebalance the project window.
- [ ] 4.3 Update `review.sh` — review pane splits the engineer's pane
      within the goal window context. Find the engineer pane by title,
      split it. On cleanup, kill the review pane and rebalance.
- [ ] 4.4 Smoke test: teardown a bead — pane killed, siblings
      rebalance. Teardown a goal — goal pane + all engineer panes
      killed, project window rebalances. No orphaned windows.

## Phase 5 — Documentation Updates

- [ ] 5.1 Update `/orc:view` command docs to describe hierarchical
      hub-and-spoke model, overflow windows, pane navigation
      (`Ctrl-B + arrows`).
- [ ] 5.2 Update `/orc:dispatch` and `/orc:check` to reference
      pane-based monitoring context.
- [ ] 5.3 Update CLAUDE.md tmux layout section to reflect the new
      pane-based hierarchy and overflow model.
