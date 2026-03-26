#!/usr/bin/env bash
# menu-action.sh — Callback for context menu actions.
# Routes navigation (safe), orchestration (validated), and confirmed actions.
# Usage: menu-action.sh <action> [args...]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_common.sh"

set -euo pipefail

readonly SESSION="${ORC_TMUX_SESSION:-orc}"
action="${1:-}"
shift || true

case "$action" in
  # ── Navigation actions (always safe) ──────────────────────────────────

  nav-project)
    # Jump to the most recently active project orchestrator window
    # Find first window that looks like a project (no / in name, not orc/status/board)
    target="$(tmux list-windows -t "$SESSION" -F '#{window_name}' 2>/dev/null \
      | grep -v '/' | grep -v '^orc$' | grep -v '^status$' | grep -v 'board' | grep -v '^_' | head -1 || true)"
    if [[ -n "$target" ]]; then
      tmux select-window -t "${SESSION}:${target}"
    else
      tmux display-message "No project window found"
    fi
    ;;

  nav-board)
    project="${1:-}"
    if [[ -n "$project" ]]; then
      tmux select-window -t "${SESSION}:${project}/board" 2>/dev/null \
        || tmux display-message "Board window not found for ${project}"
    fi
    ;;

  nav-goal-pane)
    window="${1:-}"
    if [[ -n "$window" ]]; then
      # Find the goal orchestrator pane by @orc_id prefix
      goal_pane="$(_tmux_find_pane "$window" "goal:")"
      if [[ -n "$goal_pane" ]]; then
        tmux select-pane -t "$(_tmux_target "$window" "$goal_pane")"
      else
        # Fallback: select first pane
        tmux select-pane -t "$(_tmux_target "$window").0" 2>/dev/null || true
      fi
    fi
    ;;

  # ── Orchestration actions (validated before dispatch) ─────────────────

  orch-send)
    window="${1:-}"
    orc_id_pattern="${2:-}"
    slash_cmd="${3:-}"

    if [[ -z "$window" || -z "$orc_id_pattern" || -z "$slash_cmd" ]]; then
      tmux display-message "Menu action error: missing arguments"
      exit 1
    fi

    # Use safety gate: re-resolve pane, check copy mode
    pane_idx="$(_tmux_safe_to_send "$window" "$orc_id_pattern")" || exit 0

    # Send the slash command via safe load-buffer + paste-buffer
    _tmux_send_pane "$window" "$pane_idx" "$slash_cmd"
    ;;

  *)
    tmux display-message "Unknown menu action: ${action}"
    ;;
esac
