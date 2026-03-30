#!/usr/bin/env bash
# help.sh — Help overlay for orc TUI navigation layer.
# Renders inside a tmux display-popup.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_common.sh"

set -euo pipefail

G=$'\033[32m'       # green (accent)
B=$'\033[1m'        # bold
D=$'\033[2m'        # dim
R=$'\033[0m'        # reset
Y=$'\033[33m'       # yellow (activity)

kb_enabled="$(_config_get "keybindings.enabled" "false")"

cat <<EOF

  ${G}${B}⚔ Orc${R}  ${D}Agent Orchestration Framework${R}  ${D}v${ORC_VERSION:-}${R}
  ${D}$(printf '%.0s─' {1..50})${R}

  ${B}Navigation${R}

    ${G}^b Space${R}     Command palette (fuzzy search)
    ${G}^b m${R}         Context menu (role-aware)
    ${G}^b ?${R}         This help overlay
    ${G}Click ⚔${R}      Context menu via status bar
    ${G}Right-click${R}  Context menu on any pane

EOF

if [[ "$kb_enabled" == "true" ]]; then
  kb_prev="$(_config_get "keybindings.prev" "M-[")"
  kb_next="$(_config_get "keybindings.next" "M-]")"
  kb_project="$(_config_get "keybindings.project" "M-0")"
  kb_dashboard="$(_config_get "keybindings.dashboard" "M-s")"
  _fmt() { echo "$1" | sed 's/M-/Alt+/g; s/C-/Ctrl+/g'; }
  cat <<EOF
  ${B}Shortcuts${R}

    ${G}$(_fmt "$kb_prev")${R} / ${G}$(_fmt "$kb_next")${R}    Previous / Next window
    ${G}$(_fmt "$kb_project")${R}         Project orchestrator
    ${G}$(_fmt "$kb_dashboard")${R}         Status dashboard

EOF
else
  cat <<EOF
  ${D}Alt+ shortcuts available — run ${G}orc config${R}
  ${D}and set ${G}keybindings.enabled = true${R}

EOF
fi

cat <<EOF
  ${B}tmux Basics${R}

    ${G}^b c${R}         New window
    ${G}^b n${R} / ${G}p${R}     Next / previous window
    ${G}^b d${R}         Detach (orc keeps running)
    ${G}^b [${R}         Scroll mode (${D}q${R} to exit)
    ${G}^b z${R}         Zoom pane (toggle fullscreen)

  ${B}Status Icons${R}

    ${G}●${R} working    ${Y}✓${R} review    ${G}✓${R} done
    ${D}✗${R} blocked    ${D}✗${R} dead

  ${B}Roles${R}

    ${G}⚔${R} Orchestrator — decomposes & coordinates
    ${G}●${R} Engineer     — implements beads
    ${Y}✓${R} Reviewer     — reviews completed work

  ${D}$(printf '%.0s─' {1..50})${R}
  ${D}Theme: ${G}orc config${R} ${D}→ [theme] section${R}
  ${D}Press any key to close${R}

EOF
read -rsn1
