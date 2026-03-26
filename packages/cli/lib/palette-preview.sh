#!/usr/bin/env bash
# palette-preview.sh — Preview pane content for palette entries.
# Called by fzf --preview with the selected line as $1.
# Entry format: display1 \t display2 \t display3 \t type \t window \t pane

entry="$1"
session="${ORC_TMUX_SESSION:-orc}"

# Parse tab-delimited fields (4=type, 5=window, 6=pane)
type="$(echo "$entry" | awk -F'	' '{print $4}')"
win="$(echo "$entry" | awk -F'	' '{print $5}')"
pane="$(echo "$entry" | awk -F'	' '{print $6}')"

# Strip whitespace
type="$(echo "$type" | tr -d '[:space:]')"
win="$(echo "$win" | tr -d '[:space:]')"
pane="$(echo "$pane" | tr -d '[:space:]')"

case "$type" in
  pane)
    if [[ -n "$win" && -n "$pane" ]]; then
      tmux capture-pane -t "${session}:${win}.${pane}" -p -S -30 2>/dev/null || echo "Preview unavailable"
    fi
    ;;
  window)
    if [[ -n "$win" ]]; then
      tmux capture-pane -t "${session}:${win}" -p -S -30 2>/dev/null || echo "Preview unavailable"
    fi
    ;;
  *)
    echo ""
    ;;
esac
