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
  agent_cmd="$(_config_get "defaults.agent_cmd" "claude" "$project_path")"
  _require "$agent_cmd" "Install your preferred agent CLI ($agent_cmd)"

  # Verify the goal branch exists
  local goal_branch
  goal_branch="$(_find_goal_branch "$project_path" "$goal")"

  local goal_window="${project}/${goal}"
  local pane_title="goal: ${goal}"

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
  _tmux_new_window "$goal_window" "$project_path" "$after"

  # Set pane 0 title
  _tmux_set_pane_title "$goal_window" "0" "$pane_title"

  # Set window status indicator
  _tmux_set_window_status "$goal_window" "●"

  # Launch the goal orchestrator agent in pane 0
  local persona
  persona="$(_resolve_persona "goal-orchestrator" "$project_path")"

  local init_prompt
  if [[ -n "$custom_prompt" ]]; then
    init_prompt="You are the goal orchestrator for goal '${goal}' in project '${project}' at ${project_path}. The goal branch is '${goal_branch}'. ${custom_prompt}"
  else
    init_prompt="You are the goal orchestrator for goal '${goal}' in project '${project}' at ${project_path}. The goal branch is '${goal_branch}'. Start by investigating the codebase and understanding the scope of this goal, then run /orc:plan to decompose it into beads."
  fi

  _launch_agent_in_window "$goal_window" "$persona" "$project_path" "$init_prompt"

  _info "Goal orchestrator spawned for goal '$goal' (branch: $goal_branch) in project '$project'."
}

orc_spawn_goal "$@"
