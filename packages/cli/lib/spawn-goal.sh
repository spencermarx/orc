#!/usr/bin/env bash
# spawn-goal.sh — Launch a goal orchestrator as a separate agent session.

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

  local window_name="${project}/${goal}"

  if _tmux_window_exists "$window_name"; then
    if _tmux_is_dead_window "$window_name"; then
      _info "Goal orchestrator for '$goal' session ended. Relaunching."
    else
      _info "Goal orchestrator for '$goal' already running. Attaching."
      _orc_goto "$window_name"
      return
    fi
  fi

  _check_approval "spawn" "$project_path" || exit "$EXIT_OK"

  _tmux_ensure_session

  # Install slash commands into the project (goal orch runs from project root)
  _install_commands "$project_path" "$project_path"

  # Insert after the last window in this project's hierarchy
  local after
  after="$(_last_project_window "$project")"

  if ! _tmux_window_exists "$window_name"; then
    _tmux_new_window "$window_name" "$project_path" "$after"
  fi

  # Set window status indicator
  _tmux_set_window_status "$window_name" "●"

  local persona
  persona="$(_resolve_persona "goal-orchestrator" "$project_path")"

  local init_prompt
  init_prompt="You are the goal orchestrator for goal '${goal}' in project '${project}' at ${project_path}. The goal branch is '${goal_branch}'. Start by investigating the codebase and understanding the scope of this goal, then run /orc:plan to decompose it into beads."

  _launch_agent_in_window "$window_name" "$persona" "$project_path" "$init_prompt"

  _info "Goal orchestrator spawned for goal '$goal' (branch: $goal_branch) in project '$project'."
}

orc_spawn_goal "$@"
