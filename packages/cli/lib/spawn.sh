#!/usr/bin/env bash
# spawn.sh — Create worktree + launch engineer for a bead.

set -euo pipefail

orc_spawn() {
  if [[ $# -lt 2 || $# -gt 3 ]]; then
    _die "Usage: orc spawn <project> <bead> [goal]" "$EXIT_USAGE"
  fi

  local project="$1"
  local bead="$2"
  local goal="${3:-}"

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

  local branch_name window_name
  if [[ -n "$goal" ]]; then
    # Find the goal branch and branch from it
    local goal_branch
    goal_branch="$(_find_goal_branch "$project_path" "$goal")"
    branch_name="work/${goal}/${bead}"
    window_name="${project}/${goal}/${bead}"
    git -C "$project_path" worktree add ".worktrees/$bead" -b "$branch_name" "$goal_branch"
  else
    branch_name="work/$bead"
    window_name="${project}/${bead}"
    git -C "$project_path" worktree add ".worktrees/$bead" -b "$branch_name"
  fi

  (cd "$project_path" && bd show "$bead") > "$worktree/.orch-assignment.md"
  echo "working" > "$worktree/.worker-status"

  # Extract bead title for descriptive pane label
  local bead_title
  bead_title="$(cd "$project_path" && bd show --short "$bead" 2>/dev/null \
    | sed 's/^[^ ]* *//' | cut -c1-30 || echo "")"
  local eng_label="eng: ${bead}"
  [[ -n "$bead_title" ]] && eng_label="eng: ${bead} — ${bead_title}"

  local persona
  persona="$(_resolve_persona "engineer" "$project_path")"
  local init_prompt
  init_prompt="Read your assignment in .orch-assignment.md now. Investigate the relevant code, then implement the work described. When done, run /orc:done."

  if [[ -n "$goal" ]]; then
    # ── Goal-aware: spawn engineer as a pane in the goal window ──
    # The goal window (${project}/${goal}) already exists with the goal
    # orchestrator as pane 0 (left/main). Engineers split in on the right
    # using main-vertical layout. The tab bar reads:
    #   orc │ status │ myproject │ myproject/fix-auth │ myproject/add-api
    local goal_window="${project}/${goal}"

    if ! _tmux_window_exists "$goal_window"; then
      _die "Goal window '${goal_window}' not found. Run 'orc spawn-goal ${project} ${goal}' first." "$EXIT_STATE"
    fi

    # Split into the goal window (or overflow if full)
    local target_window
    target_window="$(_tmux_pane_target "$goal_window" "$project_path")"

    _tmux_split_with_agent "$target_window" "$eng_label" "$persona" \
      "$project_path" "$init_prompt" "$worktree"

    _tmux_set_window_status "$target_window" "●"
  else
    # ── Legacy: spawn engineer in its own window ──
    local after
    after="$(_last_project_window "$project")"

    _tmux_new_window "$window_name" "$worktree" "$after"

    # Set engineering pane title and window status indicator
    _tmux_set_pane_title "$window_name" "0" "$eng_label"
    _tmux_set_window_status "$window_name" "●"

    _launch_agent_in_window "$window_name" "$persona" "$project_path" "$init_prompt"
  fi

  _info "Engineer spawned for bead '$bead'${goal:+ (goal: $goal)} in project '$project'."
}

orc_spawn "$@"
