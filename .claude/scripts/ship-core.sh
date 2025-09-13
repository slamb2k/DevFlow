#!/usr/bin/env bash
# ship-core.sh - Solo-first PR shipping with automated workflow
set -Eeuo pipefail

# Color output for better UX - using printf-compatible format
RED=$'\033[0;31m'
YELLOW=$'\033[1;33m'
GREEN=$'\033[0;32m'
BLUE=$'\033[0;34m'
CYAN=$'\033[0;36m'
PURPLE=$'\033[0;35m'
NC=$'\033[0m' # No Color
BOLD=$'\033[1m'

# Display colorful banner
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${SCRIPT_DIR}/block-text.sh" -s "SHIPPING"
echo

# Report arrays - initialize as empty arrays
declare -a INFO=()
declare -a WARN=()
declare -a ERR=()

# Logging functions with immediate output
note() { INFO+=("$1"); echo -e "${GREEN}✓${NC} $1"; }
warn() { WARN+=("$1"); echo -e "${YELLOW}⚠${NC} $1"; }
fail() { ERR+=("$1"); echo -e "${RED}✗${NC} $1"; }
debug() { [ "${DEBUG:-}" = "true" ] && echo -e "${BLUE}🔍${NC} $1" || true; }

# Final report function
report() {
  echo
  echo "===== 🚢 git-shipper report ====="
  
  # Check if INFO array has elements
  if [[ "${#INFO[@]}" -gt 0 ]]; then
    echo -e "${GREEN}INFO (${#INFO[@]} items):${NC}"
    for i in "${INFO[@]}"; do echo "  • $i"; done
  fi
  
  # Check if WARN array has elements
  if [[ "${#WARN[@]}" -gt 0 ]]; then
    echo -e "${YELLOW}WARNINGS (${#WARN[@]} items):${NC}"
    for w in "${WARN[@]}"; do echo "  • $w"; done
  fi
  
  # Check if ERR array has elements
  if [[ "${#ERR[@]}" -gt 0 ]]; then
    echo -e "${RED}ERRORS (${#ERR[@]} items):${NC}"
    for e in "${ERR[@]}"; do echo "  • $e"; done
    echo "================================"
    exit 1
  fi
  
  echo "================================"
  echo -e "${GREEN}✨ Ship completed successfully!${NC}"
}

# Parse arguments
CHECK_MODE="${CHECK:-}"
NOWAIT="${NOWAIT:-}"
FORCE="${FORCE:-}"
STAGED="${STAGED:-}"
EXPLICIT_TITLE=""
EXPLICIT_BRANCH_NAME=""
EXPLICIT_BODY=""
DRAFT=""
STASH_MSG=""
NEED_STASH_POP="false"

while [[ $# -gt 0 ]]; do
  case $1 in
    --check)
      CHECK_MODE="true"
      shift
      ;;
    --nowait)
      NOWAIT="true"
      shift
      ;;
    --staged)
      STAGED="true"
      shift
      ;;
    --force)
      FORCE="true"
      shift
      ;;
    --title)
      EXPLICIT_TITLE="$2"
      shift 2
      ;;
    --branch-name)
      EXPLICIT_BRANCH_NAME="$2"
      shift 2
      ;;
    --body)
      EXPLICIT_BODY="$2"
      shift 2
      ;;
    --draft)
      DRAFT="--draft"
      shift
      ;;
    *)
      warn "Unknown argument: $1"
      shift
      ;;
  esac
done

# If in check mode, run the ship-check.sh script
if [[ "${CHECK_MODE}" = "true" ]]; then
  if [[ -f "./scripts/ship-check.sh" ]]; then
    echo -e "${BLUE}Running pre-ship safety check...${NC}"
    
    # Temporarily disable errexit to capture exit code
    set +e
    ./scripts/ship-check.sh "$@"
    CHECK_RESULT=$?
    set -e
    
    if [[ ${CHECK_RESULT} -ne 0 ]]; then
      echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo -e "${YELLOW}                Resolution Steps${NC}"
      echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      
      # Check if on main branch
      CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
      if [[ "${CURRENT_BRANCH}" = "main" ]] || [[ "${CURRENT_BRANCH}" = "master" ]]; then
        echo -e "\n${BOLD}Issue: You're on the main branch${NC}"
        echo -e "\n${GREEN}Resolution Options:${NC}"
        echo -e "  1. Create a feature branch: ${CYAN}/launch feature-name${NC}"
        echo -e "     Then run: ${CYAN}/ship${NC}"
        echo -e "\n  2. Let ship create a branch: ${CYAN}/ship --branch-name feature-name${NC}"
        echo -e "\n  ℹ️  Recommended: Use option 1 for cleaner workflow${NC}"
      fi
      
      # Check for merge conflicts
      if git status --porcelain | grep -q "^UU"; then
        echo -e "\n${BOLD}Issue: Merge conflicts detected${NC}"
        echo -e "\n${GREEN}Resolution:${NC}"
        echo -e "  1. Resolve conflicts in the marked files"
        echo -e "  2. Stage resolved files: ${CYAN}git add <files>${NC}"
        echo -e "  3. Continue shipping: ${CYAN}/ship${NC}"
      fi
      
      echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo -e "\nℹ️  After resolving issues, run ${CYAN}/ship${NC} to continue"
    else
      echo -e "\n${GREEN}✅ All checks passed! Ready to ship.${NC}"
      echo -e "ℹ️  Run ${CYAN}/ship${NC} to proceed"
    fi
    
    # Always exit 0 for check mode - it's informational
    exit 0
  else
    warn "ship-check.sh not found, skipping safety check"
  fi
fi

# Ensure we're in a git repo
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  fail "Not in a git repository"
  report
fi


# Verify GitHub context
OWNER_REPO="$(gh repo view --json owner,name --jq '.owner.login + "/" + .name' 2>/dev/null || true)"
if [[ -z "${OWNER_REPO}" ]]; then
  fail "No GitHub repo context. Please run 'gh auth login' first."
  report
fi
note "📦 Repository: ${OWNER_REPO}"

# Get default branch
DEFAULT="$(git remote show origin 2>/dev/null | sed -n 's/.*HEAD branch: //p' || echo main)"
note "🌿 Default branch: ${DEFAULT}"

# Fetch latest changes
echo -e "\n${GREEN}Syncing with remote...${NC}"
# Use timeout to prevent hanging, redirect output to avoid stderr issues
timeout 5 git fetch --prune --tags >/dev/null 2>&1
FETCH_EXIT=$?
if [[ ${FETCH_EXIT} -eq 0 ]]; then
  debug "Successfully fetched from remote"
elif [[ ${FETCH_EXIT} -eq 124 ]]; then
  warn "Git fetch timed out after 5 seconds - continuing anyway"
else
  warn "Failed to fetch from remote (exit code: ${FETCH_EXIT})"
fi

# Get the current branch
CURR_BRANCH="$(git branch --show-current 2>/dev/null || true)"
debug "Current branch: ${CURR_BRANCH}"

# Handle being on default branch - create feature branch
if [[ "${CURR_BRANCH}" = "${DEFAULT}" ]] || [[ -z "${CURR_BRANCH}" ]]; then
  # Switch to default and pull latest
  git switch "${DEFAULT}" >/dev/null 2>&1 || true
  if ! git pull --ff-only origin "${DEFAULT}"; then
    fail "Failed to sync ${DEFAULT} branch"
    report
  fi
  note "📥 Synced ${DEFAULT} with origin"
  
  # Determine branch name
  TARGET_BRANCH="${EXPLICIT_BRANCH_NAME}"
  if [[ -z "${TARGET_BRANCH}" ]]; then
    if [[ -n "${EXPLICIT_TITLE}" ]]; then
      # Generate branch name from title
      SLUG="$(echo "${EXPLICIT_TITLE}" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g;s/^-+|-+$//g' | cut -c1-60)"
      TARGET_BRANCH="feat/${SLUG:-update-$(date +%Y%m%d-%H%M%S)}"
    else
      # Auto-generate branch name
      TARGET_BRANCH="feature/auto-$(date +%Y%m%d-%H%M%S)"
    fi
  fi
  
  # Create and switch to new branch
  if git switch -c "${TARGET_BRANCH}"; then
    note "🌱 Created branch: ${TARGET_BRANCH}"
    CURR_BRANCH="${TARGET_BRANCH}"
  else
    fail "Failed to create branch: ${TARGET_BRANCH}"
    report
  fi
else
  note "🌿 Using existing branch: ${CURR_BRANCH}"
fi

# Handle staged vs default mode for uncommitted changes
if [[ "${STAGED}" = "true" ]]; then
  # Staged mode: Check for staged changes
  if [[ -z "$(git diff --cached --name-only)" ]]; then
    fail "No staged changes to ship. Stage files with 'git add' first."
    report
  fi
  
  echo -e "\n${GREEN}=== STAGED MODE ===${NC}"
  echo -e "${GREEN}Will ship only STAGED changes:${NC}"
  git diff --cached --stat
  
  # Show unstaged changes that will be stashed
  if [[ -n "$(git diff --name-only)" ]]; then
    echo -e "\n${YELLOW}Will STASH these unstaged changes:${NC}"
    git diff --stat
  fi
  
  # Confirmation prompt only in interactive mode
  if [[ -t 0 ]]; then
    echo -e "\n${YELLOW}Continue with shipping staged changes only? [Y/n]:${NC} "
    read -r CONFIRM
    if [[ "${CONFIRM}" = "n" ]] || [[ "${CONFIRM}" = "N" ]]; then
      fail "Ship cancelled by user"
      report
    fi
  else
    echo -e "\n${GREEN}Auto-confirming (non-interactive mode)${NC}"
  fi
  
  # Stash unstaged changes if any exist
  if [[ -n "$(git diff --name-only)" ]]; then
    STASH_MSG="ship-staged-preserve-$(date +%s)"
    note "📦 Stashing unstaged changes..."
    git stash push -m "${STASH_MSG}" --keep-index
    NEED_STASH_POP="true"
  fi
  
  # Commit only staged changes
  if [[ -n "$(git diff --cached --name-only)" ]]; then
    echo -e "\n${GREEN}Committing staged changes...${NC}"
    git commit -m "Ship staged changes"
    note "✅ Committed staged changes only"
  fi
else
  # Default mode: Commit ALL uncommitted changes
  if [[ -n "$(git status --porcelain=v1)" ]]; then
    echo -e "\n${YELLOW}=== DEFAULT MODE ===${NC}"
    echo -e "${YELLOW}Will commit and ship ALL changes:${NC}"
    git status --short
    
    # Confirmation prompt only in interactive mode
    if [[ -t 0 ]]; then
      echo -e "\n${YELLOW}Continue with shipping ALL changes? [Y/n]:${NC} "
      read -r CONFIRM
      if [[ "${CONFIRM}" = "n" ]] || [[ "${CONFIRM}" = "N" ]]; then
        fail "Ship cancelled by user"
        report
      fi
    else
      echo -e "\n${GREEN}Auto-confirming (non-interactive mode)${NC}"
    fi
    
    echo -e "\n${GREEN}Committing ALL uncommitted changes...${NC}"
    git add -A
    git commit -m "Ship all uncommitted changes"
    note "✅ Committed all changes"
  fi
fi

# Check if we have any commits on this branch
if ! git log -1 >/dev/null 2>&1; then
  fail "No commits on this branch. Please make at least one commit before shipping."
  report
fi

# Rebase onto default branch
echo -e "\n${GREEN}Rebasing onto ${DEFAULT}...${NC}"
if ! git rebase "origin/${DEFAULT}"; then
  fail "Rebase conflict detected! Please resolve conflicts and run again."
  echo -e "${YELLOW}Tip: Use 'git rebase --abort' to cancel or 'git rebase --continue' after resolving${NC}"
  report
fi
note "🔄 Rebased onto origin/${DEFAULT} successfully"

# Run checks (Nx affected or standard scripts)
echo -e "\n${GREEN}Running checks...${NC}"
if [[ -f pnpm-lock.yaml ]] && command -v pnpm >/dev/null 2>&1; then
  pnpm install --frozen-lockfile >/dev/null 2>&1 || pnpm install >/dev/null 2>&1
  note "📦 Dependencies installed"
fi

# Detect and use Nx if available
if command -v nx >/dev/null 2>&1 || npx nx --version >/dev/null 2>&1; then
  echo -e "${BLUE}Using Nx affected for optimized checks...${NC}"
  BASE="$(git merge-base origin/${DEFAULT} HEAD)"
  
  # Run Nx affected targets
  npx nx affected -t format --base="${BASE}" --head=HEAD 2>/dev/null || true
  npx nx affected -t lint --base="${BASE}" --head=HEAD || warn "Lint issues detected"
  npx nx affected -t test --base="${BASE}" --head=HEAD || warn "Test failures detected"
  npx nx affected -t build --base="${BASE}" --head=HEAD || warn "Build issues detected"
  
  note "🎯 Nx affected checks completed"
else
  # Fallback to standard npm/pnpm scripts
  echo -e "${BLUE}Running standard checks...${NC}"
  
  # Format
  if npm run format:check --if-present >/dev/null 2>&1; then
    note "🧹 Format check passed"
  elif npm run format --if-present >/dev/null 2>&1; then
    note "🧹 Formatted code"
  fi
  
  # Lint
  npm run lint --if-present >/dev/null 2>&1 && note "🔎 Lint passed" || warn "Lint issues"
  
  # Type check
  npm run typecheck --if-present >/dev/null 2>&1 && note "🧠 Type check passed" || warn "Type errors"
  
  # Test
  npm run test --if-present >/dev/null 2>&1 && note "🧪 Tests passed" || warn "Test failures"
  
  # Build
  npm run build --if-present >/dev/null 2>&1 && note "🛠️ Build succeeded" || warn "Build issues"
fi

# Generate PR title
echo -e "\n${GREEN}Preparing PR...${NC}"
BASE="$(git merge-base origin/${DEFAULT} HEAD)"

# Try to derive title from conventional commits
if [[ -z "${EXPLICIT_TITLE}" ]]; then
  # Get all conventional commits
  COMMITS="$(git log --reverse --pretty=format:'%s' "${BASE}"..HEAD | \
    grep -E '^(feat|fix|perf|refactor|docs|test|build|ci|chore|revert)(\(.+\))?:' || true)"
  
  if [[ -n "${COMMITS}" ]]; then
    # Count different types of changes
    COMMIT_COUNT=$(echo "${COMMITS}" | wc -l)
    
    if [[ "${COMMIT_COUNT}" -eq 1 ]]; then
      # Single commit - use its description
      PR_TITLE="$(echo "${COMMITS}" | sed -E 's/^[a-z]+(\([^)]*\))?:[ ]*//')"
    else
      # Multiple commits - create a summary
      # Extract unique change types and their descriptions
      FEAT_COUNT=$(echo "${COMMITS}" | grep -c '^feat' || true)
      FIX_COUNT=$(echo "${COMMITS}" | grep -c '^fix' || true)
      REFACTOR_COUNT=$(echo "${COMMITS}" | grep -c '^refactor' || true)
      
      # Build title based on change types
      TITLE_PARTS=()
      [ "${FEAT_COUNT}" -gt 0 ] && TITLE_PARTS+=("add features")
      [ "${FIX_COUNT}" -gt 0 ] && TITLE_PARTS+=("fix issues")
      [ "${REFACTOR_COUNT}" -gt 0 ] && TITLE_PARTS+=("refactor code")
      
      if [[ ${#TITLE_PARTS[@]} -gt 0 ]]; then
        # Join with commas and "and"
        if [[ ${#TITLE_PARTS[@]} -eq 1 ]]; then
          PR_TITLE="${TITLE_PARTS[0]}"
        elif [[ ${#TITLE_PARTS[@]} -eq 2 ]]; then
          PR_TITLE="${TITLE_PARTS[0]} and ${TITLE_PARTS[1]}"
        else
          PR_TITLE="$(IFS=', '; echo "${TITLE_PARTS[*]:0:${#TITLE_PARTS[@]}-1}"), and ${TITLE_PARTS[-1]}"
        fi
        
        # Capitalize first letter
        PR_TITLE="$(echo "${PR_TITLE}" | sed 's/^./\U&/')"
      else
        # Fallback to first commit if no recognized types
        PR_TITLE="$(echo "${COMMITS}" | head -1 | sed -E 's/^[a-z]+(\([^)]*\))?:[ ]*//')"
      fi
    fi
  else
    # Fallback to branch name or generic title
    PR_TITLE="${CURR_BRANCH//[-_]/ }"
  fi
else
  PR_TITLE="${EXPLICIT_TITLE}"
fi

[ -z "${PR_TITLE}" ] && PR_TITLE="Update $(date +%Y-%m-%d)"
note "📝 PR title: ${PR_TITLE}"

# Generate PR body from commits
if [[ -z "${EXPLICIT_BODY}" ]]; then
  TMP_BODY="$(mktemp)"
  
  # Categorize commits by type
  for TYPE in feat fix perf refactor docs test build ci chore revert; do
    : > "/tmp/${TYPE}.list"
  done
  : > "/tmp/BREAKING.list"
  
  # Process each commit - handle multi-line commits properly
  git log --reverse --pretty=format:'%s%n%b%n---END---' "${BASE}"..HEAD | \
  awk -v RS='---END---' '
  {
    # Skip empty records
    if (length($0) == 0 || $0 ~ /^[[:space:]]*$/) next
    
    # Get subject line (first line)
    subject = $0
    gsub(/\n.*/, "", subject)
    
    # Skip if subject is empty or whitespace only
    if (length(subject) == 0 || subject ~ /^[[:space:]]*$/) next
    
    # Extract type from conventional commit
    if (match(tolower(subject), /^(feat|fix|perf|refactor|docs|test|build|ci|chore|revert)(\(.+\))?:/)) {
      type = substr(tolower(subject), RSTART, RLENGTH)
      gsub(/:.*/, "", type)
      gsub(/\(.*\)/, "", type)
    } else {
      type = "chore"
    }
    
    # Check for breaking changes
    if ($0 ~ /BREAKING CHANGE:|!:/) {
      print "* " subject >> "/tmp/BREAKING.list"
    }
    
    # Add to appropriate type list only if subject is not empty
    if (length(subject) > 0) {
      print "* " subject >> ("/tmp/" type ".list")
    }
  }'
  
  # Build PR body
  {
    echo "## 📋 Summary"
    echo
    echo "Changes in this PR, organized by type:"
    echo
    
    # Add sections for each type with content
    for TYPE in feat fix perf refactor docs test build ci chore revert; do
      if [[ -s "/tmp/${TYPE}.list" ]]; then
        case "${TYPE}" in
          feat) echo "### ✨ Features" ;;
          fix) echo "### 🐛 Bug Fixes" ;;
          perf) echo "### ⚡ Performance" ;;
          refactor) echo "### ♻️ Refactoring" ;;
          docs) echo "### 📚 Documentation" ;;
          test) echo "### 🧪 Tests" ;;
          build) echo "### 🏗️ Build" ;;
          ci) echo "### 🔧 CI/CD" ;;
          chore) echo "### 🧹 Chores" ;;
          revert) echo "### ⏪ Reverts" ;;
        esac
        cat "/tmp/${TYPE}.list"
        echo
      fi
    done
    
    # Add breaking changes section if present
    if [[ -s "/tmp/BREAKING.list" ]]; then
      echo "### 💥 BREAKING CHANGES"
      cat "/tmp/BREAKING.list"
      echo
    fi
    
    echo "---"
    echo "_Generated by han-solo_"
  } > "${TMP_BODY}"
  
  PR_BODY_FILE="${TMP_BODY}"
else
  echo "${EXPLICIT_BODY}" > /tmp/explicit_body.md
  PR_BODY_FILE="/tmp/explicit_body.md"
fi

# Check if there's already a merged PR for this branch BEFORE pushing
echo -e "\n${GREEN}Checking PR status...${NC}"
MERGED_PR="$(gh pr list --head "${CURR_BRANCH}" --state merged --json number --jq '.[0].number' 2>/dev/null || true)"

# If we have a merged PR but new commits, we need a new branch
if [[ -n "${MERGED_PR}" ]]; then
  warn "⚠️ Found merged PR #${MERGED_PR} for branch ${CURR_BRANCH}"
  
  # Check if we have new commits since the merge
  MERGE_COMMIT="$(gh pr view "${MERGED_PR}" --json mergeCommit --jq '.mergeCommit.oid' 2>/dev/null || true)"
  if [[ -n "${MERGE_COMMIT}" ]]; then
    COMMITS_SINCE_MERGE="$(git rev-list --count "${MERGE_COMMIT}"..HEAD 2>/dev/null || echo 0)"
    
    if [[ "${COMMITS_SINCE_MERGE}" -gt 0 ]]; then
      note "📊 Found ${COMMITS_SINCE_MERGE} new commits since PR #${MERGED_PR} was merged"
      
      # Create a new branch with incrementing suffix
      NEW_BRANCH="${CURR_BRANCH}-followup-$(date +%H%M%S)"
      note "🔄 Creating new branch for follow-up changes: ${NEW_BRANCH}"
      
      git checkout -b "${NEW_BRANCH}"
      
      # Save old branch name and switch to new one
      OLD_BRANCH="${CURR_BRANCH}"
      CURR_BRANCH="${NEW_BRANCH}"
      
      # Delete the old local branch to prevent confusion
      git branch -d "${OLD_BRANCH}" 2>/dev/null && note "🧹 Deleted local branch: ${OLD_BRANCH}" || true
      
      # We'll push the new branch below, not the old one
      note "📍 Will push to new branch ${CURR_BRANCH} instead of ${OLD_BRANCH}"
    else
      note "✅ No new commits since merge - nothing to ship!"
      git switch "${DEFAULT}" >/dev/null 2>&1 || true
      git pull --ff-only origin "${DEFAULT}" >/dev/null 2>&1 || true
      git branch -d "${CURR_BRANCH}" >/dev/null 2>&1 && note "🧹 Deleted local branch: ${CURR_BRANCH}"
      report
      exit 0
    fi
  fi
fi

# Push branch (now we know which branch to push)
echo -e "\n${GREEN}Pushing to remote...${NC}"
if git rev-parse --verify --quiet "origin/${CURR_BRANCH}" >/dev/null; then
  # Branch exists on remote, use force-with-lease for safety
  if git push --force-with-lease origin "${CURR_BRANCH}"; then
    note "⬆️ Pushed with --force-with-lease (safe force)"
  else
    fail "Push failed (someone else may have pushed to this branch)"
    report
  fi
else
  # New branch, regular push
  if git push -u origin "${CURR_BRANCH}"; then
    note "⬆️ Pushed new branch to origin"
  else
    fail "Failed to push branch"
    report
  fi
fi

# Check for existing PR (open state)
echo -e "\n${GREEN}Managing PR...${NC}"
PR_EXISTS="$(gh pr list --head "${CURR_BRANCH}" --json number --jq '.[0].number' 2>/dev/null || true)"

if [[ -z "${PR_EXISTS}" ]]; then
  # Create new PR
  if gh pr create \
    --base "${DEFAULT}" \
    --head "${CURR_BRANCH}" \
    --title "${PR_TITLE}" \
    --body-file "${PR_BODY_FILE}" \
    ${DRAFT} >/dev/null 2>&1; then
    note "🎫 Created new PR"
  else
    fail "Failed to create PR"
    report
  fi
else
  # Update existing PR
  if gh pr edit "${PR_EXISTS}" \
    --title "${PR_TITLE}" \
    --body-file "${PR_BODY_FILE}" >/dev/null 2>&1; then
    note "📝 Updated existing PR #${PR_EXISTS}"
  else
    warn "Could not update PR #${PR_EXISTS}"
  fi
fi

# Get PR URL
PR_URL="$(gh pr view --json url --jq .url 2>/dev/null || true)"
if [[ -n "${PR_URL}" ]]; then
  note "🔗 PR URL: ${PR_URL}"
  echo -e "${BLUE}View PR: ${PR_URL}${NC}"
else
  warn "Could not retrieve PR URL"
fi

# Clean up temp files
rm -f "${PR_BODY_FILE}" /tmp/*.list 2>/dev/null || true

# Handle --nowait flag
if [[ -n "${NOWAIT}" ]]; then
  note "⏸️ --nowait specified: PR created/updated, skipping merge"
  report
  exit 0
fi

# Wait for checks and merge
echo -e "\n${GREEN}Waiting for required checks...${NC}"
echo -e "${BLUE}This may take a few minutes...${NC}"

# Enable auto-merge (using PR number if exists, otherwise current branch)
AUTO_MERGE_ENABLED=false
if [[ -n "${PR_EXISTS}" ]]; then
  if gh pr merge --auto --squash --delete-branch "${PR_EXISTS}" 2>/dev/null; then
    note "🤖 Auto-merge enabled for PR #${PR_EXISTS} (will merge when checks pass)"
    AUTO_MERGE_ENABLED=true
  else
    warn "Failed to enable auto-merge - will wait and merge manually"
  fi
else
  # Try with current branch
  if gh pr merge --auto --squash --delete-branch 2>/dev/null; then
    note "🤖 Auto-merge enabled (will merge when checks pass)"
    AUTO_MERGE_ENABLED=true
  else
    warn "Failed to enable auto-merge - will wait and merge manually"
  fi
fi

# If auto-merge is enabled, we're done - GitHub will handle the rest
if [[ "${AUTO_MERGE_ENABLED}" = true ]]; then
  note "✨ PR will automatically merge when all checks pass"
  note "🔗 View PR: $(gh pr view --json url -q .url)"
  
  # Wait for auto-merge to complete (up to 2 minutes)
  echo -e "\n${BLUE}⏳ Waiting for auto-merge to complete...${NC}"
  WAIT_TIME=0
  MAX_WAIT=120  # 2 minutes
  
  while [[ ${WAIT_TIME} -lt ${MAX_WAIT} ]]; do
    if gh pr view --json state -q '.state' | grep -q "MERGED"; then
      note "✅ PR successfully merged by auto-merge!"
      
      # Critical: Force reset main branch to avoid divergence
      echo -e "\n${GREEN}📥 Syncing ${DEFAULT} branch...${NC}"
      git switch "${DEFAULT}" >/dev/null 2>&1 || true
      
      # Force reset to avoid divergence from squash-merge
      git fetch origin "${DEFAULT}" >/dev/null 2>&1
      if git reset --hard "origin/${DEFAULT}"; then
        note "✅ Successfully reset ${DEFAULT} to origin/${DEFAULT}"
        note "🎯 Your local ${DEFAULT} is now up-to-date with the squash-merged changes"
      else
        warn "⚠️ Failed to sync ${DEFAULT} - you may need to run 'git pull --rebase' manually"
      fi
      
      # Clean up feature branch
      git branch -d "${CURR_BRANCH}" >/dev/null 2>&1 && note "🧹 Deleted local branch: ${CURR_BRANCH}"
      break
    fi
    
    sleep 10
    WAIT_TIME=$((WAIT_TIME + 10))
    echo -ne "\r${BLUE}⏳ Waiting for auto-merge... ${WAIT_TIME}s elapsed${NC}"
  done
  
  if [[ ${WAIT_TIME} -ge ${MAX_WAIT} ]]; then
    echo
    warn "⚠️ PR is still pending after 2 minutes"
    warn "⚠️ IMPORTANT: Your PR is not yet merged!"
    warn "⚠️ View PR status: $(gh pr view --json url -q .url)"
    warn "⚠️ After PR merges, you MUST sync your ${DEFAULT} branch:"
    warn "⚠️   git switch ${DEFAULT} && git pull"
    warn "⚠️ Otherwise your next /ship will have conflicts!"
  fi
  
  report
  exit 0
fi

# Watch required checks (only if auto-merge failed)
CHECKS_PASSED=false
MAX_WAIT=1800  # 30 minutes timeout
ELAPSED=0
INTERVAL=30

while [[ ${ELAPSED} -lt ${MAX_WAIT} ]]; do
  # Get check status
  STATUS_JSON="$(gh pr checks --json name,state 2>/dev/null || echo '[]')"
  
  # Count pending and failed checks
  PENDING="$(echo "${STATUS_JSON}" | jq '[.[] | select(.state == "PENDING")] | length')"
  FAILED="$(echo "${STATUS_JSON}" | jq '[.[] | select(.state == "FAILURE" or .state == "ERROR")] | length')"
  
  if [[ "${PENDING}" -eq 0 ]]; then
    if [[ "${FAILED}" -eq 0 ]]; then
      CHECKS_PASSED=true
      note "✅ All checks passed!"
      break
    else
      if [[ -n "${FORCE}" ]]; then
        warn "⚠️ ${FAILED} check(s) failed but --force specified"
        break
      else
        fail "❌ ${FAILED} check(s) failed. Use --force to override."
        
        # Show which checks failed
        echo -e "${RED}Failed checks:${NC}"
        echo "${STATUS_JSON}" | jq -r '.[] | select(.status == "completed" and .conclusion != "success") | "  • " + .name'
        
        report
      fi
    fi
  else
    echo -ne "\r${BLUE}⏳ Waiting for ${PENDING} check(s) to complete... (${ELAPSED}s elapsed)${NC}"
    sleep ${INTERVAL}
    ELAPSED=$((ELAPSED + INTERVAL))
  fi
done

echo  # New line after progress indicator

if [[ ${ELAPSED} -ge ${MAX_WAIT} ]]; then
  fail "Timeout waiting for checks (30 minutes)"
  report
fi

# Attempt to merge
echo -e "\n${GREEN}Merging PR...${NC}"
if gh pr merge --squash --delete-branch; then
  note "🎉 PR merged successfully!"
  MERGE_SUCCESS=true
else
  # Check if already merged
  if gh pr view --json state -q '.state' | grep -q "MERGED"; then
    note "✅ PR was already merged"
    MERGE_SUCCESS=true
  else
    fail "Failed to merge PR (may require manual intervention)"
    report
  fi
fi

# Critical: Sync main branch after successful merge using force reset
if [[ "${MERGE_SUCCESS:-false}" = true ]]; then
  echo -e "\n${GREEN}📥 Syncing ${DEFAULT} branch after merge...${NC}"
  
  # Switch to main/default branch
  git switch "${DEFAULT}" >/dev/null 2>&1 || true
  
  # Force reset to origin to avoid divergence from squash-merge
  echo -e "${GREEN}Resetting ${DEFAULT} to origin/${DEFAULT}...${NC}"
  git fetch origin "${DEFAULT}" >/dev/null 2>&1
  git reset --hard "origin/${DEFAULT}"
  note "✅ Successfully reset ${DEFAULT} to origin/${DEFAULT}"
  note "🎯 Your local ${DEFAULT} matches the remote exactly (avoiding divergence)"
  
  # Restore stashed changes if we saved them (--staged mode)
  if [[ "${NEED_STASH_POP}" = "true" ]] && [[ -n "${STASH_MSG}" ]]; then
    echo -e "\n${GREEN}📤 Restoring stashed unstaged changes...${NC}"
    if git stash list | grep -q "${STASH_MSG}"; then
      if git stash pop >/dev/null 2>&1; then
        note "✅ Restored unstaged changes successfully"
      else
        warn "⚠️ Could not auto-restore stash (possible conflicts)"
        warn "⚠️ Use 'git stash list' and 'git stash pop' to manually restore"
      fi
    fi
  fi
else
  echo -e "\n${YELLOW}⚠️ Skipping branch sync due to merge failure${NC}"
  git switch "${DEFAULT}" >/dev/null 2>&1 || true
  
  # Still restore stash even if merge failed
  if [[ "${NEED_STASH_POP}" = "true" ]] && [[ -n "${STASH_MSG}" ]]; then
    echo -e "\n${GREEN}📤 Restoring stashed changes...${NC}"
    if git stash list | grep -q "${STASH_MSG}"; then
      git stash pop >/dev/null 2>&1 || warn "Could not restore stash"
    fi
  fi
fi

# Delete remote branch (may already be deleted by GitHub)
git push origin --delete "${CURR_BRANCH}" >/dev/null 2>&1 || true

# Delete local branch if merged
if git branch --merged "${DEFAULT}" | grep -qx "  ${CURR_BRANCH}"; then
  git branch -d "${CURR_BRANCH}" >/dev/null 2>&1 && note "🧹 Deleted local branch: ${CURR_BRANCH}"
fi

# Run comprehensive branch cleanup
note "🧹 Running comprehensive branch cleanup..."
if [[ -f "./scripts/scrub-core.sh" ]]; then
  ./scripts/scrub-core.sh --quiet || warn "Branch cleanup encountered issues (non-critical)"
else
  warn "scrub-core.sh not found - skipping comprehensive cleanup"
fi

note "🏁 Ship complete! Your changes are in ${DEFAULT}."

# Final report
