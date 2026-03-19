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
tmux send-keys -t "${ORC_TMUX_SESSION}:${window_name}.0" C-c

_info "Sent interrupt to engineer '$project/$bead'."
