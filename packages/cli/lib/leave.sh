#!/usr/bin/env bash
# leave.sh — Gracefully detach from the orc tmux session.

set -euo pipefail

if ! tmux has-session -t "$ORC_TMUX_SESSION" 2>/dev/null; then
  _info "No orc session running."
  exit "$EXIT_OK"
fi

_info "Active orc windows:"
tmux list-windows -t "$ORC_TMUX_SESSION" -F '  #{window_name}' 2>/dev/null
echo ""

if [[ -n "${TMUX:-}" ]]; then
  _info "Detaching. Everything keeps running in the background."
  _info "Come back with: orc, orc <project>, or orc <project> <bead>"
  sleep 0.5
  tmux detach-client
else
  _info "You're not attached to the orc session."
  _info "Attach with: orc, orc <project>, or orc <project> <bead>"
fi
