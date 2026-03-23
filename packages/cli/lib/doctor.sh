#!/usr/bin/env bash
# doctor.sh — Config validation, auto-fix, and agent-assisted migration.

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Config schema — single source of truth for validation
# ─────────────────────────────────────────────────────────────────────────────

# Valid sections and their fields (field:type)
declare -A ORC_SCHEMA=(
  # [defaults]
  ["defaults.agent_cmd"]="string"
  ["defaults.agent_flags"]="string"
  ["defaults.agent_template"]="string"
  ["defaults.yolo_flags"]="string"
  ["defaults.max_workers"]="integer"
  # [planning.goal]
  ["planning.goal.plan_creation_instructions"]="string"
  ["planning.goal.bead_creation_instructions"]="string"
  ["planning.goal.when_to_involve_user_in_plan"]="string"
  # [dispatch.goal]
  ["dispatch.goal.assignment_instructions"]="string"
  # [approval]
  ["approval.ask_before_dispatching"]="string"
  ["approval.ask_before_reviewing"]="string"
  ["approval.ask_before_merging"]="string"
  # [review.dev]
  ["review.dev.review_instructions"]="string"
  ["review.dev.how_to_determine_if_review_passed"]="string"
  ["review.dev.max_rounds"]="integer"
  # [review.goal]
  ["review.goal.review_instructions"]="string"
  ["review.goal.how_to_determine_if_review_passed"]="string"
  ["review.goal.how_to_address_review_feedback"]="string"
  ["review.goal.max_rounds"]="integer"
  # [branching]
  ["branching.strategy"]="string"
  # [delivery.goal]
  ["delivery.goal.on_completion_instructions"]="string"
  ["delivery.goal.when_to_involve_user_in_delivery"]="string"
  # [agents]
  ["agents.ruflo"]="string"
  # [tickets]
  ["tickets.strategy"]="string"
  # [notifications]
  ["notifications.system"]="boolean"
  ["notifications.sound"]="boolean"
  # [updates]
  ["updates.check_on_launch"]="boolean"
  # [layout]
  ["layout.min_pane_width"]="integer"
  ["layout.min_pane_height"]="integer"
  # [board]
  ["board.command"]="string"
  # [theme]
  ["theme.enabled"]="boolean"
  ["theme.mouse"]="boolean"
  ["theme.accent"]="string"
  ["theme.bg"]="string"
  ["theme.fg"]="string"
  ["theme.border"]="string"
  ["theme.muted"]="string"
  ["theme.activity"]="string"
)

# Migration mapping: old_field → new_field | classification (mechanical|semantic)
declare -A ORC_MIGRATIONS=(
  # Review renames (mechanical)
  ["review.dev.verify_approval"]="review.dev.how_to_determine_if_review_passed|mechanical"
  ["review.goal.verify_approval"]="review.goal.how_to_determine_if_review_passed|mechanical"
  ["review.dev.address_feedback"]="review.dev.how_to_address_review_feedback|mechanical"
  ["review.goal.address_feedback"]="review.goal.how_to_address_review_feedback|mechanical"
  # Approval renames (mechanical)
  ["approval.spawn"]="approval.ask_before_dispatching|mechanical"
  ["approval.review"]="approval.ask_before_reviewing|mechanical"
  ["approval.merge"]="approval.ask_before_merging|mechanical"
  # Delivery replacements (semantic)
  ["delivery.mode"]="delivery.goal.on_completion_instructions|semantic"
  ["delivery.target_strategy"]="delivery.goal.on_completion_instructions|semantic"
)

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
    if [[ -n "${ORC_MIGRATIONS[$key]+x}" ]]; then
      local mapping="${ORC_MIGRATIONS[$key]}"
      local new_field="${mapping%%|*}"
      local classification="${mapping##*|}"
      if [[ "$classification" == "mechanical" ]]; then
        printf '  ✗ %s — renamed to '\''%s'\'' [mechanical: orc doctor --auto-fix]\n' "$key" "$new_field"
      else
        printf '  ✗ %s — replaced by '\''%s'\'' [semantic: orc doctor --fix]\n' "$key" "$new_field"
      fi
      ((issues++)) || true
      continue
    fi

    # Check if key is valid
    if [[ -z "${ORC_SCHEMA[$key]+x}" ]]; then
      # Try fuzzy match for typo detection
      local suggestion=""
      for valid_key in "${!ORC_SCHEMA[@]}"; do
        # Simple prefix match for suggestions
        if [[ "$valid_key" == "${key%.*}."* ]]; then
          suggestion="$valid_key"
          break
        fi
      done
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

_doctor_validate() {
  local total_issues=0
  local files_checked=0

  # Check all config files in resolution chain
  local files=("$ORC_ROOT/config.toml")
  [[ -f "$ORC_ROOT/config.local.toml" ]] && files+=("$ORC_ROOT/config.local.toml")

  # Check registered project configs
  for key in $(_project_keys); do
    local path
    path="$(_project_path "$key")"
    [[ -f "$path/.orc/config.toml" ]] && files+=("$path/.orc/config.toml")
  done

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
    _info "  orc doctor --auto-fix    Apply mechanical renames automatically"
    _info "  orc doctor --fix         Interactive agent-assisted migration"
  fi

  return "$total_issues"
}

# ─────────────────────────────────────────────────────────────────────────────
# Auto-fix — apply mechanical renames
# ─────────────────────────────────────────────────────────────────────────────

_doctor_auto_fix_file() {
  local file="$1"
  local fixed=0

  [[ -f "$file" ]] || return 0

  local tmpfile
  tmpfile="$(mktemp)"

  while IFS= read -r line || [[ -n "$line" ]]; do
    local modified=0
    for old_key in "${!ORC_MIGRATIONS[@]}"; do
      local mapping="${ORC_MIGRATIONS[$old_key]}"
      local classification="${mapping##*|}"
      [[ "$classification" != "mechanical" ]] && continue

      local new_key="${mapping%%|*}"
      # Extract just the field name (last segment after last dot)
      local old_field="${old_key##*.}"
      local new_field="${new_key##*.}"

      if [[ "$line" =~ ^[[:space:]]*${old_field}[[:space:]]*= ]]; then
        line="${line/$old_field/$new_field}"
        ((fixed++)) || true
        modified=1
        _info "  Renamed: $old_field → $new_field in $(basename "$file")"
      fi
    done
    printf '%s\n' "$line"
  done < "$file" > "$tmpfile"

  if [[ "$fixed" -gt 0 ]]; then
    mv "$tmpfile" "$file"
  else
    rm -f "$tmpfile"
  fi

  return 0
}

_doctor_auto_fix() {
  local total_fixed=0

  local files=()
  [[ -f "$ORC_ROOT/config.local.toml" ]] && files+=("$ORC_ROOT/config.local.toml")

  for key in $(_project_keys); do
    local path
    path="$(_project_path "$key")"
    [[ -f "$path/.orc/config.toml" ]] && files+=("$path/.orc/config.toml")
  done

  if [[ ${#files[@]} -eq 0 ]]; then
    _info "No user config files to fix (config.toml is committed defaults)."
    return 0
  fi

  for file in "${files[@]}"; do
    _doctor_auto_fix_file "$file"
  done

  # Re-validate to show remaining issues
  echo ""
  _info "Re-validating after auto-fix..."
  _doctor_validate || true

  # Check for remaining semantic migrations
  _info ""
  _info "Semantic migrations (if any) require 'orc doctor --fix' for interactive assistance."
}

# ─────────────────────────────────────────────────────────────────────────────
# Fix mode — launch root orchestrator in doctor mode
# ─────────────────────────────────────────────────────────────────────────────

_doctor_fix() {
  # Run fast validation first to capture output
  local validation_output
  validation_output="$(_doctor_validate 2>&1)" || true

  if echo "$validation_output" | grep -q "All configs valid"; then
    echo "$validation_output"
    return 0
  fi

  echo "$validation_output"
  echo ""
  _info "Launching interactive migration assistant..."

  # Build doctor-mode briefing for the root orchestrator
  local briefing
  briefing="$(cat <<DOCTOR_EOF
You are running in DOCTOR MODE — a temporary operating mode for config migration.

## Your Task

Help the user migrate their orc configuration to the current schema. You have:

1. **Validation output** showing which config files have issues:
$validation_output

2. **Breaking changelog** at: $ORC_ROOT/migrations/CHANGELOG.md
   Read this to understand what changed, why, and the migration path for each field.

3. **Affected config files** — read each one to understand the user's current setup.

## Your Workflow

1. Read migrations/CHANGELOG.md for migration context
2. For each affected config file, read the full file to understand the user's intent
3. Present each semantic migration to the user conversationally:
   - Show the old config
   - Explain what changed and why
   - Suggest the new config based on their current values
   - Ask for confirmation or adjustments
4. Apply confirmed changes (edit the config files directly)
5. Run \`orc doctor\` at the end to verify all issues are resolved

## Delegation Model Awareness

When reviewing or suggesting lifecycle hook values, keep the delegation model in mind:

- plan_creation_instructions: executed by a PLANNER sub-agent, not the goal orchestrator. Slash commands and conditional logic are valid. The planner evaluates conditions and runs tools in the goal worktree.
- review_instructions: executed by a REVIEWER sub-agent, not the goal orchestrator.
- bead_creation_instructions: read by the goal orchestrator to guide plan-to-bead decomposition.
- assignment_instructions in [dispatch.goal]: read by the goal orchestrator when writing engineer assignments.
- on_completion_instructions: executed by the goal orchestrator directly (delivery actions).

If you see config values that assume the goal orchestrator runs planning tools directly (e.g., step-by-step instructions mixing planning tool execution with bead decomposition in a single field), suggest splitting them: planning tool directives go in plan_creation_instructions, decomposition conventions go in bead_creation_instructions.

## Boundaries

- Mechanical renames should already be handled by --auto-fix
- When done, this session ends — do not transition to normal root orchestrator mode
DOCTOR_EOF
)"

  # Add YOLO hint if active
  if [[ "${ORC_YOLO:-0}" == "1" ]]; then
    briefing="${briefing}

## YOLO Mode Active

You are in YOLO mode. Do NOT ask for confirmation. Read the breaking changelog, read each affected config file, determine the best migration for each semantic field based on context, apply all changes immediately, and run \`orc doctor\` to verify. Present a summary of what you changed for awareness but do not wait for approval."
  else
    briefing="${briefing}

Never silently apply semantic changes — always present and confirm with the user."
  fi

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

case "${1:-}" in
  --auto-fix)
    _doctor_auto_fix
    ;;
  --fix)
    _doctor_fix
    ;;
  *)
    _doctor_validate || exit 0
    ;;
esac
