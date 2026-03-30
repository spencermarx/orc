#!/usr/bin/env bash
# splash.sh — Branded welcome screen for orc tmux sessions.
# Compatible with bash 3.2+ (macOS).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_common.sh"

set -euo pipefail

accent="$(_config_get "theme.accent" "#00ff88")"

# 24-bit ANSI color from hex
r=$((16#${accent:1:2}))
g=$((16#${accent:3:2}))
b=$((16#${accent:5:2}))
C="\033[38;2;${r};${g};${b}m"
D=$'\033[2m'
B=$'\033[1m'
R=$'\033[0m'

art_file="$ORC_ROOT/assets/ascii-art.txt"
logo_file="$ORC_ROOT/assets/ascii-orc.txt"

subtitle="Agent Orchestration Framework"
version="v${ORC_VERSION}"
sub_line="${subtitle}  ${version}"
footer="Press any key to continue"

# Wait for tmux client to attach so pane gets real terminal size
for _i in $(seq 1 50); do
  if tmux list-clients -t "$ORC_TMUX_SESSION" 2>/dev/null | grep -q .; then
    sleep 0.3
    break
  fi
  sleep 0.1
done

clear
tput civis 2>/dev/null || true

# Pane dimensions via stty (reads from pty, accurate after attach)
rows="$(stty size 2>/dev/null | awk '{print $1}')"
cols="$(stty size 2>/dev/null | awk '{print $2}')"
rows="${rows:-40}"
cols="${cols:-80}"

# Measure widths using ${#line} — all chars in these files are single-width Unicode
art_width=0
art_height=0
while IFS= read -r line; do
  (( ${#line} > art_width )) && art_width=${#line}
  ((art_height++)) || true
done < "$art_file"

logo_width=0
logo_height=0
while IFS= read -r line; do
  (( ${#line} > logo_width )) && logo_width=${#line}
  ((logo_height++)) || true
done < "$logo_file"

# Total content height: art + 2 blanks + logo + 1 blank + subtitle + 1 blank + footer
content_height=$(( art_height + 2 + logo_height + 1 + 1 + 1 + 1 ))

top_pad=$(( (rows - content_height) / 2 ))
(( top_pad < 1 )) && top_pad=1

art_hpad=$(( (cols - art_width) / 2 ))
(( art_hpad < 0 )) && art_hpad=0

logo_hpad=$(( (cols - logo_width) / 2 ))
(( logo_hpad < 0 )) && logo_hpad=0

sub_hpad=$(( (cols - ${#sub_line}) / 2 ))
(( sub_hpad < 0 )) && sub_hpad=0

foot_hpad=$(( (cols - ${#footer}) / 2 ))
(( foot_hpad < 0 )) && foot_hpad=0

# Render — vertical pad
_n=0; while (( _n < top_pad )); do echo; ((_n++)) || true; done

# Art
while IFS= read -r line; do
  printf "%*s${C}%s${R}\n" "$art_hpad" "" "$line"
done < "$art_file"

echo
echo

# ORC logo
while IFS= read -r line; do
  printf "%*s${C}${B}%s${R}\n" "$logo_hpad" "" "$line"
done < "$logo_file"

echo

# Subtitle + version
printf "%*s${D}%s${R}\n" "$sub_hpad" "" "$sub_line"

echo

# Footer
printf "%*s${D}%s${R}\n" "$foot_hpad" "" "$footer"

# Wait for keypress, flush any remaining input, reset terminal
read -rsn1
# Drain any buffered keystrokes so they don't leak to the next process
while read -rsn1 -t 0.1 2>/dev/null; do :; done
tput cnorm 2>/dev/null || true
stty sane 2>/dev/null || true
