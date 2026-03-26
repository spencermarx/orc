#!/usr/bin/env bash
# doctor.sh — Config validation, fix, and interactive agent-assisted migration.

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Config schema — single source of truth for validation
# ─────────────────────────────────────────────────────────────────────────────

# Valid config fields — one per line (bash 3.2 compatible, no associative arrays)
ORC_VALID_FIELDS="
defaults.agent_cmd
defaults.agent_flags
defaults.agent_template
defaults.yolo_flags
defaults.max_workers
planning.goal.plan_creation_instructions
planning.goal.bead_creation_instructions
planning.goal.when_to_involve_user_in_plan
dispatch.goal.assignment_instructions
approval.ask_before_dispatching
approval.ask_before_reviewing
approval.ask_before_merging
review.dev.review_instructions
review.dev.how_to_determine_if_review_passed
review.dev.max_rounds
review.goal.review_instructions
review.goal.how_to_determine_if_review_passed
review.goal.how_to_address_review_feedback
review.goal.max_rounds
branching.strategy
worktree.setup_instructions
delivery.goal.on_completion_instructions
delivery.goal.when_to_involve_user_in_delivery
agents.ruflo
tickets.strategy
notifications.system
notifications.sound
updates.check_on_launch
layout.min_pane_width
layout.min_pane_height
board.command
tui.enabled
tui.breadcrumbs
tui.show_help_hint
tui.palette.enabled
tui.palette.show_preview
tui.menu.enabled
keybindings.enabled
keybindings.project
keybindings.dashboard
keybindings.prev
keybindings.next
keybindings.palette
keybindings.menu
keybindings.help
theme.enabled
theme.mouse
theme.accent
theme.bg
theme.fg
theme.border
theme.muted
theme.activity
"

# Migration mapping: old_field=new_field|classification (one per line)
ORC_MIGRATIONS="
review.dev.verify_approval=review.dev.how_to_determine_if_review_passed|mechanical
review.goal.verify_approval=review.goal.how_to_determine_if_review_passed|mechanical
review.dev.address_feedback=review.dev.how_to_address_review_feedback|mechanical
review.goal.address_feedback=review.goal.how_to_address_review_feedback|mechanical
approval.spawn=approval.ask_before_dispatching|mechanical
approval.review=approval.ask_before_reviewing|mechanical
approval.merge=approval.ask_before_merging|mechanical
delivery.mode=delivery.goal.on_completion_instructions|semantic
delivery.target_strategy=delivery.goal.on_completion_instructions|semantic
"

# Lookup helpers
_schema_has_field() { echo "$ORC_VALID_FIELDS" | grep -qxF "$1"; }
_migration_for() { echo "$ORC_MIGRATIONS" | grep "^${1}=" | head -1 | cut -d= -f2-; }

# ─────────────────────────────────────────────────────────────────────────────
# Validation
# ─────────────────────────────────────────────────────────────────────────────

_doctor_validate_file() {
  local file="$1"
  local issues=0

  [[ -f "$file" ]] || return 0

  while IFS='=' read -r key value; do
    [[ -z "$key" ]] && continue

    # Check if key is in the migration mapping (old field)
    local migration
    migration="$(_migration_for "$key")"
    if [[ -n "$migration" ]]; then
      local new_field="${migration%%|*}"
      local classification="${migration##*|}"
      if [[ "$classification" == "mechanical" ]]; then
        printf '  ✗ %s — renamed to '\''%s'\'' [mechanical: orc doctor --fix]\n' "$key" "$new_field"
      else
        printf '  ✗ %s — replaced by '\''%s'\'' [semantic: orc doctor --interactive]\n' "$key" "$new_field"
      fi
      ((issues++)) || true
      continue
    fi

    # Check if key is valid
    if ! _schema_has_field "$key"; then
      # Try fuzzy match: find any valid field with the same section prefix
      local section_prefix="${key%.*}"
      local suggestion
      suggestion="$(echo "$ORC_VALID_FIELDS" | grep "^${section_prefix}\." | head -1)"
      if [[ -n "$suggestion" ]]; then
        printf '  ? %s — unknown field. Did you mean '\''%s'\''?\n' "$key" "$suggestion"
      else
        printf '  ? %s — unknown field\n' "$key"
      fi
      ((issues++)) || true
    fi
  done < <(_parse_toml "$file")

  return "$issues"
}

_doctor_check_git_excludes() {
  # Verify registered projects have signal-file patterns in .git/info/exclude.
  # Projects registered before v0.2.8 only have directory patterns (.beads/,
  # .worktrees/, .goals/) which don't protect signal files inside worktrees.
  local issues=0
  local signal_patterns=(".worker-status" ".worker-feedback" ".orch-assignment.md")

  local keys
  if [[ -n "${_doctor_project:-}" ]]; then
    keys="$_doctor_project"
  else
    keys="$(_project_keys)"
  fi

  for key in $keys; do
    local path
    path="$(_project_path "$key")" 2>/dev/null || continue

    local git_dir
    git_dir="$(git -C "$path" rev-parse --git-dir 2>/dev/null || true)"
    [[ -n "$git_dir" ]] || continue
    [[ "$git_dir" != /* ]] && git_dir="$path/$git_dir"

    local exclude_file="$git_dir/info/exclude"
    [[ -f "$exclude_file" ]] || continue

    local missing=()
    for pat in "${signal_patterns[@]}"; do
      if ! grep -qxF "$pat" "$exclude_file" 2>/dev/null; then
        missing+=("$pat")
      fi
    done

    if [[ ${#missing[@]} -gt 0 ]]; then
      printf '\n  %s: missing git-exclude patterns for signal files\n' "$key"
      printf '    ✗ %s\n' "${missing[@]}"
      ((issues++)) || true
    fi
  done

  return "$issues"
}

_doctor_fix_git_excludes() {
  # Apply missing signal-file patterns to all registered projects.
  # Reports exactly which patterns were added to which projects.
  local signal_patterns=(".worker-status" ".worker-feedback" ".orch-assignment.md")

  local keys
  if [[ -n "${_doctor_project:-}" ]]; then
    keys="$_doctor_project"
  else
    keys="$(_project_keys)"
  fi

  local projects_changed=0
  local projects_checked=0
  for key in $keys; do
    local path
    path="$(_project_path "$key")" 2>/dev/null || continue
    ((projects_checked++)) || true

    local git_dir
    git_dir="$(git -C "$path" rev-parse --git-dir 2>/dev/null || true)"
    [[ -n "$git_dir" ]] || continue
    [[ "$git_dir" != /* ]] && git_dir="$path/$git_dir"

    local exclude_file="$git_dir/info/exclude"

    # Detect which patterns are missing before applying
    local missing=()
    for pat in "${signal_patterns[@]}"; do
      if ! grep -qxF "$pat" "$exclude_file" 2>/dev/null; then
        missing+=("$pat")
      fi
    done

    _orc_git_exclude "$path"

    if [[ ${#missing[@]} -gt 0 ]]; then
      _info "  $key: added ${missing[*]}"
      ((projects_changed++)) || true
    fi
  done

  if [[ "$projects_changed" -gt 0 ]]; then
    _info "Git excludes: $projects_changed of $projects_checked project(s) updated."
  else
    _info "Git excludes: $projects_checked project(s) already up to date."
  fi
}

_doctor_validate() {
  local total_issues=0
  local files_checked=0

  # Check git-exclude patterns for signal files
  local exclude_issues=0
  local exclude_output
  exclude_output="$(_doctor_check_git_excludes 2>&1)" || exclude_issues=$?
  if [[ "$exclude_issues" -gt 0 ]]; then
    echo "$exclude_output"
    printf '\n  Run orc doctor --fix to add missing patterns.\n'
    total_issues=$((total_issues + exclude_issues))
  fi

  # Check config files — scoped to a project if specified
  local files=("$ORC_ROOT/config.toml")
  [[ -f "$ORC_ROOT/config.local.toml" ]] && files+=("$ORC_ROOT/config.local.toml")

  if [[ -n "${_doctor_project:-}" ]]; then
    # Scoped to one project
    local path
    path="$(_project_path "$_doctor_project")"
    [[ -f "$path/.orc/config.toml" ]] && files+=("$path/.orc/config.toml")
  else
    # All registered projects
    for key in $(_project_keys); do
      local path
      path="$(_project_path "$key")"
      [[ -f "$path/.orc/config.toml" ]] && files+=("$path/.orc/config.toml")
    done
  fi

  for file in "${files[@]}"; do
    [[ -f "$file" ]] || continue
    ((files_checked++)) || true

    # Make path relative for display
    local display_path="${file#$ORC_ROOT/}"
    [[ "$display_path" == "$file" ]] && display_path="$file"

    local file_issues=0
    local output
    output="$(_doctor_validate_file "$file" 2>&1)" || file_issues=$?

    if [[ "$file_issues" -gt 0 ]]; then
      printf '\n  %s:\n' "$display_path"
      echo "$output"
      total_issues=$((total_issues + file_issues))
    fi
  done

  if [[ "$total_issues" -eq 0 ]]; then
    _info "All configs valid. $files_checked file(s) checked."
  else
    echo ""
    _error "$files_checked file(s) checked, $total_issues issue(s) found."
    echo ""
    _info "  orc doctor --fix            Apply mechanical fixes automatically"
    _info "  orc doctor --interactive    Interactive agent-assisted migration"
  fi

  # ── TUI recommendations (non-blocking) ──────────────────────────────
  local tui_enabled
  tui_enabled="$(_config_get "tui.enabled" "true")"

  if [[ "$tui_enabled" == "true" ]]; then
    local has_recommendations=0

    # fzf recommendation for command palette
    if ! command -v fzf &>/dev/null; then
      if [[ "$has_recommendations" -eq 0 ]]; then
        echo ""
        _info "TUI recommendations:"
        has_recommendations=1
      fi
      _info "  ? fzf not found — command palette will use tmux choose-tree fallback"
      _info "    Install: brew install fzf (or see https://github.com/junegunn/fzf)"
    fi

    # iTerm2 Alt key warning when keybindings enabled
    local kb_enabled
    kb_enabled="$(_config_get "keybindings.enabled" "false")"
    if [[ "$kb_enabled" == "true" && "${TERM_PROGRAM:-}" == "iTerm.app" ]]; then
      if [[ "$has_recommendations" -eq 0 ]]; then
        echo ""
        _info "TUI recommendations:"
        has_recommendations=1
      fi
      _info "  ? iTerm2 detected with Alt keybindings enabled"
      _info "    Set 'Option key sends +Esc' in Preferences > Profiles > Keys"
    fi
  fi

  return "$total_issues"
}

# ─────────────────────────────────────────────────────────────────────────────
# Fix — apply mechanical renames and structural fixes
# ─────────────────────────────────────────────────────────────────────────────

_doctor_auto_fix_file() {
  local file="$1"
  local fixed=0

  [[ -f "$file" ]] || return 0

  local tmpfile
  tmpfile="$(mktemp)"

  # Build a sed script for all mechanical renames
  local sed_script=""
  local IFS_save="$IFS"
  IFS=$'\n'
  for mapping_line in $ORC_MIGRATIONS; do
    [[ -z "$mapping_line" ]] && continue
    local old_key="${mapping_line%%=*}"
    local rest="${mapping_line#*=}"
    local classification="${rest##*|}"
    [[ "$classification" != "mechanical" ]] && continue

    local old_field="${old_key##*.}"
    local new_key="${rest%%|*}"
    local new_field="${new_key##*.}"

    # Check if this rename applies to the file
    if grep -q "^[[:space:]]*${old_field}[[:space:]]*=" "$file" 2>/dev/null; then
      sed_script="${sed_script}s/^\\([[:space:]]*\\)${old_field}\\([[:space:]]*=\\)/\\1${new_field}\\2/;"
      ((fixed++)) || true
      _info "  Renamed: $old_field → $new_field in $(basename "$file")"
    fi
  done
  IFS="$IFS_save"

  if [[ -n "$sed_script" ]]; then
    sed "$sed_script" "$file" > "$tmpfile"
  else
    cp "$file" "$tmpfile"
  fi

  if [[ "$fixed" -gt 0 ]]; then
    mv "$tmpfile" "$file"
  else
    rm -f "$tmpfile"
  fi

  return 0
}

_doctor_auto_fix() {
  local total_fixed=0

  # Fix missing signal-file git-exclude patterns
  _doctor_fix_git_excludes

  local files=()
  [[ -f "$ORC_ROOT/config.local.toml" ]] && files+=("$ORC_ROOT/config.local.toml")

  if [[ -n "${_doctor_project:-}" ]]; then
    local path
    path="$(_project_path "$_doctor_project")"
    [[ -f "$path/.orc/config.toml" ]] && files+=("$path/.orc/config.toml")
  else
    for key in $(_project_keys); do
      local path
      path="$(_project_path "$key")"
      [[ -f "$path/.orc/config.toml" ]] && files+=("$path/.orc/config.toml")
    done
  fi

  if [[ ${#files[@]} -eq 0 ]]; then
    _info "No user config files to fix (config.toml is committed defaults)."
    return 0
  fi

  for file in "${files[@]}"; do
    _doctor_auto_fix_file "$file"
  done

  # Re-validate to show remaining issues
  echo ""
  _info "Re-validating after fix..."
  _doctor_validate || true

  # Check for remaining semantic migrations
  _info ""
  _info "Semantic migrations (if any) require 'orc doctor --interactive' for agent-assisted review."
}

# ─────────────────────────────────────────────────────────────────────────────
# Interactive mode — launch root orchestrator in doctor mode
# ─────────────────────────────────────────────────────────────────────────────

_doctor_interactive() {
  # Run programmatic fixes first, then launch agent for semantic issues
  _info "Applying programmatic fixes before launching interactive session..."
  _doctor_auto_fix
  echo ""

  # Re-validate to capture remaining issues (passed to the agent as context)
  local validation_output
  validation_output="$(_doctor_validate 2>&1)" || true

  echo "$validation_output"
  echo ""
  _info "Launching interactive migration assistant..."

  # Resolve project context for the briefing
  local project_context=""
  if [[ -n "${_doctor_project:-}" ]]; then
    local proj_path
    proj_path="$(_project_path "$_doctor_project")"
    project_context="
## Project Focus: ${_doctor_project}

You are scoped to project ${_doctor_project} at: ${proj_path}

Read this project config file and review ALL field values (not just field names):
- ${proj_path}/.orc/config.toml

Also check the global configs for context:
- ${ORC_ROOT}/config.local.toml (if it exists)
- ${ORC_ROOT}/config.toml (committed defaults)"
  fi

  # Read the authoritative schema (same as setup — config.toml IS the schema reference)
  local config_schema=""
  if [[ -f "$ORC_ROOT/config.toml" ]]; then
    config_schema="$(cat "$ORC_ROOT/config.toml")"
  fi

  # Build doctor-mode briefing — write to temp file to avoid heredoc quoting issues
  local briefing_file
  briefing_file="$(mktemp "${TMPDIR:-/tmp}/orc-doctor-briefing-XXXXXX")"

  cat > "$briefing_file" <<'STATIC_DOCTOR_EOF'
You are running in DOCTOR MODE — a temporary operating mode for config review and migration.

## Your Task

Review orc configuration for THREE types of issues:
a. Structural — wrong field names, removed sections, unknown fields
b. Content — field values that violate the WHO/WHEN/BOUNDARY documented in the schema
c. Logical — contradictions between fields, missing companions, references to nonexistent tools

## Authoritative Schema Reference

Every field below has WHO / WHEN / WHAT / BOUNDARY comments. These are the rules. When reviewing a config value, check it against the BOUNDARY for that field. If the value contains something the boundary says does not belong, that is a content issue.

--- BEGIN CONFIG SCHEMA ---
STATIC_DOCTOR_EOF

  cat "$ORC_ROOT/config.toml" >> "$briefing_file"

  cat >> "$briefing_file" <<'STATIC_DOCTOR2_EOF'
--- END CONFIG SCHEMA ---

## Your Workflow

1. Read migrations/CHANGELOG.md at the orc repo root for migration context
2. For each config file, read it FULLY and check every field value against the schema:
   - Does the value respect the WHO? (e.g., plan_creation_instructions is for the planner, not the goal orch)
   - Does the value respect the BOUNDARY? (e.g., gate fields should not contain actions, review fields should not contain delivery actions)
   - Are there logical contradictions between fields?
   - Do referenced tools/skills actually exist in the project?
   - Is there duplicate logic across fields (e.g., same ticket transition in two places)?
3. Present EVERY issue to the user. For each:
   - Show the current value
   - Explain the problem in plain language (avoid orc jargon)
   - Suggest a corrected value
   - Ask for confirmation or adjustments
4. If the user DECLINES a fix, add a TOML inline comment documenting the override:
   # orc-doctor: <issue> — user override: <rationale or "acknowledged">
5. Apply all confirmed changes
6. Run orc doctor at the end to verify structural issues are resolved

## Boundaries

- Mechanical renames (field name changes) should already be handled by --fix
- When done, this session ends
STATIC_DOCTOR2_EOF

  # Append dynamic context
  {
    echo ""
    echo "${project_context}"
    echo ""
    echo "## Validation Output (structural check)"
    echo ""
    echo "${validation_output}"
  } >> "$briefing_file"

  local briefing
  briefing="$(cat "$briefing_file")"
  rm -f "$briefing_file"

  # Doctor ALWAYS requires user confirmation for config changes, even in YOLO mode.
  # YOLO only affects the agent CLI permission flags (auto-accept tool calls), not the
  # conversational review of config changes.
  briefing="${briefing}

ALWAYS present every issue and proposed fix to the user. ALWAYS wait for confirmation before applying changes. Never silently modify config files — the user must approve each change."

  # Launch root orchestrator with doctor-mode briefing
  _require tmux "brew install tmux"
  _tmux_ensure_session

  local persona
  persona="$(_resolve_persona "root-orchestrator")"

  if _tmux_window_exists "orc"; then
    # Send doctor briefing to existing root orchestrator
    _tmux_send "orc" "$briefing"
  else
    _tmux_new_window "orc" "$ORC_ROOT"
    _launch_agent_in_window "orc" "$persona" "" "$briefing"
  fi

  _orc_goto "orc"
}

# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

# Parse arguments: orc doctor [project] [--fix|--interactive]
_doctor_project=""
_doctor_mode="validate"

for _arg in "$@"; do
  case "$_arg" in
    --fix)         _doctor_mode="fix" ;;
    --interactive) _doctor_mode="interactive" ;;
    -*)            _die "Unknown flag: $_arg. Usage: orc doctor [project] [--fix|--interactive]" "$EXIT_USAGE" ;;
    *)             _doctor_project="$_arg" ;;
  esac
done

# If a project was specified, validate it exists
if [[ -n "$_doctor_project" ]]; then
  _require_project "$_doctor_project" > /dev/null
fi

case "$_doctor_mode" in
  fix)
    _doctor_auto_fix
    ;;
  interactive)
    _doctor_interactive
    ;;
  validate)
    _doctor_validate
    ;;
esac
