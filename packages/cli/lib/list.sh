#!/usr/bin/env bash
# list.sh — Show registered projects with worker counts.

_info "Registered projects:"
echo ""

keys="$(_project_keys)"
if [[ -z "$keys" ]]; then
  _info "  (none — run 'orc add <key> <path>' to register a project)"
  exit "$EXIT_OK"
fi

for key in $keys; do
  path="$(_project_path "$key")"
  workers="$(_worker_count "$path")"
  max="$(_config_get "defaults.max_workers" "3" "$path")"
  printf '  %-20s %s  (%s/%s workers)\n' "$key" "$path" "$workers" "$max"
done
echo ""
