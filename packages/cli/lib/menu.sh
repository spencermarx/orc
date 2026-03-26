#!/usr/bin/env bash
# menu.sh — Role-aware context menu for orc TUI navigation layer.
# Invoked by tmux binding: run-shell "menu.sh <pane_id>"
# Uses native tmux display-menu — no external dependencies.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_common.sh"

set -euo pipefail

readonly SESSION="${ORC_TMUX_SESSION:-orc}"
PANE_ID="${1:-}"

# ── Resolve pane role from @orc_id ─────────────────────────────────────────

role="unknown"
orc_id=""
window_name=""

if [[ -n "$PANE_ID" ]]; then
  orc_id="$(tmux show-option -t "$PANE_ID" -p -v @orc_id 2>/dev/null || true)"
  window_name="$(tmux display-message -t "$PANE_ID" -p '#{window_name}' 2>/dev/null || true)"
fi

# Fallback to pane title if @orc_id not set
if [[ -z "$orc_id" ]]; then
  pane_title="$(tmux display-message -t "$PANE_ID" -p '#{pane_title}' 2>/dev/null || true)"
  orc_id="$pane_title"
fi

case "$orc_id" in
  goal:*)   role="goal-orch" ;;
  eng:*)    role="engineer" ;;
  review:*) role="reviewer" ;;
  *)
    # Check if this is a project/root orchestrator by window name
    if [[ "$window_name" == "orc" ]]; then
      role="root-orch"
    elif [[ "$window_name" != *"/"* && "$window_name" != "status" && "$window_name" != *"board"* && -n "$window_name" ]]; then
      role="project-orch"
    fi
    ;;
esac

# ── Derive context for navigation ──────────────────────────────────────────

project=""
goal=""
if [[ "$window_name" == *"/"* ]]; then
  project="${window_name%%/*}"
  goal="${window_name#*/}"
  # Strip overflow suffix
  goal="${goal%%:*}"
elif [[ "$role" == "project-orch" ]]; then
  project="$window_name"
fi

# ── Helper: build the display-menu command ─────────────────────────────────

MENU_ARGS=()

_menu_item() {
  local label="$1" key="$2" cmd="$3"
  MENU_ARGS+=("$label" "$key" "$cmd")
}

_menu_separator() {
  MENU_ARGS+=("" "" "")
}

ACTION_SH="${SCRIPT_DIR}/menu-action.sh"
PALETTE_SH="${SCRIPT_DIR}/palette.sh"

# ── Build role-specific menu ───────────────────────────────────────────────

menu_title=" ⚔ Orc "

case "$role" in
  root-orch|project-orch)
    [[ -n "$project" ]] && menu_title=" ⚔ ${project} "

    # Navigate
    _menu_item "  Status dashboard" "s" "select-window -t ${SESSION}:status"
    if [[ -n "$project" ]]; then
      _menu_item "  Board view" "b" "run-shell '${ACTION_SH} nav-board ${project}'"
    fi
    _menu_separator

    # Orchestrate
    if [[ -n "$project" ]]; then
      _menu_item "▸ Check workers" "c" "run-shell '${ACTION_SH} orch-send ${window_name} ${orc_id} /orc:check'"
      _menu_item "▸ Dispatch ready" "d" "run-shell '${ACTION_SH} orch-send ${window_name} ${orc_id} /orc:dispatch'"
    fi
    _menu_separator

    _menu_item "⚡ Command palette" "Space" "run-shell '${PALETTE_SH}'"
    _menu_item "? Help" "?" "run-shell '${SCRIPT_DIR}/help.sh'"
    ;;

  goal-orch)
    [[ -n "$goal" ]] && menu_title=" ⚔ ${goal} "

    # Navigate
    if [[ -n "$project" ]]; then
      _menu_item "  Project orchestrator" "p" "select-window -t ${SESSION}:${project}"
    fi
    _menu_item "  Status dashboard" "s" "select-window -t ${SESSION}:status"
    _menu_separator

    # Orchestrate
    _menu_item "▸ Check engineers" "c" "run-shell '${ACTION_SH} orch-send ${window_name} ${orc_id} /orc:check'"
    _menu_item "▸ Dispatch beads" "d" "run-shell '${ACTION_SH} orch-send ${window_name} ${orc_id} /orc:dispatch'"
    _menu_separator

    # Confirm
    _menu_item "! Complete goal" "f" "confirm-before -p 'Complete goal ${goal:-}? This triggers delivery. (y/n)' 'run-shell \"${ACTION_SH} orch-send ${window_name} ${orc_id} /orc:complete-goal\"'"
    _menu_separator

    _menu_item "⚡ Command palette" "Space" "run-shell '${PALETTE_SH}'"
    _menu_item "? Help" "?" "run-shell '${SCRIPT_DIR}/help.sh'"
    ;;

  engineer)
    menu_title=" ● Engineer "

    # Navigate
    if [[ -n "$project" && -n "$goal" ]]; then
      _menu_item "  Goal orchestrator" "g" "run-shell '${ACTION_SH} nav-goal-pane ${window_name}'"
      _menu_item "  Project orchestrator" "p" "select-window -t ${SESSION}:${project}"
    fi
    _menu_item "  Status dashboard" "s" "select-window -t ${SESSION}:status"
    _menu_separator

    # Orchestrate
    _menu_item "▸ Mark done" "d" "run-shell '${ACTION_SH} orch-send ${window_name} ${orc_id} /orc:done'"
    _menu_item "▸ Signal blocked" "b" "run-shell '${ACTION_SH} orch-send ${window_name} ${orc_id} /orc:blocked'"
    _menu_item "▸ Read feedback" "f" "run-shell '${ACTION_SH} orch-send ${window_name} ${orc_id} /orc:feedback'"
    _menu_separator

    _menu_item "⚡ Command palette" "Space" "run-shell '${PALETTE_SH}'"
    _menu_item "? Help" "?" "run-shell '${SCRIPT_DIR}/help.sh'"
    ;;

  reviewer)
    menu_title=" ✓ Reviewer "

    # Navigate
    if [[ -n "$project" && -n "$goal" ]]; then
      _menu_item "  Goal orchestrator" "g" "run-shell '${ACTION_SH} nav-goal-pane ${window_name}'"
    fi
    _menu_item "  Status dashboard" "s" "select-window -t ${SESSION}:status"
    _menu_separator

    _menu_item "⚡ Command palette" "Space" "run-shell '${PALETTE_SH}'"
    _menu_item "? Help" "?" "run-shell '${SCRIPT_DIR}/help.sh'"
    ;;

  *)
    _menu_item "⚡ Command palette" "Space" "run-shell '${PALETTE_SH}'"
    _menu_item "? Help" "?" "run-shell '${SCRIPT_DIR}/help.sh'"
    ;;
esac

# ── Display the menu ───────────────────────────────────────────────────────

# Always anchor at bottom-left, next to the ⚔ orc logo in the status bar.
tmux display-menu -T "$menu_title" -x 0 -y S "${MENU_ARGS[@]}"
