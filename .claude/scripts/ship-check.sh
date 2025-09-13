#!/bin/bash

# 🚦 Pre-Ship Safety Check
# Ensures it's safe to use /ship command

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# Display colorful banner
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${SCRIPT_DIR}/block-text.sh" -s "SHIP CHECK"
echo

# Emoji
CHECK="✅"
CROSS="❌"
WARN="⚠️ "
INFO="ℹ️ "
STOP="🛑"
GO="🚀"
THINK="🤔"

# Safety flags
IS_SAFE=true
AUTO_FIX=false
CREATED_BRANCH=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --auto-fix)
            AUTO_FIX=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Helper function for errors
fail_check() {
    IS_SAFE=false
    echo -e "${RED}$1${NC}"
}

# Helper function for auto-fixing
auto_fix() {
    if [[ "${AUTO_FIX}" = true ]]; then
        echo -e "${YELLOW}  🔧 Auto-fixing: $1${NC}"
        eval "$2"
        return 0
    else
        echo -e "${INFO} To fix: ${GREEN}$2${NC}"
        return 1
    fi
}

# 1. Check if on main branch
echo -e "${BOLD}1. Branch Check${NC}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "${CURRENT_BRANCH}" = "main" ]] || [[ "${CURRENT_BRANCH}" = "master" ]]; then
    fail_check "  ${STOP} You're on ${CURRENT_BRANCH} branch!"
    
    # Check for uncommitted changes
    status_output="$(git status --porcelain)"
    if [[ -n "${status_output}" ]]; then
        echo -e "  ${INFO} You have uncommitted changes"
        timestamp="$(date +%Y%m%d-%H%M%S)"
        auto_fix "Creating feature branch with your changes" \
                   "git checkout -b feature/${timestamp} && CREATED_BRANCH=true"
        fix_result=$?
        if [[ ${fix_result} -eq 0 ]]; then
            CREATED_BRANCH=true
            CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
            echo -e "  ${CHECK} Moved to branch: ${GREEN}${CURRENT_BRANCH}${NC}"
            IS_SAFE=true
        fi
    else
        # Check for unpushed commits
        UNPUSHED=$(git rev-list HEAD ^origin/"${CURRENT_BRANCH}" 2>/dev/null | wc -l || echo "0")
        if [[ "${UNPUSHED}" -gt 0 ]]; then
            echo -e "  ${CROSS} You have ${UNPUSHED} unpushed commits on main!"
            timestamp="$(date +%Y%m%d-%H%M%S)"
            auto_fix "Creating feature branch with your commits" \
                       "git checkout -b feature/${timestamp} && CREATED_BRANCH=true"
            fix_result=$?
            if [[ ${fix_result} -eq 0 ]]; then
                CREATED_BRANCH=true
                CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
                echo -e "  ${CHECK} Moved to branch: ${GREEN}${CURRENT_BRANCH}${NC}"
                IS_SAFE=true
            fi
        else
            echo -e "  ${CROSS} Please create a feature branch first"
            echo -e "  ${INFO} Run: ${GREEN}git checkout -b feature/your-feature${NC}"
        fi
    fi
else
    echo -e "  ${CHECK} On feature branch: ${GREEN}${CURRENT_BRANCH}${NC}"
fi
echo ""

# 2. Check for branch conflicts
echo -e "${BOLD}2. Branch Conflict Check${NC}"
UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo "")
if [[ -n "${UPSTREAM}" ]]; then
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse "${UPSTREAM}" 2>/dev/null || echo "")
    BASE=$(git merge-base HEAD "${UPSTREAM}" 2>/dev/null || echo "")
    
    if [[ "${LOCAL}" != "${REMOTE}" ]] && [[ "${LOCAL}" != "${BASE}" ]] && [[ "${REMOTE}" != "${BASE}" ]]; then
        fail_check "  ${STOP} Branch has diverged from ${UPSTREAM}!"
        echo -e "  ${THINK} This usually means the branch was already merged"
        echo -e "  ${INFO} Consider creating a new branch with /launch"
        if [[ "${AUTO_FIX}" = true ]] && [[ "${CREATED_BRANCH}" = false ]]; then
            echo -e "  ${YELLOW}Creating new branch...${NC}"
            git checkout main 2>/dev/null || git checkout master
            git pull origin main 2>/dev/null || git pull origin master
            timestamp="$(date +%Y%m%d-%H%M%S)"
            git checkout -b "feature/auto-${timestamp}"
            echo -e "  ${CHECK} Created new branch"
            IS_SAFE=true
        fi
    else
        echo -e "  ${CHECK} No conflicts detected"
    fi
else
    echo -e "  ${CHECK} No upstream branch (OK for new branches)"
fi
echo ""

# 3. Check if branch was already merged
echo -e "${BOLD}3. Already Merged Check${NC}"
if [[ "${CURRENT_BRANCH}" != "main" ]] && [[ "${CURRENT_BRANCH}" != "master" ]]; then
    # Check against main/master
    MAIN_BRANCH="main"
    if ! git show-ref --verify --quiet refs/remotes/origin/main; then
        MAIN_BRANCH="master"
    fi
    
    MERGED=$(git branch -r --merged origin/"${MAIN_BRANCH}" 2>/dev/null | grep "origin/${CURRENT_BRANCH}" || true)
    if [[ -n "${MERGED}" ]]; then
        fail_check "  ${STOP} This branch was already merged to ${MAIN_BRANCH}!"
        echo -e "  ${THINK} You're trying to ship from an already-merged branch"
        echo -e "  ${INFO} Create a new branch for new work"
        if [[ "${AUTO_FIX}" = true ]]; then
            echo -e "  ${YELLOW}Creating new branch...${NC}"
            timestamp="$(date +%Y%m%d-%H%M%S)"
            NEW_BRANCH="feature/new-${timestamp}"
            git checkout -b "${NEW_BRANCH}"
            echo -e "  ${CHECK} Created branch: ${GREEN}${NEW_BRANCH}${NC}"
            IS_SAFE=true
        fi
    else
        echo -e "  ${CHECK} Branch not yet merged"
    fi
else
    echo -e "  ${INFO} Skipping (on main branch)"
fi
echo ""

# 4. Check for uncommitted changes
echo -e "${BOLD}4. Uncommitted Changes Check${NC}"
status_output="$(git status --porcelain)"
if [[ -n "${status_output}" ]]; then
    CHANGE_COUNT=$(git status --porcelain | wc -l)
    echo -e "  ${INFO} Found ${YELLOW}${CHANGE_COUNT}${NC} uncommitted file(s)"
    echo -e "  ${INFO} /ship will commit these for you"
    git status --short | head -5 | sed 's/^/    /'
else
    echo -e "  ${CHECK} No uncommitted changes"
fi
echo ""

# 5. Check main branch freshness
echo -e "${BOLD}5. Main Branch Freshness${NC}"
MAIN_BRANCH="main"
if ! git show-ref --verify --quiet refs/heads/main; then
    MAIN_BRANCH="master"
fi

# Check last fetch time
FETCH_HEAD=".git/FETCH_HEAD"
if [[ -f "${FETCH_HEAD}" ]]; then
    if [[ "${OSTYPE}" == "darwin"* ]]; then
        LAST_FETCH=$(stat -f "%m" "${FETCH_HEAD}")
    else
        LAST_FETCH=$(stat -c "%Y" "${FETCH_HEAD}")
    fi
    CURRENT_TIME=$(date +%s)
    HOURS_AGO=$(( (CURRENT_TIME - LAST_FETCH) / 3600 ))
    
    if [[ ${HOURS_AGO} -gt 24 ]]; then
        echo -e "  ${WARN} Repository data is ${YELLOW}${HOURS_AGO} hours${NC} old"
        auto_fix "Fetching latest changes" "git fetch origin"
        fix_result=$?
        if [[ ${fix_result} -eq 0 ]]; then
            echo -e "  ${CHECK} Fetched latest changes"
        else
            fail_check "  ${CROSS} Repository is stale"
        fi
    else
        echo -e "  ${CHECK} Repository is up to date (${HOURS_AGO} hours old)"
    fi
else
    echo -e "  ${INFO} Unable to determine freshness"
fi
echo ""

# 6. Check for merge conflicts
echo -e "${BOLD}6. Merge Conflict Check${NC}"
if git ls-files -u | grep -q .; then
    fail_check "  ${STOP} Active merge conflicts detected!"
    echo -e "  ${INFO} Resolve conflicts before shipping"
    git diff --name-only --diff-filter=U | sed 's/^/    /'
else
    echo -e "  ${CHECK} No merge conflicts"
fi
echo ""

# 7. Safeguards summary
echo -e "${BOLD}7. Safeguards Check${NC}"

# Check for .gitignore
if [[ ! -f .gitignore ]]; then
    echo -e "  ${WARN} No .gitignore file found"
fi

# Check for sensitive files
SENSITIVE_PATTERNS=(".env.local" ".env.production" "*.pem" "*.key" "credentials" "secret")
FOUND_SENSITIVE=false
for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    if git ls-files | grep -q "${pattern}"; then
        FOUND_SENSITIVE=true
        echo -e "  ${WARN} Possible sensitive file: ${pattern}"
    fi
done

if [[ "${FOUND_SENSITIVE}" = false ]]; then
    echo -e "  ${CHECK} No obvious sensitive files staged"
fi
echo ""

# Final verdict
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${CYAN}                    Verdict${NC}"
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [[ "${IS_SAFE}" = true ]]; then
    echo -e "${BOLD}${GREEN}  ${GO} SAFE TO SHIP!${NC}"
    echo ""
    echo -e "  Current branch: ${GREEN}${CURRENT_BRANCH}${NC}"
    echo -e "  Ready to run: ${BOLD}/ship${NC}"
    echo ""
    echo -e "  ${INFO} After shipping, run: ${GREEN}./scripts/post-ship-cleanup.sh${NC}"
else
    echo -e "${BOLD}${RED}  ${STOP} NOT SAFE TO SHIP!${NC}"
    echo ""
    echo -e "  Please fix the issues above before shipping."
    echo -e "  Or run with ${GREEN}--auto-fix${NC} flag to attempt automatic fixes."
    echo ""
    echo -e "  ${INFO} For help, see: ${BLUE}docs/GIT_WORKFLOW_GUIDE.md${NC}"
fi

echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Exit code
if [[ "${IS_SAFE}" = true ]]; then
    exit 0
else
    exit 1
fi
