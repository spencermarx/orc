#!/usr/bin/env bash
# add.sh — Register a project in projects.toml.

if [[ $# -ne 2 ]]; then
  _die "Usage: orc add <key> <path>" "$EXIT_USAGE"
fi

key="$1"
path="$2"

if _is_reserved_name "$key"; then
  _die "Cannot use '$key' as a project key — it conflicts with an orc subcommand." "$EXIT_USAGE"
fi

if [[ ! -d "$path" ]]; then
  _die "Path does not exist: $path" "$EXIT_USAGE"
fi

path="$(cd "$path" && pwd)"

projects_file="$(_projects_file)"
if [[ ! -f "$projects_file" ]]; then
  cat > "$projects_file" <<'TOML'
# Orc — project registry (gitignored)
TOML
fi

existing="$(_project_path "$key")"
if [[ -n "$existing" ]]; then
  _die "Project '$key' is already registered (path: $existing)" "$EXIT_STATE"
fi

printf '\n[projects.%s]\npath = "%s"\n' "$key" "$path" >> "$projects_file"

# Bootstrap beads if not initialized
if command -v bd &>/dev/null && [[ ! -d "$path/.beads" ]]; then
  _info "Initializing beads in $path..."
  bd -C "$path" init 2>/dev/null || _warn "Could not initialize beads. Run 'bd init' in the project manually."
fi

_info "Added project '$key' → $path"
