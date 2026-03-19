#!/usr/bin/env bats
# Smoke tests for the Ruflo integration in _common.sh
#
# Covers all 4 scenarios from Phase 4 of the Ruflo integration spec:
#   4.1 ruflo=off  → zero Ruflo references
#   4.2 ruflo=auto  + Ruflo absent → silent no-op
#   4.3 ruflo=require + Ruflo absent → clear error with install instructions
#   4.4 ruflo=auto  + Ruflo present → detection + MCP registration + persona enhancement

# ─── Test helpers ────────────────────────────────────────────────────────────

setup() {
  TEST_DIR="$(mktemp -d)"

  # Minimal orc repo so ORC_ROOT resolves
  mkdir -p "$TEST_DIR/orc-root/packages/cli/lib"
  cp "$BATS_TEST_DIRNAME/../lib/_common.sh" "$TEST_DIR/orc-root/packages/cli/lib/"
  cp "$BATS_TEST_DIRNAME/../../../config.toml" "$TEST_DIR/orc-root/config.toml"

  # Fake project with .orc/ config
  mkdir -p "$TEST_DIR/project/.orc"

  # Mock bin directory
  mkdir -p "$TEST_DIR/bin"
}

teardown() {
  rm -rf "$TEST_DIR"
}

_write_project_config() {
  cat > "$TEST_DIR/project/.orc/config.toml" <<EOF
[agents]
ruflo = "$1"
EOF
}

# Run a bash snippet that sources _common.sh in a clean subprocess.
# ORC_ROOT is readonly, so we must always use a fresh process.
_in_orc_env() {
  local snippet="$1"
  bash -c '
    set -euo pipefail
    export ORC_ROOT="'"$TEST_DIR/orc-root"'"
    # Source _common.sh — it will try to resolve ORC_ROOT from BASH_SOURCE
    # but we pre-export it so the readonly assignment matches.
    source "$ORC_ROOT/packages/cli/lib/_common.sh"
    '"$snippet"'
  ' 2>&1
}

# Same but with a controlled PATH (strip ruflo/npx from resolution)
_in_orc_env_no_ruflo() {
  local snippet="$1"
  bash -c '
    set -euo pipefail
    export ORC_ROOT="'"$TEST_DIR/orc-root"'"

    # Minimal PATH: only system binaries (no ruflo, no npx)
    # We need grep, cut, tail, cat, printf, mktemp — all in /usr/bin or /bin
    export PATH="/usr/bin:/bin"

    source "$ORC_ROOT/packages/cli/lib/_common.sh"
    '"$snippet"'
  ' 2>&1
}

# Same but with our mock bin dir prepended to PATH
_in_orc_env_with_bin() {
  local snippet="$1"
  bash -c '
    set -euo pipefail
    export ORC_ROOT="'"$TEST_DIR/orc-root"'"
    export PATH="'"$TEST_DIR/bin"':/usr/bin:/bin"
    source "$ORC_ROOT/packages/cli/lib/_common.sh"
    '"$snippet"'
  ' 2>&1
}

# ─── 4.1: ruflo=off → zero Ruflo references ─────────────────────────────────

@test "4.1: ruflo=off — _detect_ruflo sets ORC_RUFLO_AVAILABLE=0" {
  _write_project_config "off"

  run _in_orc_env '
    _detect_ruflo "'"$TEST_DIR/project"'"
    echo "RESULT=$ORC_RUFLO_AVAILABLE"
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"RESULT=0"* ]]
}

@test "4.1: ruflo=off — _ruflo_persona_block returns empty" {
  run _in_orc_env '
    export ORC_RUFLO_AVAILABLE=0
    result="$(_ruflo_persona_block)"
    [ -z "$result" ] && echo "EMPTY" || echo "NOT_EMPTY"
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"EMPTY"* ]]
}

@test "4.1: ruflo=off — _ensure_ruflo_mcp is a no-op" {
  run _in_orc_env '
    export ORC_RUFLO_AVAILABLE=0
    _ensure_ruflo_mcp
    echo "OK"
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK"* ]]
}

@test "4.1: ruflo unset (default config) — treated as off" {
  # No project config — defaults to config.toml which has ruflo = "off"

  run _in_orc_env '
    _detect_ruflo "'"$TEST_DIR/project"'"
    echo "RESULT=$ORC_RUFLO_AVAILABLE"
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"RESULT=0"* ]]
}

# ─── 4.2: ruflo=auto + Ruflo absent → silent no-op ──────────────────────────

@test "4.2: ruflo=auto without ruflo — ORC_RUFLO_AVAILABLE=0" {
  _write_project_config "auto"

  run _in_orc_env_no_ruflo '
    _detect_ruflo "'"$TEST_DIR/project"'"
    echo "RESULT=$ORC_RUFLO_AVAILABLE"
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"RESULT=0"* ]]
}

@test "4.2: ruflo=auto without ruflo — no warnings on stderr" {
  _write_project_config "auto"

  local stderr_file="$TEST_DIR/stderr.log"
  bash -c '
    set -euo pipefail
    export ORC_ROOT="'"$TEST_DIR/orc-root"'"
    export PATH="/usr/bin:/bin"
    source "$ORC_ROOT/packages/cli/lib/_common.sh"
    _detect_ruflo "'"$TEST_DIR/project"'"
  ' >/dev/null 2>"$stderr_file" || true

  # No ruflo-related warnings should appear
  ! grep -iq "ruflo" "$stderr_file" 2>/dev/null || [ ! -s "$stderr_file" ]
}

@test "4.2: ruflo=auto without ruflo — persona block is empty" {
  run _in_orc_env '
    export ORC_RUFLO_AVAILABLE=0
    result="$(_ruflo_persona_block)"
    [ -z "$result" ] && echo "EMPTY" || echo "NOT_EMPTY"
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"EMPTY"* ]]
}

# ─── 4.3: ruflo=require + Ruflo absent → clear error ────────────────────────

@test "4.3: ruflo=require without ruflo — exits non-zero" {
  _write_project_config "require"

  run _in_orc_env_no_ruflo '
    _detect_ruflo "'"$TEST_DIR/project"'"
  '
  [ "$status" -ne 0 ]
}

@test "4.3: ruflo=require without ruflo — error includes install instructions" {
  _write_project_config "require"

  run _in_orc_env_no_ruflo '
    _detect_ruflo "'"$TEST_DIR/project"'"
  '
  [[ "$output" == *"npm install"* ]]
}

@test "4.3: ruflo=require without ruflo — error mentions Ruflo" {
  _write_project_config "require"

  run _in_orc_env_no_ruflo '
    _detect_ruflo "'"$TEST_DIR/project"'"
  '
  [[ "$output" == *"Ruflo"* ]] || [[ "$output" == *"ruflo"* ]]
}

@test "4.3: ruflo=require without ruflo — exits with code 2 (EXIT_STATE)" {
  _write_project_config "require"

  run _in_orc_env_no_ruflo '
    _detect_ruflo "'"$TEST_DIR/project"'"
  '
  [ "$status" -eq 2 ]
}

# ─── 4.4: ruflo=auto + Ruflo present → full integration ─────────────────────

@test "4.4: ruflo=auto with ruflo on PATH — ORC_RUFLO_AVAILABLE=1" {
  _write_project_config "auto"

  cat > "$TEST_DIR/bin/ruflo" <<'BIN'
#!/usr/bin/env bash
echo "ruflo 1.0.0"
BIN
  chmod +x "$TEST_DIR/bin/ruflo"

  run _in_orc_env_with_bin '
    _detect_ruflo "'"$TEST_DIR/project"'"
    echo "RESULT=$ORC_RUFLO_AVAILABLE"
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"RESULT=1"* ]]
}

@test "4.4: ruflo present — persona block contains tool names" {
  run _in_orc_env '
    export ORC_RUFLO_AVAILABLE=1
    _ruflo_persona_block
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"## Ruflo Tools Available"* ]]
  [[ "$output" == *"agent_spawn"* ]]
  [[ "$output" == *"memory_search"* ]]
  [[ "$output" == *"memory_store"* ]]
}

@test "4.4: ruflo present — _ensure_ruflo_mcp calls claude mcp add" {
  local log_file="$TEST_DIR/claude.log"

  cat > "$TEST_DIR/bin/claude" <<BIN
#!/usr/bin/env bash
echo "\$@" >> "$log_file"
if [[ "\$1" == "mcp" && "\$2" == "list" ]]; then
  echo "No MCP servers"
  exit 0
fi
exit 0
BIN
  chmod +x "$TEST_DIR/bin/claude"

  run _in_orc_env_with_bin '
    export ORC_RUFLO_AVAILABLE=1
    _ensure_ruflo_mcp
    echo "DONE"
  '
  [ "$status" -eq 0 ]
  grep -q "mcp add ruflo" "$log_file"
}

@test "4.4: ruflo present — _ensure_ruflo_mcp skips when already registered" {
  local log_file="$TEST_DIR/claude.log"

  cat > "$TEST_DIR/bin/claude" <<BIN
#!/usr/bin/env bash
echo "\$@" >> "$log_file"
if [[ "\$1" == "mcp" && "\$2" == "list" ]]; then
  echo "ruflo: npx ruflo@latest mcp start"
  exit 0
fi
# Should not reach mcp add
echo "UNEXPECTED_ADD" >> "$log_file"
exit 1
BIN
  chmod +x "$TEST_DIR/bin/claude"

  run _in_orc_env_with_bin '
    export ORC_RUFLO_AVAILABLE=1
    _ensure_ruflo_mcp
    echo "DONE"
  '
  [ "$status" -eq 0 ]
  # Should NOT have called mcp add
  ! grep -q "mcp add" "$log_file"
}

@test "4.4: ruflo present — _ensure_ruflo_mcp sets ORC_RUFLO_MCP_READY=1" {
  cat > "$TEST_DIR/bin/claude" <<'BIN'
#!/usr/bin/env bash
if [[ "$1" == "mcp" && "$2" == "list" ]]; then
  echo "ruflo: running"
  exit 0
fi
BIN
  chmod +x "$TEST_DIR/bin/claude"

  run _in_orc_env_with_bin '
    export ORC_RUFLO_AVAILABLE=1
    _ensure_ruflo_mcp
    echo "READY=$ORC_RUFLO_MCP_READY"
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"READY=1"* ]]
}

@test "4.4: MCP registration failure — degrades gracefully" {
  cat > "$TEST_DIR/bin/claude" <<'BIN'
#!/usr/bin/env bash
if [[ "$1" == "mcp" && "$2" == "list" ]]; then
  echo "No servers"
  exit 0
fi
if [[ "$1" == "mcp" && "$2" == "add" ]]; then
  exit 1
fi
BIN
  chmod +x "$TEST_DIR/bin/claude"

  run _in_orc_env_with_bin '
    export ORC_RUFLO_AVAILABLE=1
    _ensure_ruflo_mcp
    echo "AVAILABLE=$ORC_RUFLO_AVAILABLE"
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"AVAILABLE=0"* ]]
}

# ─── Session caching ────────────────────────────────────────────────────────

@test "caching: _detect_ruflo skips when ORC_RUFLO_AVAILABLE already set" {
  _write_project_config "auto"

  # Pre-set ORC_RUFLO_AVAILABLE=1 — should skip detection entirely
  run _in_orc_env '
    export ORC_RUFLO_AVAILABLE=1
    _detect_ruflo "'"$TEST_DIR/project"'"
    echo "RESULT=$ORC_RUFLO_AVAILABLE"
  '
  [ "$status" -eq 0 ]
  # Cached value should persist (even though ruflo binary isn't on PATH)
  [[ "$output" == *"RESULT=1"* ]]
}

@test "caching: _ensure_ruflo_mcp skips when ORC_RUFLO_MCP_READY already set" {
  # No claude binary — would fail if actually called
  run _in_orc_env '
    export ORC_RUFLO_AVAILABLE=1
    export ORC_RUFLO_MCP_READY=1
    _ensure_ruflo_mcp
    echo "OK"
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK"* ]]
}
