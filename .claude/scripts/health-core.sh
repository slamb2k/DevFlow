#!/bin/bash

# 🔍 Git Health Check - Comprehensive diagnostic script
# Detects potential git workflow issues before they become problems

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Emoji indicators
CHECK="✅"
CROSS="❌"
WARN="⚠️ "
INFO="ℹ️ "
ROCKET="🚀"
FIRE="🔥"

# Track overall health
HEALTH_SCORE=100
ISSUES_FOUND=0

# Display colorful banner
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${SCRIPT_DIR}/block-text.sh" -s "HEALTH CHECK"
echo

# Function to reduce health score
reduce_health() {
    local penalty=$1
    local reason=$2
    HEALTH_SCORE=$((HEALTH_SCORE - penalty))
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    echo -e "${RED}  [-$penalty points] $reason${NC}"
}

# 1. Check current branch
echo -e "${BOLD}1. Current Branch Check${NC}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "${CURRENT_BRANCH}" = "main" ]] || [[ "${CURRENT_BRANCH}" = "master" ]]; then
    echo -e "  ${WARN} You're on ${RED}${CURRENT_BRANCH}${NC} branch"
    reduce_health 20 "Working directly on main branch"
    echo -e "  ${INFO} Recommendation: ${GREEN}git checkout -b feature/new-work${NC}"
else
    echo -e "  ${CHECK} On feature branch: ${GREEN}${CURRENT_BRANCH}${NC}"
fi
echo ""

# 2. Check for uncommitted changes
echo -e "${BOLD}2. Uncommitted Changes Check${NC}"
if [[ -n "$(git status --porcelain)" ]]; then
    CHANGE_COUNT=$(git status --porcelain | wc -l)
    echo -e "  ${WARN} Found ${YELLOW}${CHANGE_COUNT}${NC} uncommitted changes"
    reduce_health 10 "Uncommitted changes present"
    echo -e "  ${INFO} Files with changes:"
    git status --short | head -5 | sed 's/^/    /'
    if [[ ${CHANGE_COUNT} -gt 5 ]]; then
        echo -e "    ... and $((CHANGE_COUNT - 5)) more"
    fi
else
    echo -e "  ${CHECK} Working directory clean"
fi
echo ""

# 3. Check for unpushed commits
echo -e "${BOLD}3. Unpushed Commits Check${NC}"
UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "")
if [[ -n "${UPSTREAM}" ]]; then
    UNPUSHED=$(git rev-list HEAD ^"${UPSTREAM}" 2>/dev/null | wc -l)
    if [[ "${UNPUSHED}" -gt 0 ]]; then
        echo -e "  ${WARN} ${YELLOW}${UNPUSHED}${NC} unpushed commits"
        if [[ "${CURRENT_BRANCH}" = "main" ]] || [[ "${CURRENT_BRANCH}" = "master" ]]; then
            echo -e "  ${FIRE} ${RED}DANGER: Unpushed commits on main!${NC}"
            reduce_health 30 "Unpushed commits on main branch"
        else
            reduce_health 5 "Unpushed commits on feature branch"
        fi
        echo -e "  ${INFO} Recent unpushed commits:"
        git log --oneline "${UPSTREAM}"..HEAD | head -3 | sed 's/^/    /'
    else
        echo -e "  ${CHECK} All commits pushed"
    fi
else
    echo -e "  ${INFO} No upstream branch set"
fi
echo ""

# 4. Check for divergence
echo -e "${BOLD}4. Branch Divergence Check${NC}"
if [[ -n "${UPSTREAM}" ]]; then
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse "${UPSTREAM}" 2>/dev/null || echo "")
    BASE=$(git merge-base HEAD "${UPSTREAM}" 2>/dev/null || echo "")
    
    if [[ "${LOCAL}" = "${REMOTE}" ]]; then
        echo -e "  ${CHECK} Branch in sync with upstream"
    elif [[ "${LOCAL}" = "${BASE}" ]]; then
        BEHIND=$(git rev-list HEAD.."${UPSTREAM}" | wc -l)
        echo -e "  ${INFO} Branch is ${YELLOW}${BEHIND}${NC} commits behind"
        reduce_health 10 "Branch is behind upstream"
        echo -e "  ${INFO} Recommendation: ${GREEN}git pull${NC}"
    elif [[ "${REMOTE}" = "${BASE}" ]]; then
        echo -e "  ${INFO} Branch is ahead of upstream (OK for feature branches)"
    else
        echo -e "  ${FIRE} ${RED}DIVERGED: Branches have diverged!${NC}"
        reduce_health 40 "Branch has diverged from upstream"
        BEHIND=$(git rev-list HEAD.."${UPSTREAM}" 2>/dev/null | wc -l)
        AHEAD=$(git rev-list "${UPSTREAM}"..HEAD 2>/dev/null | wc -l)
        echo -e "  ${INFO} Behind by ${BEHIND}, Ahead by ${AHEAD} commits"
        echo -e "  ${INFO} Fix with: ${GREEN}git fetch && git reset --hard ${UPSTREAM}${NC}"
    fi
else
    echo -e "  ${INFO} No upstream to compare"
fi
echo ""

# 5. Check main branch freshness
echo -e "${BOLD}5. Main Branch Freshness Check${NC}"
if git show-ref --verify --quiet refs/heads/main; then
    MAIN_BRANCH="main"
elif git show-ref --verify --quiet refs/heads/master; then
    MAIN_BRANCH="master"
else
    MAIN_BRANCH=""
fi

if [[ -n "${MAIN_BRANCH}" ]]; then
    # Get the last fetch time
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
            echo -e "  ${WARN} Last fetch was ${YELLOW}${HOURS_AGO} hours${NC} ago"
            reduce_health 15 "Stale repository (not fetched in >24 hours)"
            echo -e "  ${INFO} Recommendation: ${GREEN}git fetch origin${NC}"
        else
            echo -e "  ${CHECK} Last fetch was ${HOURS_AGO} hours ago"
        fi
    else
        echo -e "  ${INFO} Unable to determine last fetch time"
    fi
    
    # Check if main is behind origin
    git fetch origin "${MAIN_BRANCH}" --dry-run 2>&1 | grep -q "up to date" || {
        echo -e "  ${WARN} Main branch may be behind origin"
        echo -e "  ${INFO} Run: ${GREEN}git checkout ${MAIN_BRANCH} && git pull origin ${MAIN_BRANCH}${NC}"
    }
else
    echo -e "  ${INFO} No main/master branch found"
fi
echo ""

# 6. Check for stashed changes
echo -e "${BOLD}6. Stashed Changes Check${NC}"
STASH_COUNT=$(git stash list | wc -l)
if [[ "${STASH_COUNT}" -gt 0 ]]; then
    echo -e "  ${INFO} Found ${YELLOW}${STASH_COUNT}${NC} stashed change(s)"
    echo -e "  ${INFO} Latest stash:"
    git stash list | head -1 | sed 's/^/    /'
    if [[ "${STASH_COUNT}" -gt 3 ]]; then
        reduce_health 5 "Many stashed changes may indicate workflow issues"
    fi
else
    echo -e "  ${CHECK} No stashed changes"
fi
echo ""

# 7. Check for merge conflicts
echo -e "${BOLD}7. Merge Conflict Check${NC}"
if git ls-files -u | grep -q .; then
    echo -e "  ${FIRE} ${RED}Active merge conflicts detected!${NC}"
    reduce_health 50 "Unresolved merge conflicts"
    echo -e "  ${INFO} Conflicted files:"
    git diff --name-only --diff-filter=U | head -5 | sed 's/^/    /'
else
    echo -e "  ${CHECK} No merge conflicts"
fi
echo ""

# 8. Check remote branches
echo -e "${BOLD}8. Remote Branch Check${NC}"
if [[ "${CURRENT_BRANCH}" != "main" ]] && [[ "${CURRENT_BRANCH}" != "master" ]]; then
    if git ls-remote --heads origin | grep -q "refs/heads/${CURRENT_BRANCH}"; then
        echo -e "  ${INFO} Branch exists on remote"
        
        # Check if it's been merged
        MERGED_BRANCHES=$(git branch -r --merged origin/main 2>/dev/null | grep "origin/${CURRENT_BRANCH}" || true)
        if [[ -n "${MERGED_BRANCHES}" ]]; then
            echo -e "  ${WARN} This branch was already merged to main!"
            reduce_health 20 "Working on already-merged branch"
            echo -e "  ${INFO} Recommendation: Create a new feature branch"
        fi
    else
        echo -e "  ${INFO} Branch doesn't exist on remote (will be created on push)"
    fi
fi
echo ""

# 9. Check for large files
echo -e "${BOLD}9. Large Files Check${NC}"
LARGE_FILES=$(find . -type f -size +10M 2>/dev/null | grep -v ".git" | head -5 || true)
if [[ -n "${LARGE_FILES}" ]]; then
    echo -e "  ${WARN} Found large files (>10MB):"
    echo "${LARGE_FILES}" | sed 's/^/    /'
    reduce_health 5 "Large files may cause push issues"
else
    echo -e "  ${CHECK} No large files detected"
fi
echo ""

# Final Health Score
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${CYAN}                 Health Score${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Ensure score doesn't go below 0
if [[ ${HEALTH_SCORE} -lt 0 ]]; then
    HEALTH_SCORE=0
fi

# Display score with color coding
if [[ ${HEALTH_SCORE} -ge 80 ]]; then
    echo -e "${BOLD}${GREEN}  ${ROCKET} Score: ${HEALTH_SCORE}/100 - Excellent!${NC}"
    echo -e "  You're following best practices. Safe to proceed!"
elif [[ ${HEALTH_SCORE} -ge 60 ]]; then
    echo -e "${BOLD}${YELLOW}  ${WARN} Score: ${HEALTH_SCORE}/100 - Good${NC}"
    echo -e "  Minor issues detected. Consider addressing them."
elif [[ ${HEALTH_SCORE} -ge 40 ]]; then
    echo -e "${BOLD}${YELLOW}  ${WARN} Score: ${HEALTH_SCORE}/100 - Needs Attention${NC}"
    echo -e "  Several issues found. Fix before shipping."
else
    echo -e "${BOLD}${RED}  ${FIRE} Score: ${HEALTH_SCORE}/100 - Critical Issues!${NC}"
    echo -e "  Major problems detected. Do not ship without fixing!"
fi

echo ""
if [[ ${ISSUES_FOUND} -gt 0 ]]; then
    echo -e "${BOLD}  Issues Found: ${RED}${ISSUES_FOUND}${NC}"
    echo -e "${BOLD}  Run ${GREEN}./scripts/pre-ship-check.sh${NC} before shipping"
else
    echo -e "${BOLD}  ${CHECK} No issues found!${NC}"
fi

echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Exit with appropriate code
if [[ ${HEALTH_SCORE} -lt 40 ]]; then
    exit 1
else
    exit 0
fi
