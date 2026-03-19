#!/usr/bin/env bash
# remove.sh — Unregister a project from projects.toml.

if [[ $# -ne 1 ]]; then
  _die "Usage: orc remove <key>" "$EXIT_USAGE"
fi

key="$1"
existing="$(_project_path "$key")"
if [[ -z "$existing" ]]; then
  _die "Project '$key' not found." "$EXIT_NO_PROJECT"
fi

projects_file="$(_projects_file)"

# Remove the [projects.<key>] section and its path line
if _is_macos; then
  sed -i '' "/^\[projects\.${key}\]$/,/^$/d" "$projects_file"
else
  sed -i "/^\[projects\.${key}\]$/,/^$/d" "$projects_file"
fi

_info "Removed project '$key'"
