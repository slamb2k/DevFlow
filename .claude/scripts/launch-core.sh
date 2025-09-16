#!/bin/bash
# launch-core.sh - Launch a new, clean feature branch from updated main
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

# Display colorful banner (unless SKIP_BANNER is set)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -z "$SKIP_BANNER" ]; then
  "${SCRIPT_DIR}/block-text.sh" -s "LAUNCHING"
fi

# Handle special flags
FROM_MERGED_PR=""
if [[ "$1" == "--from-merged-pr" ]]; then
  FROM_MERGED_PR="$2"
  shift 2
  echo -e "${CYAN}ℹ️  Launching fresh branch (PR #$FROM_MERGED_PR was merged)${NC}"
  echo -e "${DIM}This avoids git history divergence from squash-merge${NC}\n"
fi

# Smart branch name generation
generate_smart_branch_name() {
  local branch_name=""

  # Priority 1: Analyze uncommitted changes
  local changed_files=$(git status --porcelain 2>/dev/null | grep -E "^[AM ]" | cut -c4- || true)

  if [ ! -z "$changed_files" ]; then
    # Analyze file patterns to determine branch type and name
    if echo "$changed_files" | grep -q "\.claude/commands/"; then
      branch_name="feat/command-updates"
    elif echo "$changed_files" | grep -q "docs/\|README\|\.md$"; then
      branch_name="docs/documentation-updates"
    elif echo "$changed_files" | grep -q "test/\|\.test\.\|\.spec\."; then
      branch_name="test/test-updates"
    elif echo "$changed_files" | grep -q "\.claude/scripts/"; then
      branch_name="feat/script-improvements"
    elif echo "$changed_files" | grep -q "src/.*auth\|login\|user"; then
      branch_name="feat/auth-updates"
    elif echo "$changed_files" | grep -q "fix\|bug\|issue"; then
      branch_name="fix/issue-resolution"
    elif echo "$changed_files" | grep -q "config\|\.json$\|\.yml$\|\.yaml$"; then
      branch_name="chore/config-updates"
    fi
  fi

  # Priority 2: Check recent commit messages
  if [ -z "$branch_name" ]; then
    local recent_commit=$(git log -1 --pretty=format:"%s" 2>/dev/null || true)
    if [ ! -z "$recent_commit" ]; then
      # Parse conventional commit format
      if echo "$recent_commit" | grep -q "^feat:"; then
        local feature=$(echo "$recent_commit" | sed 's/^feat:\s*//' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-\|-$//')
        [ ! -z "$feature" ] && branch_name="feat/$feature"
      elif echo "$recent_commit" | grep -q "^fix:"; then
        local fix=$(echo "$recent_commit" | sed 's/^fix:\s*//' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-\|-$//')
        [ ! -z "$fix" ] && branch_name="fix/$fix"
      elif echo "$recent_commit" | grep -q "^docs:"; then
        branch_name="docs/updates"
      elif echo "$recent_commit" | grep -q "^test:"; then
        branch_name="test/updates"
      fi
    fi
  fi

  # Last resort: timestamp-based
  if [ -z "$branch_name" ]; then
    branch_name="feature/auto-$(date +%Y%m%d-%H%M%S)"
  fi

  echo "$branch_name"
}

# Parse branch name argument or generate smart name
if [ ! -z "$1" ]; then
  BRANCH_NAME="$1"
else
  BRANCH_NAME=$(generate_smart_branch_name)
  echo -e "${CYAN}📝 Auto-generated branch name: ${BRANCH_NAME}${NC}"
fi

# Ensure we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo -e "${RED}❌ Not in a git repository${NC}"
  exit 1
fi

# Get current branch for reporting
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "Current branch: ${YELLOW}${CURRENT_BRANCH}${NC}"

# Check for uncommitted changes and stash them
STASH_NEEDED=false
GIT_STATUS=$(git status --porcelain)
if [[ -n "${GIT_STATUS}" ]]; then
  echo -e "${YELLOW}📦 Stashing uncommitted changes...${NC}"
  TIMESTAMP=$(date +%s)
  git stash push -m "launch-command-autostash-${TIMESTAMP}"
  STASH_NEEDED=true
fi

# Determine main branch name
MAIN_BRANCH="main"
if ! git rev-parse --verify main >/dev/null 2>&1; then
  if git rev-parse --verify master >/dev/null 2>&1; then
    MAIN_BRANCH="master"
  fi
fi

# Switch to main branch
echo -e "${CYAN}📍 Switching to ${MAIN_BRANCH} branch...${NC}"
git checkout "${MAIN_BRANCH}" 2>/dev/null || {
  echo -e "${RED}❌ Failed to checkout ${MAIN_BRANCH}${NC}"
  exit 1
}

# Fetch latest changes
echo -e "${CYAN}📡 Fetching latest changes...${NC}"
git fetch origin --prune

# Hard reset to origin/main
echo -e "${CYAN}🔄 Syncing with origin/${MAIN_BRANCH}...${NC}"
git reset --hard "origin/${MAIN_BRANCH}"

# Clean untracked files
echo -e "${CYAN}🧹 Cleaning untracked files...${NC}"
git clean -fd

# Create new feature branch
echo -e "${GREEN}🌱 Creating new branch: ${BRANCH_NAME}${NC}"
git checkout -b "${BRANCH_NAME}"

# Restore stashed changes if any
if [[ "${STASH_NEEDED}" = true ]]; then
  echo -e "${YELLOW}📤 Restoring stashed changes...${NC}"
  git stash pop || {
    echo -e "${YELLOW}⚠️  Could not auto-restore stash (conflicts possible)${NC}"
    echo -e "${YELLOW}   Use 'git stash list' and 'git stash pop' manually${NC}"
  }
fi

# Show final status
echo ""
echo -e "${GREEN}✅ Launch successful!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Branch: ${CYAN}${BRANCH_NAME}${NC}"
echo -e "  Base: ${CYAN}origin/${MAIN_BRANCH}${NC} (latest)"
echo -e "  Status: ${GREEN}Clean and ready for work${NC}"
echo ""
echo -e "${YELLOW}💡 Next steps:${NC}"
echo -e "  1. Make your changes"
echo -e "  2. Commit with: ${CYAN}git add . && git commit -m 'your message'${NC}"
echo -e "  3. Ship with: ${CYAN}/ship${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Final safety check
CURRENT_HEAD=$(git rev-parse --abbrev-ref HEAD)
if [[ "${CURRENT_HEAD}" = "${MAIN_BRANCH}" ]]; then
  echo -e "${RED}⚠️  WARNING: Still on ${MAIN_BRANCH} branch!${NC}"
  exit 1
fi

