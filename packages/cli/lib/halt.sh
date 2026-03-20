#!/usr/bin/env bash
# halt.sh — Stop an engineer gracefully.

set -euo pipefail

if [[ $# -ne 2 ]]; then
  _die "Usage: orc halt <project> <bead>" "$EXIT_USAGE"
fi

project="$1"
bead="$2"

project_path="$(_require_project "$project")"

# Detect goal window from worktree branch (engineers are panes in goal windows)
worktree_dir="$project_path/.worktrees/$bead"
if [[ ! -d "$worktree_dir" ]]; then
  _die "Worktree for bead '$bead' not found at $worktree_dir" "$EXIT_STATE"
fi

actual_branch="$(git -C "$worktree_dir" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"

if [[ "$actual_branch" == work/*/* ]]; then
  # Goal-aware: engineer is a pane in the goal window
  goal_from_branch="${actual_branch#work/}"
  goal_from_branch="${goal_from_branch%/*}"
  window_name="${project}/${goal_from_branch}"
else
  # Legacy: engineer has its own window
  window_name="${project}/${bead}"
fi

if ! _tmux_window_exists "$window_name"; then
  _die "No running window for '$window_name'." "$EXIT_STATE"
fi

# Find the engineer pane by title within the window
eng_pane="$(_tmux_find_pane "$window_name" "eng: ${bead}")"
if [[ -z "$eng_pane" ]]; then
  # Legacy fallback: try pane 0
  eng_pane=0
fi
tmux send-keys -t "$(_tmux_target "$window_name" "$eng_pane")" C-c

_info "Sent interrupt to engineer '$project/$bead'."
