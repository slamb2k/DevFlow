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

# Display colorful banner
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${SCRIPT_DIR}/block-text.sh" -s "LAUNCHING"

# Parse branch name argument
# Default to auto-timestamp format matching ship's convention
BRANCH_NAME="${1:-feature/auto-$(date +%Y%m%d-%H%M%S)}"

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

