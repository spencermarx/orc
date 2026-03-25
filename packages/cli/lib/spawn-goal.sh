#!/usr/bin/env bash
# spawn-goal.sh — Launch a goal orchestrator in its own goal window.
# The goal orch is pane 0 (left/main); engineers split in on the right.

set -euo pipefail

orc_spawn_goal() {
  if [[ $# -lt 2 || $# -gt 3 ]]; then
    _die "Usage: orc spawn-goal <project> <goal> [prompt]" "$EXIT_USAGE"
  fi

  local project="$1"
  local goal="$2"
  local custom_prompt="${3:-}"

  local project_path
  project_path="$(_require_project "$project")"

  _require git "https://git-scm.com/downloads"
  _require tmux "brew install tmux"
  _require bd "See Beads documentation"
  local agent_cmd
  agent_cmd="$(_resolve_agent_cmd "$project_path")"
  _require "$agent_cmd" "Install your preferred agent CLI ($agent_cmd)"

  # Verify the goal branch exists
  local goal_branch
  goal_branch="$(_find_goal_branch "$project_path" "$goal")"

  # ── Create or reuse goal worktree ──────────────────────────────────────
  local goal_worktree="$project_path/.worktrees/goal-${goal}"

  if [[ ! -d "$goal_worktree" ]]; then
    mkdir -p "$project_path/.worktrees"
    git -C "$project_path" worktree add ".worktrees/goal-${goal}" "$goal_branch" 2>/dev/null || {
      # Worktree may already be registered but directory missing — try removing first
      git -C "$project_path" worktree remove ".worktrees/goal-${goal}" --force 2>/dev/null || true
      git -C "$project_path" worktree add ".worktrees/goal-${goal}" "$goal_branch"
    }
  fi

  local goal_window="${project}/${goal}"
  local pane_title="goal: ${goal} (${goal_branch})"

  # ── Check for existing goal window (reuse or relaunch) ─────────────────

  if _tmux_window_exists "$goal_window"; then
    # Check if pane 0 (goal orch) is still alive
    if _tmux_is_pane_alive "$goal_window" "0"; then
      _info "Goal orchestrator for '$goal' already running. Attaching."
      _orc_goto "$goal_window"
      return
    fi
    # Dead — tear down the window and recreate below
    _info "Goal orchestrator for '$goal' session ended. Relaunching."
    tmux kill-window -t "$(_tmux_target "$goal_window")" 2>/dev/null || true
  fi

  _check_approval "spawn" "$project_path" || exit "$EXIT_OK"

  # ── Create goal status directory ─────────────────────────────────────────
  local goal_status_dir
  goal_status_dir="$(_goal_status_dir "$project_path" "$goal")"
  mkdir -p "$goal_status_dir"
  echo "working" > "$goal_status_dir/.worker-status"

  _tmux_ensure_session

  # ── Create goal window with goal orch as pane 0 ────────────────────────

  local after
  after="$(_last_project_window "$project")"
  _tmux_new_window "$goal_window" "$goal_worktree" "$after"

  # Set pane 0 title
  _tmux_set_pane_title "$goal_window" "0" "$pane_title"
  _tmux_set_pane_id "$goal_window" "0" "$pane_title"

  # Set window status indicator
  _tmux_set_window_status "$goal_window" "●"

  # Set layout hook — re-apply main-vertical after any pane split to prevent tiling
  local layout_cmd="select-layout -t ${ORC_TMUX_SESSION}:${goal_window} main-vertical"
  tmux set-hook -t "${ORC_TMUX_SESSION}:${goal_window}" after-split-window "$layout_cmd" 2>/dev/null || true

  # Launch the goal orchestrator agent in pane 0
  local persona
  persona="$(_resolve_persona "goal-orchestrator" "$project_path")"

  # Inject branching strategy if configured
  local branching_strategy
  branching_strategy="$(_config_get_branching_strategy "$project_path")"

  local init_prompt
  init_prompt="You are the goal orchestrator for goal '${goal}' in project '${project}'. The goal branch is '${goal_branch}'.

Your working directory is an isolated worktree at ${goal_worktree}, checked out to the goal branch. You and your sub-agents (planners, scouts) work here freely — the developer's main workspace is untouched.

IMPORTANT PATHS:
- Working directory (your worktree): ${goal_worktree}
- Project root (for bd commands and status files): ${project_path}
- Status file: ${project_path}/.worktrees/.orc-state/goals/${goal}/.worker-status

When running bd commands, use: cd ${project_path} && bd <command>
When writing status, use the project root path: echo \"review\" > ${project_path}/.worktrees/.orc-state/goals/${goal}/.worker-status

Start by investigating the codebase and understanding the scope of this goal, then run /orc:plan to decompose it into beads."
  if [[ -n "$branching_strategy" ]]; then
    init_prompt="${init_prompt}

Branching strategy: ${branching_strategy}"
  fi
  if [[ -n "$custom_prompt" ]]; then
    init_prompt="${init_prompt}

Additional instructions: ${custom_prompt}"
  fi

  _launch_agent_in_window "$goal_window" "$persona" "$project_path" "$init_prompt"

  _info "Goal orchestrator spawned for goal '$goal' (branch: $goal_branch) in project '$project'."
}

orc_spawn_goal "$@"
