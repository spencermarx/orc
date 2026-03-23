#!/usr/bin/env bash
# send.sh — Send text to a tmux window/pane reliably.
# Uses load-buffer to avoid TUI paste buffering.
# Usage: orc send <window> <text>
#        orc send <window> --pane <N> <text>
#        echo "text" | orc send <window> --stdin

set -euo pipefail

if [[ $# -lt 2 ]]; then
  _die "Usage: orc send <window> <text>  OR  echo 'text' | orc send <window> --stdin" "$EXIT_USAGE"
fi

window="$1"
shift

# Parse optional --pane flag
pane=""
if [[ "${1:-}" == "--pane" ]]; then
  shift
  pane="$1"
  shift
fi

# Get text from --stdin or remaining args
if [[ "${1:-}" == "--stdin" ]]; then
  text="$(cat)"
else
  text="$*"
fi

if [[ -z "$text" ]]; then
  _die "No text to send." "$EXIT_USAGE"
fi

if [[ -n "$pane" ]]; then
  _tmux_send_pane "$window" "$pane" "$text"
else
  _tmux_send "$window" "$text"
fi
