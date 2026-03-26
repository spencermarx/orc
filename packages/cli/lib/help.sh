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

kb_enabled="$(_config_get "keybindings.enabled" "false")"

cat <<EOF

  ${G}${B}⚔ Orc${R}  ${D}v${ORC_VERSION:-}${R}


  ${B}Getting Around${R}

    ${G}^b Space${R}     Search windows, panes & actions
    ${G}^b m${R}         Open context menu
    ${G}^b ?${R}         This help
    ${G}Click ⚔ orc${R}  Open context menu
    ${G}Right-click${R}  Open context menu

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

echo "  ${D}Press any key to close${R}"
echo ""
read -rsn1
