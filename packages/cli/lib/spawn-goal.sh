#!/usr/bin/env bash
# spawn-goal.sh — Launch a goal orchestrator as a pane in the project window.

set -euo pipefail

orc_spawn_goal() {
  if [[ $# -ne 2 ]]; then
    _die "Usage: orc spawn-goal <project> <goal>" "$EXIT_USAGE"
  fi

  local project="$1"
  local goal="$2"

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

  local pane_title="goal: ${goal}"

  # ── Check for existing goal pane (reuse or relaunch) ──────────────────────

  # Search project window and any overflow windows for an existing goal pane
  local existing_window="" existing_pane=""
  _find_goal_pane() {
    local win="$1"
    local idx
    idx="$(_tmux_find_pane "$win" "$pane_title")"
    if [[ -n "$idx" ]]; then
      existing_window="$win"
      existing_pane="$idx"
      return 0
    fi
    return 1
  }

  # Check primary project window
  if _tmux_window_exists "$project" && _find_goal_pane "$project"; then
    : # found
  else
    # Check overflow windows
    local overflow
    overflow="$(_tmux_overflow_windows "$project")"
    while IFS= read -r win; do
      [[ -z "$win" ]] && continue
      if _find_goal_pane "$win"; then
        break
      fi
    done <<< "$overflow"
  fi

  if [[ -n "$existing_pane" ]]; then
    if _tmux_is_pane_alive "$existing_window" "$existing_pane"; then
      _info "Goal orchestrator for '$goal' already running. Attaching."
      _orc_goto "$existing_window"
      return
    fi
    # Dead pane — kill it, will be relaunched below
    _info "Goal orchestrator for '$goal' session ended. Relaunching."
    _tmux_kill_pane "$existing_window" "$existing_pane"
  fi

  _check_approval "spawn" "$project_path" || exit "$EXIT_OK"

  # ── Create goal status directory ─────────────────────────────────────────
  local goal_status_dir
  goal_status_dir="$(_goal_status_dir "$project_path" "$goal")"
  mkdir -p "$goal_status_dir"
  echo "working" > "$goal_status_dir/.worker-status"

  _tmux_ensure_session

  # Install slash commands into the project (goal orch runs from project root)
  _install_commands "$project_path" "$project_path"

  # ── Find target window (project window or overflow) ───────────────────────

  local target_window
  target_window="$(_tmux_pane_target "$project" "$project_path")"

  # ── Split and launch ──────────────────────────────────────────────────────

  local persona
  persona="$(_resolve_persona "goal-orchestrator" "$project_path")"

  local init_prompt
  init_prompt="You are the goal orchestrator for goal '${goal}' in project '${project}' at ${project_path}. The goal branch is '${goal_branch}'. Start by investigating the codebase and understanding the scope of this goal, then run /orc:plan to decompose it into beads."

  _tmux_split_with_agent "$target_window" "$pane_title" "$persona" \
    "$project_path" "$init_prompt" "$project_path"

  # Set window status indicator (on the target window housing the pane)
  _tmux_set_window_status "$target_window" "●"

  _info "Goal orchestrator spawned for goal '$goal' (branch: $goal_branch) as pane in '$target_window'."
}

orc_spawn_goal "$@"
