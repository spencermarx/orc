#!/usr/bin/env bash
# halt.sh — Stop an engineer gracefully.

set -euo pipefail

if [[ $# -ne 2 ]]; then
  _die "Usage: orc halt <project> <bead>" "$EXIT_USAGE"
fi

project="$1"
bead="$2"

_require_project "$project" >/dev/null

# Find the worktree window
window_name="$(tmux list-windows -t "$ORC_TMUX_SESSION" -F '#{window_name}' 2>/dev/null \
  | grep -E "^${project}/${bead}( |$)" | head -1 || true)"

if [[ -z "$window_name" ]]; then
  _die "No running window for '$project/$bead'." "$EXIT_STATE"
fi

# Send Ctrl-C to the engineering pane
# Find engineering pane by title, fallback to pane 0
eng_pane="$(_tmux_find_pane "$window_name" "eng:")"
eng_pane="${eng_pane:-0}"
tmux send-keys -t "$(_tmux_target "$window_name" "$eng_pane")" C-c

_info "Sent interrupt to engineer '$project/$bead'."
