#!/usr/bin/env bash
# review.sh — Launch review pane in an engineer's worktree window.

set -euo pipefail

orc_review() {
  if [[ $# -ne 2 ]]; then
    _die "Usage: orc review <project> <bead>" "$EXIT_USAGE"
  fi

  local project="$1"
  local bead="$2"

  local project_path
  project_path="$(_require_project "$project")"

  _require tmux "brew install tmux"
  local agent_cmd
  agent_cmd="$(_config_get "defaults.agent_cmd" "claude" "$project_path")"
  _require "$agent_cmd" "Install your preferred agent CLI ($agent_cmd)"

  local worktree_dir="$project_path/.worktrees/$bead"
  if [[ ! -d "$worktree_dir" ]]; then
    _die "Worktree for bead '$bead' not found at $worktree_dir" "$EXIT_STATE"
  fi

  _check_approval "review" "$project_path" || exit "$EXIT_OK"

  # Find the worktree window (may have status suffix)
  local window_name
  window_name="$(tmux list-windows -t "$ORC_TMUX_SESSION" -F '#{window_name}' 2>/dev/null \
    | grep -E "^${project}/${bead}( |$)" | head -1 || true)"

  if [[ -z "$window_name" ]]; then
    _die "Worktree window for '$project/$bead' not found." "$EXIT_STATE"
  fi

  # Kill existing review pane if present (pane 1)
  _tmux_kill_pane "$window_name" "1"

  # Create review pane — vertical split on right, 40% width
  _tmux_split "$window_name" "-h" "40" "$worktree_dir"

  # Determine review round from .worker-feedback history
  local round=1
  if [[ -f "$worktree_dir/.worker-feedback" ]]; then
    round=$(( $(grep -c "^VERDICT:" "$worktree_dir/.worker-feedback" 2>/dev/null || echo 0) + 1 ))
  fi

  # Set review pane title
  _tmux_set_pane_title "$window_name" "1" "review: ${project}/${bead} (round $round)"

  # Update window name to show review status
  tmux rename-window -t "${ORC_TMUX_SESSION}:${window_name}" "${project}/${bead} ✓"

  # Launch review process
  local review_cmd
  review_cmd="$(_config_get "review.command" "" "$project_path")"

  if [[ -z "$review_cmd" ]]; then
    # Default: launch reviewer agent with persona
    local persona
    persona="$(_resolve_persona "reviewer" "$project_path")"

    local review_instructions
    review_instructions="$(_config_get "review.instructions" "" "$project_path")"
    if [[ -n "$review_instructions" ]]; then
      persona="$persona

$review_instructions"
    fi

    _launch_agent_in_window "$window_name" "$persona" "$project_path"
  else
    # Configured review command (e.g., /ocr:review)
    _tmux_send_pane "$window_name" "1" "$review_cmd"
  fi

  _info "Review pane launched for bead '$bead' (round $round)."
}

orc_review "$@"
