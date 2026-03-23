#!/usr/bin/env bash
# board.sh — Open board view for a project.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  _die "Usage: orc board <project>" "$EXIT_USAGE"
fi

project="$1"
project_path="$(_require_project "$project")"

_require tmux "brew install tmux"

window_name="${project}/board"

_tmux_ensure_session

# If the board window exists, check if it's alive. Kill stale windows.
if _tmux_window_exists "$window_name"; then
  if _tmux_is_pane_alive "$window_name" "0" 2>/dev/null; then
    _info "Board running. Attaching."
    _orc_goto "$window_name"
    exit "$EXIT_OK"
  fi
  # Stale — kill and recreate
  _tmux_kill_window "$window_name"
fi

board_cmd="$(_config_get "board.command" "" "$project_path")"

after="$(_last_project_window "$project")"
_tmux_new_window "$window_name" "$project_path" "$after"

if [[ -n "$board_cmd" ]]; then
  # User-configured board command — run as-is
  _tmux_send "$window_name" "$board_cmd"
elif command -v abacus &>/dev/null && [[ -f "$project_path/.beads/beads.db" ]]; then
  # Abacus detected with beads DB — use it automatically
  _tmux_send "$window_name" "abacus -db-path $project_path/.beads/beads.db -skip-version-check"
else
  # Fallback — watch bd list
  _tmux_send "$window_name" "while true; do clear; cd $project_path && bd list; sleep 5; done"
fi

_info "Board opened for '$project'."
_orc_goto "$window_name"
