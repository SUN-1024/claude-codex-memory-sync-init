#!/usr/bin/env bash
# tests/test_repomemo.sh — integration tests for bin/repomemo.
#
# Runs without any harness: plain Bash assertions against a temporary
# working directory. Exits 0 when every test passes, 1 otherwise.

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MEMSYNC="$ROOT/bin/repomemo"
EXPECTED_VERSION="1.3.0"

PASS=0
FAIL=0
FAILED_TESTS=()

# Per-test scratch directory; reset before each test.
WORK=""

setup() {
  WORK="$(mktemp -d -t repomemo-test.XXXXXX)"
}

teardown() {
  if [ -n "$WORK" ] && [ -d "$WORK" ]; then
    rm -rf "$WORK"
  fi
  WORK=""
}

run_test() {
  local name="$1"
  shift
  setup
  if "$@"; then
    echo "PASS  $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL  $name"
    FAIL=$((FAIL + 1))
    FAILED_TESTS+=("$name")
  fi
  teardown
}

# Assertion helpers — each prints a useful message on failure and returns 1.
assert_eq() {
  local actual="$1" expected="$2" label="$3"
  if [ "$actual" != "$expected" ]; then
    echo "  $label: expected '$expected', got '$actual'" >&2
    return 1
  fi
}

assert_contains() {
  local haystack="$1" needle="$2" label="$3"
  if ! printf '%s' "$haystack" | grep -q -- "$needle"; then
    echo "  $label: expected output to contain '$needle'" >&2
    echo "  output was:" >&2
    echo "$haystack" | sed 's/^/    /' >&2
    return 1
  fi
}

assert_file_nonempty() {
  local path="$1"
  if [ ! -f "$path" ]; then
    echo "  expected file to exist: $path" >&2
    return 1
  fi
  if [ ! -s "$path" ]; then
    echo "  file exists but is empty: $path" >&2
    return 1
  fi
}

EXPECTED_FILES=(
  ".ai/README.md"
  ".ai/project.md"
  ".ai/memory.md"
  ".ai/handoff.md"
  "CLAUDE.md"
  "AGENTS.md"
  "opencode.md"
)

# 1. --version exits 0 and prints the expected version line.
test_version() {
  local out rc
  out="$(bash "$MEMSYNC" --version 2>&1)"
  rc=$?
  assert_eq "$rc" "0" "exit code" || return 1
  assert_eq "$out" "repomemo ${EXPECTED_VERSION}" "version output" || return 1
}

# 2. --help exits 0 and mentions the public commands and options.
test_help() {
  local out rc
  out="$(bash "$MEMSYNC" --help 2>&1)"
  rc=$?
  assert_eq "$rc" "0" "exit code" || return 1
  assert_contains "$out" "USAGE" "help banner"   || return 1
  assert_contains "$out" "init"   "help mentions init"  || return 1
  assert_contains "$out" "check"  "help mentions check" || return 1
  assert_contains "$out" "upgrade" "help mentions upgrade" || return 1
  assert_contains "$out" "verify"  "help mentions --verify"  || return 1
  assert_contains "$out" "--force" "help mentions --force" || return 1
  assert_contains "$out" "--strict" "help mentions --strict" || return 1
}

# 3. init creates every scaffold file in a clean target directory.
test_init_creates_all_files() {
  local out rc
  out="$(bash "$MEMSYNC" init --target "$WORK" 2>&1)"
  rc=$?
  assert_eq "$rc" "0" "exit code" || { echo "$out" | sed 's/^/    /' >&2; return 1; }
  for rel in "${EXPECTED_FILES[@]}"; do
    assert_file_nonempty "$WORK/$rel" || return 1
  done
  assert_contains "$out" "7 created" "summary line" || return 1
}

# 4. init is idempotent: a second run reports everything as skipped and
#    leaves files untouched.
test_init_idempotent() {
  bash "$MEMSYNC" init --target "$WORK" >/dev/null 2>&1 \
    || { echo "  initial init failed" >&2; return 1; }

  # Capture mtimes before the second run.
  local before_sums
  before_sums="$(cd "$WORK" && shasum "${EXPECTED_FILES[@]}")" \
    || { echo "  could not hash initialized files" >&2; return 1; }

  local out rc
  out="$(bash "$MEMSYNC" init --target "$WORK" 2>&1)"
  rc=$?
  assert_eq "$rc" "0" "exit code" || return 1
  assert_contains "$out" "0 created" "no new files" || return 1
  assert_contains "$out" "7 skipped" "all skipped"  || return 1

  local after_sums
  after_sums="$(cd "$WORK" && shasum "${EXPECTED_FILES[@]}")"
  assert_eq "$after_sums" "$before_sums" "file contents unchanged" || return 1
}

# 5. --force on a populated dir overwrites, and reports as overwritten.
test_init_force_overwrites() {
  bash "$MEMSYNC" init --target "$WORK" >/dev/null 2>&1 || return 1

  # Mutate one of the files so we can detect the overwrite.
  echo "MUTATED" > "$WORK/.ai/handoff.md"

  local out rc
  out="$(bash "$MEMSYNC" init --target "$WORK" --force 2>&1)"
  rc=$?
  assert_eq "$rc" "0" "exit code" || return 1
  assert_contains "$out" "7 overwritten" "all overwritten" || return 1

  if grep -q "MUTATED" "$WORK/.ai/handoff.md"; then
    echo "  expected --force to replace mutated content, but it remains" >&2
    return 1
  fi
}

# 6. check passes on a freshly initialized directory.
test_check_passes_after_init() {
  bash "$MEMSYNC" init --target "$WORK" >/dev/null 2>&1 || return 1
  local out rc
  out="$(bash "$MEMSYNC" check "$WORK" 2>&1)"
  rc=$?
  assert_eq "$rc" "0" "exit code" || { echo "$out" | sed 's/^/    /' >&2; return 1; }
  assert_contains "$out" "repomemo check: OK" "OK summary" || return 1
  if printf '%s' "$out" | grep -q "^FAIL"; then
    echo "  unexpected FAIL line in output" >&2
    return 1
  fi
}

# 7. check fails on an empty directory and exits non-zero.
test_check_fails_on_empty() {
  local out rc
  out="$(bash "$MEMSYNC" check "$WORK" 2>&1)"
  rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "  expected non-zero exit, got 0" >&2
    return 1
  fi
  assert_contains "$out" "missing" "reports missing files" || return 1
  assert_contains "$out" "repomemo check:" "summary line"   || return 1
}

# 8. strict check passes on a freshly initialized directory.
test_check_strict_passes_after_init() {
  bash "$MEMSYNC" init --target "$WORK" >/dev/null 2>&1 || return 1
  local out rc
  out="$(bash "$MEMSYNC" check --strict "$WORK" 2>&1)"
  rc=$?
  assert_eq "$rc" "0" "exit code" || { echo "$out" | sed 's/^/    /' >&2; return 1; }
  assert_contains "$out" "Strict checks:" "strict section" || return 1
  assert_contains "$out" "CLAUDE.md imports" "strict checks CLAUDE imports" || return 1
  assert_contains "$out" "opencode.md imports" "strict checks opencode imports" || return 1
  assert_contains "$out" "AGENTS.md list" "strict checks AGENTS list" || return 1
  assert_contains "$out" "repomemo check: OK (7 files, strict)" "strict OK summary" || return 1
}

# 9. strict check catches adapter drift even when all files exist.
test_check_strict_fails_on_adapter_drift() {
  bash "$MEMSYNC" init --target "$WORK" >/dev/null 2>&1 || return 1
  echo "@.ai/README.md" > "$WORK/opencode.md"

  local out rc
  out="$(bash "$MEMSYNC" check --strict "$WORK" 2>&1)"
  rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "  expected non-zero exit, got 0" >&2
    echo "$out" | sed 's/^/    /' >&2
    return 1
  fi
  assert_contains "$out" "opencode.md imports" "reports opencode import drift" || return 1
  assert_contains "$out" "does not match .ai read order" "reports wrong read order" || return 1
  assert_contains "$out" "CLAUDE/opencode" "reports adapter content drift" || return 1
}

# 10. repomemo passes its own check (the repo follows the convention it ships).
test_self_check() {
  local out rc
  out="$(bash "$MEMSYNC" check "$ROOT" 2>&1)"
  rc=$?
  assert_eq "$rc" "0" "exit code on self-check" \
    || { echo "$out" | sed 's/^/    /' >&2; return 1; }
}

# 11. repomemo passes its own strict check, including template sync.
test_self_strict_check() {
  local out rc
  out="$(bash "$MEMSYNC" check --strict "$ROOT" 2>&1)"
  rc=$?
  assert_eq "$rc" "0" "exit code on strict self-check" \
    || { echo "$out" | sed 's/^/    /' >&2; return 1; }
  assert_contains "$out" "templates file set" "strict checks template file set" || return 1
  assert_contains "$out" "templates/opencode.md" "strict checks opencode template" || return 1
}

# 12. upgrade updates adapter files that differ from the current templates.
test_upgrade_updates_adapters() {
  bash "$MEMSYNC" init --target "$WORK" >/dev/null 2>&1 || return 1

  # Mutate one adapter so it no longer matches the template.
  echo "# mutated" > "$WORK/CLAUDE.md"

  local out rc
  out="$(bash "$MEMSYNC" upgrade --target "$WORK" 2>&1)"
  rc=$?
  assert_eq "$rc" "0" "exit code" || { echo "$out" | sed 's/^/    /' >&2; return 1; }
  assert_contains "$out" "updated    CLAUDE.md" "reports CLAUDE updated" || return 1
  assert_contains "$out" "up-to-date AGENTS.md" "reports AGENTS up-to-date" || return 1
  assert_contains "$out" "up-to-date opencode.md" "reports opencode up-to-date" || return 1
  assert_contains "$out" "1 updated, 2 up-to-date" "summary" || return 1

  # After upgrade, CLAUDE.md must match the template again.
  if ! cmp -s "$(dirname "$MEMSYNC")/../templates/CLAUDE.md" "$WORK/CLAUDE.md"; then
    echo "  CLAUDE.md was not restored to template content" >&2
    return 1
  fi
}

# 13. upgrade does not touch .ai/ files, even when they differ from templates.
test_upgrade_skips_ai_files() {
  bash "$MEMSYNC" init --target "$WORK" >/dev/null 2>&1 || return 1

  local mutated="MUTATED-CONTENT-$(date +%s)"
  echo "$mutated" > "$WORK/.ai/memory.md"

  local out rc
  out="$(bash "$MEMSYNC" upgrade --target "$WORK" 2>&1)"
  rc=$?
  assert_eq "$rc" "0" "exit code" || { echo "$out" | sed 's/^/    /' >&2; return 1; }

  if ! grep -q "$mutated" "$WORK/.ai/memory.md"; then
    echo "  upgrade overwrote .ai/memory.md even though it should skip .ai/ files" >&2
    return 1
  fi
}

# 14. upgrade creates a missing adapter file.
test_upgrade_creates_missing_adapter() {
  bash "$MEMSYNC" init --target "$WORK" >/dev/null 2>&1 || return 1

  rm "$WORK/CLAUDE.md"

  local out rc
  out="$(bash "$MEMSYNC" upgrade --target "$WORK" 2>&1)"
  rc=$?
  assert_eq "$rc" "0" "exit code" || { echo "$out" | sed 's/^/    /' >&2; return 1; }
  assert_contains "$out" "created    CLAUDE.md (was missing)" "recreates missing adapter" || return 1

  if [ ! -f "$WORK/CLAUDE.md" ]; then
    echo "  upgrade did not recreate missing CLAUDE.md" >&2
    return 1
  fi
}

# 15. upgrade leaves a clean project still passing strict check.
test_upgrade_preserves_strict_check() {
  bash "$MEMSYNC" init --target "$WORK" >/dev/null 2>&1 || return 1

  bash "$MEMSYNC" upgrade --target "$WORK" >/dev/null 2>&1 || return 1

  local out rc
  out="$(bash "$MEMSYNC" check --strict "$WORK" 2>&1)"
  rc=$?
  assert_eq "$rc" "0" "strict check after upgrade" \
    || { echo "$out" | sed 's/^/    /' >&2; return 1; }
}

# 16. upgrade on a non-existent directory fails gracefully.
test_upgrade_fails_on_missing_dir() {
  local out rc
  out="$(bash "$MEMSYNC" upgrade --target "$WORK/nosuch" 2>&1)"
  rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "  expected non-zero exit for missing directory" >&2
    return 1
  fi
  assert_contains "$out" "does not exist" "reports missing directory" || return 1
}

# 17. --verify passes after memory.md and handoff.md have been customized.
test_verify_passes_when_customized() {
  bash "$MEMSYNC" init --target "$WORK" >/dev/null 2>&1 || return 1

  # Customize the memory files so they differ from templates.
  echo "## Custom project knowledge" >> "$WORK/.ai/memory.md"
  echo "## Latest task: test customization" > "$WORK/.ai/handoff.md"

  local out rc
  out="$(bash "$MEMSYNC" check --verify "$WORK" 2>&1)"
  rc=$?
  assert_eq "$rc" "0" "exit code" || { echo "$out" | sed 's/^/    /' >&2; return 1; }
  assert_contains "$out" "contains project knowledge" "memory customized" || return 1
  assert_contains "$out" "has been updated" "handoff customized" || return 1
  assert_contains "$out" "OK (7 files, strict, verify)" "verify OK summary" || return 1
}

# 18. --verify fails on a fresh init (memory files still match templates).
test_verify_fails_on_fresh_init() {
  bash "$MEMSYNC" init --target "$WORK" >/dev/null 2>&1 || return 1

  local out rc
  out="$(bash "$MEMSYNC" check --verify "$WORK" 2>&1)"
  rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "  expected non-zero exit for fresh init --verify, got 0" >&2
    return 1
  fi
  assert_contains "$out" "unchanged from template" "reports memory unchanged" || return 1
  # Adapter instructions should still pass (they're in the template now).
  assert_contains "$out" "has no-private-memory instruction" "adapters have instruction" || return 1
}

echo "running repomemo integration tests against $MEMSYNC"
echo

run_test "repomemo --version"                       test_version
run_test "repomemo --help"                          test_help
run_test "repomemo init creates the full scaffold"  test_init_creates_all_files
run_test "repomemo init is idempotent"              test_init_idempotent
run_test "repomemo init --force overwrites"         test_init_force_overwrites
run_test "repomemo check passes after init"         test_check_passes_after_init
run_test "repomemo check fails on empty dir"        test_check_fails_on_empty
run_test "repomemo check --strict passes after init" test_check_strict_passes_after_init
run_test "repomemo check --strict catches adapter drift" test_check_strict_fails_on_adapter_drift
run_test "repomemo passes its own check"            test_self_check
run_test "repomemo passes its own strict check"     test_self_strict_check
run_test "repomemo upgrade updates adapters"        test_upgrade_updates_adapters
run_test "repomemo upgrade skips .ai/ files"        test_upgrade_skips_ai_files
run_test "repomemo upgrade creates missing adapter" test_upgrade_creates_missing_adapter
run_test "repomemo upgrade preserves strict check"  test_upgrade_preserves_strict_check
run_test "repomemo upgrade fails on missing dir"    test_upgrade_fails_on_missing_dir
run_test "repomemo check --verify passes when customized" test_verify_passes_when_customized
run_test "repomemo check --verify fails on fresh init"   test_verify_fails_on_fresh_init

echo
echo "summary: ${PASS} passed, ${FAIL} failed"
if [ "$FAIL" -ne 0 ]; then
  echo "failed tests:"
  for name in "${FAILED_TESTS[@]}"; do
    echo "  - $name"
  done
  exit 1
fi
exit 0
