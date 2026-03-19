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

if _tmux_window_exists "$window_name"; then
  _info "Board already open. Switching."
  _orc_goto "$window_name"
  exit "$EXIT_OK"
fi

_tmux_ensure_session

board_cmd="$(_config_get "board.command" "" "$project_path")"

after="$(_last_project_window "$project")"
_tmux_new_window "$window_name" "$project_path" "$after"

if [[ -n "$board_cmd" ]] && command -v "$board_cmd" &>/dev/null; then
  _tmux_send "$window_name" "$board_cmd"
elif [[ -n "$board_cmd" ]]; then
  _warn "Board tool '$board_cmd' not found on PATH. Using built-in fallback."
  _tmux_send "$window_name" "while true; do clear; bd list; sleep 5; done"
else
  _tmux_send "$window_name" "while true; do clear; bd list; sleep 5; done"
fi

_info "Board opened for '$project'."
_orc_goto "$window_name"
