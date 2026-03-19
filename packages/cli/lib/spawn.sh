#!/usr/bin/env bash
# spawn.sh — Create worktree + launch engineer for a bead.

set -euo pipefail

orc_spawn() {
  if [[ $# -ne 2 ]]; then
    _die "Usage: orc spawn <project> <bead>" "$EXIT_USAGE"
  fi

  local project="$1"
  local bead="$2"

  local project_path
  project_path="$(_require_project "$project")"

  _require git "https://git-scm.com/downloads"
  _require tmux "brew install tmux"
  _require bd "See Beads documentation"
  local agent_cmd
  agent_cmd="$(_config_get "defaults.agent_cmd" "claude" "$project_path")"
  _require "$agent_cmd" "Install your preferred agent CLI ($agent_cmd)"

  local worktree="$project_path/.worktrees/$bead"

  if [[ -d "$worktree" ]]; then
    _die "Worktree for bead '$bead' already exists at $worktree" "$EXIT_STATE"
  fi

  local max_workers
  max_workers="$(_config_get "defaults.max_workers" "3" "$project_path")"
  local current_workers
  current_workers="$(_worker_count "$project_path")"
  if [[ "$current_workers" -ge "$max_workers" ]]; then
    _die "Worker limit reached ($current_workers/$max_workers). Teardown a worker first." "$EXIT_STATE"
  fi

  _check_approval "spawn" "$project_path" || exit "$EXIT_OK"

  mkdir -p "$project_path/.worktrees"
  git -C "$project_path" worktree add ".worktrees/$bead" -b "work/$bead"

  (cd "$project_path" && bd show "$bead") > "$worktree/.orch-assignment.md"
  echo "working" > "$worktree/.worker-status"

  # Install slash commands into worktree
  _install_commands "$worktree" "$project_path"

  # Find the last window in this project group for hierarchical insertion
  local after
  after="$(_last_project_window "$project")"

  local window_name="${project}/${bead}"
  _tmux_new_window "$window_name" "$worktree" "$after"

  # Set engineering pane title and window status indicator
  _tmux_set_pane_title "$window_name" "0" "eng: ${project}/${bead}"
  _tmux_set_window_status "$window_name" "●"

  local persona
  persona="$(_resolve_persona "engineer" "$project_path")"
  local init_prompt
  init_prompt="Read your assignment in .orch-assignment.md now. Investigate the relevant code, then implement the work described. When done, run /orc:done."
  _launch_agent_in_window "$window_name" "$persona" "$project_path" "$init_prompt"

  _info "Engineer spawned for bead '$bead' in project '$project'."
}

orc_spawn "$@"
