#!/usr/bin/env bash
# palette.sh — Command palette for orc TUI navigation layer.
# Fuzzy-search windows/panes with fzf-tmux popup, or fall back to choose-tree.
# Navigation-only: never sends input to agent panes.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_common.sh"

set -euo pipefail

readonly SESSION="${ORC_TMUX_SESSION:-orc}"

# ── Theme colors for ANSI output ───────────────────────────────────────────

accent="$(_config_get "theme.accent" "#00ff88")"
# Map hex accent to nearest ANSI — use green (close to #00ff88)
C_ACCENT=$'\033[32m'
C_MUTED=$'\033[90m'
C_BOLD=$'\033[1m'
C_RESET=$'\033[0m'
C_CYAN=$'\033[36m'
C_YELLOW=$'\033[33m'

# ── Fallback: choose-tree when fzf is not available ────────────────────────

if ! command -v fzf &>/dev/null; then
  tmux choose-tree -s -f "#{==:#{session_name},${SESSION}}" \
    -F "#{?@orc_id,#{@orc_id},#{window_name}} #{?@orc_status,#{@orc_status},}"
  exit 0
fi

# ── Build entries ──────────────────────────────────────────────────────────
# Format: display_col1 \t display_col2 \t display_col3 \t meta_type \t meta_win \t meta_pane
# fzf --with-nth=1,2,3 hides columns 4-6

entries=""

while IFS='|' read -r win_idx win_name; do
  [[ "$win_name" == "_orc_init" ]] && continue

  win_role=""
  case "$win_name" in
    orc)     win_role="root-orch" ;;
    status)  win_role="dashboard" ;;
    *board*) win_role="board" ;;
    */*)     win_role="goal" ;;
    *)       win_role="project-orch" ;;
  esac

  pane_count="$(tmux list-panes -t "${SESSION}:${win_name}" 2>/dev/null | wc -l | tr -d ' ')"

  if (( pane_count <= 1 )) || [[ "$win_role" != "goal" ]]; then
    # Icon + role label
    icon="${C_ACCENT}⚔${C_RESET}"
    [[ "$win_role" == "dashboard" ]] && icon="${C_CYAN}◆${C_RESET}"
    [[ "$win_role" == "board" ]] && icon="${C_CYAN}◆${C_RESET}"

    role_label="${C_MUTED}${win_role}${C_RESET}"
    name_display="${C_BOLD}${win_name}${C_RESET}"
    status_icon="$(tmux show-option -t "${SESSION}:${win_name}" -w -v @orc_status 2>/dev/null || true)"

    # Tab-separated: field1=icon+role, field2=name, field3=status, field4+=metadata
    entries+="${icon} ${role_label}	${name_display}	${status_icon}	window	${win_name}	"$'\n'
  else
    # Goal window: list individual panes
    while IFS='|' read -r pane_idx pane_title; do
      orc_id="$(tmux show-option -t "${SESSION}:${win_name}.${pane_idx}" -p -v @orc_id 2>/dev/null || true)"
      [[ -z "$orc_id" ]] && orc_id="$pane_title"

      case "$orc_id" in
        goal:*)   icon="${C_ACCENT}⚔${C_RESET}"; role_label="${C_MUTED}goal-orch${C_RESET}" ;;
        eng:*)    icon="${C_YELLOW}●${C_RESET}"; role_label="${C_MUTED}engineer${C_RESET}" ;;
        review:*) icon="${C_CYAN}✓${C_RESET}"; role_label="${C_MUTED}reviewer${C_RESET}" ;;
        *)        icon="${C_MUTED}·${C_RESET}"; role_label="${C_MUTED}pane${C_RESET}" ;;
      esac

      short_id="${orc_id#*: }"
      name_display="${C_BOLD}${win_name}${C_RESET} ${C_MUTED}/${C_RESET} ${short_id}"

      entries+="${icon} ${role_label}	${name_display}		pane	${win_name}	${pane_idx}"$'\n'
    done < <(tmux list-panes -t "${SESSION}:${win_name}" -F '#{pane_index}|#{pane_title}' 2>/dev/null)
  fi
done < <(tmux list-windows -t "$SESSION" -F '#{window_index}|#{window_name}' 2>/dev/null)

# Quick actions — visually distinct
entries+="${C_CYAN}◆${C_RESET} ${C_MUTED}action${C_RESET}	${C_BOLD}Status dashboard${C_RESET}		window	status	"$'\n'
entries+="${C_CYAN}◆${C_RESET} ${C_MUTED}action${C_RESET}	${C_BOLD}Help${C_RESET} ${C_MUTED}— keybindings & commands${C_RESET}		action	help	"$'\n'

[[ -z "$entries" ]] && exit 0

# ── fzf ────────────────────────────────────────────────────────────────────

show_preview="$(_config_get "tui.palette.show_preview" "true")"
PREVIEW_SH="${SCRIPT_DIR}/palette-preview.sh"

tmpfile="$(mktemp)"
outfile="$(mktemp)"
trap 'rm -f "$tmpfile" "$outfile"' EXIT

echo "$entries" | grep -v '^$' > "$tmpfile"

fzf_args=(
  --ansi
  --delimiter='	'
  --with-nth=1,2,3
  --header=" Navigate to any window, pane, or action"
  --header-first
  --no-info
  --reverse
  --border=rounded
  --border-label=" ⚔ Command Palette "
  --border-label-pos=2
  --prompt="  "
  --pointer="▸"
  --color="border:green,label:green,header:grey,prompt:green,pointer:green"
)

if [[ "$show_preview" == "true" ]]; then
  fzf_args+=(
    --preview "$PREVIEW_SH {}"
    --preview-window "right:40%:wrap:border-left"
    --preview-label=" Preview "
  )
fi

# fzf-tmux -p creates its own popup with proper TTY handling
fzf-tmux -p 85%,75% "${fzf_args[@]}" < "$tmpfile" > "$outfile" || true

selected="$(cat "$outfile")"
[[ -z "$selected" ]] && exit 0

# ── Handle selection ───────────────────────────────────────────────────────

sel_type="$(echo "$selected" | awk -F'	' '{print $4}')"
sel_win="$(echo "$selected" | awk -F'	' '{print $5}')"
sel_pane="$(echo "$selected" | awk -F'	' '{print $6}')"

case "$sel_type" in
  window)
    tmux select-window -t "${SESSION}:${sel_win}" 2>/dev/null || true
    ;;
  pane)
    tmux select-window -t "${SESSION}:${sel_win}" 2>/dev/null || true
    tmux select-pane -t "${SESSION}:${sel_win}.${sel_pane}" 2>/dev/null || true
    ;;
  action)
    case "$sel_win" in
      help) "${SCRIPT_DIR}/help.sh" ;;
      *)    tmux select-window -t "${SESSION}:${sel_win}" 2>/dev/null || true ;;
    esac
    ;;
esac
