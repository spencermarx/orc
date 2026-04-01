#!/usr/bin/env bash
# chooser.sh — Hierarchical window chooser for orc TUI.
# Tree-structured popup showing Project → Goal → Engineer hierarchy
# with live status indicators. Navigation-only: never sends input to agent panes.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_common.sh"

set -euo pipefail

readonly SESSION="${ORC_TMUX_SESSION:-orc}"

# ── Theme colors for ANSI output ───────────────────────────────────────────

C_ACCENT=$'\033[32m'
C_MUTED=$'\033[90m'
C_BOLD=$'\033[1m'
C_RESET=$'\033[0m'
C_CYAN=$'\033[36m'
C_YELLOW=$'\033[33m'
C_RED=$'\033[31m'

# ── Fallback: choose-tree when fzf is not available ────────────────────────

if ! command -v fzf-tmux &>/dev/null; then
  tmux choose-tree -s -f "#{==:#{session_name},${SESSION}}" \
    -F "#{?@orc_id,#{@orc_id},#{window_name}} #{?@orc_status,#{@orc_status},}"
  exit 0
fi

# ── Collect window data ───────────────────────────────────────────────────

# Build entries grouped by project using temp files (bash 3.2 compatible).
# Format per entry: display \t meta_type \t meta_win \t meta_pane
# fzf --with-nth=1 hides columns 2-4.

entries=""
group_dir="$(mktemp -d "${TMPDIR:-/tmp}/orc-chooser-XXXXXX")"
trap 'rm -rf "$group_dir"' EXIT
project_order=""

while IFS='|' read -r win_name; do
  [[ "$win_name" == "_orc_init" ]] && continue

  case "$win_name" in
    # ── System windows ──
    orc)
      status_icon="$(tmux show-option -t "${SESSION}:${win_name}" -w -v @orc_status 2>/dev/null || true)"
      entries+="  ${C_ACCENT}⚔${C_RESET} ${C_BOLD}root${C_RESET} ${status_icon}	window	${win_name}	"$'\n'
      ;;
    status)
      entries+="  ${C_CYAN}◆${C_RESET} ${C_BOLD}status${C_RESET}	window	${win_name}	"$'\n'
      ;;

    # ── Goal windows ──
    */*)
      local_project="${win_name%%/*}"
      # Track project order
      if [[ ! -f "$group_dir/$local_project" ]]; then
        project_order+="$local_project"$'\n'
        touch "$group_dir/$local_project"
      fi

      status_icon="$(tmux show-option -t "${SESSION}:${win_name}" -w -v @orc_status 2>/dev/null || true)"
      short="$(tmux show-option -t "${SESSION}:${win_name}" -w -v @orc_short 2>/dev/null || echo "$win_name")"
      goal_part="${win_name#*/}"

      # Board windows (exact match: {project}/board)
      if [[ "$win_name" == */board ]]; then
        echo "    ${C_CYAN}◆${C_RESET} ${C_MUTED}board${C_RESET}	window	${win_name}	" >> "$group_dir/$local_project"
        continue
      fi

      # Goal status from orc-state (strip overflow suffix :N for lookup)
      goal_status=""
      goal_lookup="$goal_part"
      [[ "$goal_lookup" =~ :[0-9]+$ ]] && goal_lookup="${goal_lookup%:*}"
      proj_path="$(_project_path "$local_project" 2>/dev/null || true)"
      if [[ -n "$proj_path" ]]; then
        gs="$(_goal_worker_status "$proj_path" "$goal_lookup" 2>/dev/null || echo "")"
        case "$gs" in
          working*)  goal_status="${C_ACCENT}● working${C_RESET}" ;;
          review*)   goal_status="${C_YELLOW}✓ review${C_RESET}" ;;
          blocked*)  goal_status="${C_RED}✗ blocked${C_RESET}" ;;
          done*)     goal_status="${C_ACCENT}✓ done${C_RESET}" ;;
          unknown)
            if _tmux_is_dead_window "$win_name" 2>/dev/null; then
              goal_status="${C_RED}✗ dead${C_RESET}"
            fi
            ;;
        esac
      fi

      echo "    ${C_ACCENT}◆${C_RESET} ${C_BOLD}${short}${C_RESET} ${C_MUTED}${goal_part}${C_RESET}  ${goal_status}	window	${win_name}	" >> "$group_dir/$local_project"

      # List panes within goal window
      pane_count="$(tmux list-panes -t "${SESSION}:${win_name}" 2>/dev/null | wc -l | tr -d ' ')"
      if (( pane_count > 1 )); then
        while IFS='|' read -r pane_idx pane_title; do
          orc_id="$(tmux show-option -t "${SESSION}:${win_name}.${pane_idx}" -p -v @orc_id 2>/dev/null || true)"
          [[ -z "$orc_id" ]] && orc_id="$pane_title"

          pane_icon="${C_MUTED}·${C_RESET}"
          case "$orc_id" in
            goal:*)   pane_icon="${C_ACCENT}⚔${C_RESET}" ;;
            eng:*)    pane_icon="${C_YELLOW}●${C_RESET}" ;;
            review:*) pane_icon="${C_CYAN}✓${C_RESET}" ;;
          esac

          short_id="${orc_id#*: }"
          echo "      └ ${pane_icon} ${C_MUTED}${short_id}${C_RESET}	pane	${win_name}	${pane_idx}" >> "$group_dir/$local_project"
        done < <(tmux list-panes -t "${SESSION}:${win_name}" -F '#{pane_index}|#{pane_title}' 2>/dev/null)
      fi
      ;;

    # ── Project orchestrator windows ──
    *)
      local_project="$win_name"
      if [[ ! -f "$group_dir/$local_project" ]]; then
        project_order+="$local_project"$'\n'
        touch "$group_dir/$local_project"
      fi
      status_icon="$(tmux show-option -t "${SESSION}:${win_name}" -w -v @orc_status 2>/dev/null || true)"
      # Prepend project orch to its group file (should appear first)
      tmp_prepend="$(mktemp)"
      echo "  ${C_ACCENT}⚔${C_RESET} ${C_BOLD}${win_name}${C_RESET} ${status_icon}	window	${win_name}	" > "$tmp_prepend"
      cat "$group_dir/$local_project" >> "$tmp_prepend" 2>/dev/null || true
      mv "$tmp_prepend" "$group_dir/$local_project"
      ;;
  esac
done < <(tmux list-windows -t "$SESSION" -F '#{window_name}' 2>/dev/null)

# Assemble entries by project
while IFS= read -r proj; do
  [[ -z "$proj" ]] && continue
  [[ -f "$group_dir/$proj" ]] || continue
  while IFS= read -r line; do
    entries+="$line"$'\n'
  done < "$group_dir/$proj"
done <<< "$project_order"

rm -rf "$group_dir"

[[ -z "$entries" ]] && exit 0

# ── fzf ────────────────────────────────────────────────────────────────────

tmpfile="$(mktemp)"
outfile="$(mktemp)"
trap 'rm -f "$tmpfile" "$outfile"; rm -rf "$group_dir"' EXIT

printf '%s' "$entries" | grep -v '^$' > "$tmpfile"

# Theme-aware fzf colors
bg="$(_config_get "theme.bg" "#0d1117")"
fg="$(_config_get "theme.fg" "#8b949e")"
accent="$(_config_get "theme.accent" "#00ff88")"
bg_hl="$(_config_get "theme.bg_highlight" "#1c2128")"
muted_hex="$(_config_get "theme.muted" "#6e7681")"

fzf_args=(
  --ansi
  --delimiter='	'
  --with-nth=1
  --no-sort
  --tiebreak=index
  --header=" Navigate to any window or pane"
  --header-first
  --no-info
  --reverse
  --border=rounded
  --border-label=" ⚔ Window Chooser "
  --border-label-pos=2
  --prompt=" ⚔ "
  --pointer="▸"
  --color="bg:${bg},fg:${fg},hl:${accent}"
  --color="bg+:${bg_hl},fg+:white,hl+:${accent}"
  --color="border:${accent},label:${accent}"
  --color="header:${muted_hex},prompt:${accent},pointer:${accent}"
  --color="info:${muted_hex},spinner:${accent}"
  --color="gutter:${bg}"
)

fzf-tmux -p 70%,60% "${fzf_args[@]}" < "$tmpfile" > "$outfile" || true

selected="$(cat "$outfile")"
[[ -z "$selected" ]] && exit 0

# ── Handle selection ───────────────────────────────────────────────────────

sel_type="$(echo "$selected" | awk -F'	' '{print $2}')"
sel_win="$(echo "$selected" | awk -F'	' '{print $3}')"
sel_pane="$(echo "$selected" | awk -F'	' '{print $4}')"

case "$sel_type" in
  window)
    tmux select-window -t "${SESSION}:${sel_win}" 2>/dev/null || true
    ;;
  pane)
    tmux select-window -t "${SESSION}:${sel_win}" 2>/dev/null || true
    tmux select-pane -t "${SESSION}:${sel_win}.${sel_pane}" 2>/dev/null || true
    ;;
esac
