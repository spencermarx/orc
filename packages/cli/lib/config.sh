#!/usr/bin/env bash
# config.sh — Open config in $EDITOR.

set -euo pipefail

if [[ $# -eq 0 ]]; then
  "${EDITOR:-vi}" "$ORC_ROOT/config.local.toml"
else
  project_path="$(_require_project "$1")"
  mkdir -p "$project_path/.orc"
  "${EDITOR:-vi}" "$project_path/.orc/config.toml"
fi
