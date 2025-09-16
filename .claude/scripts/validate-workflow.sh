#!/bin/bash
# Workflow validation script to ensure rules are being followed

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 DevFlow Workflow Validation${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

# Check 1: Launch script is available
echo "Checking launch command availability..."
if [ -f ".claude/scripts/launch-core.sh" ] && [ -x ".claude/scripts/launch-core.sh" ]; then
    echo -e "  ${GREEN}✓${NC} Launch script is available for creating feature branches"
else
    echo -e "  ${YELLOW}⚠${NC} Launch script is missing or not executable"
fi

# Check 2: CLAUDE.md rules are in place
echo
echo "Checking CLAUDE.md rules..."
if [ -f "CLAUDE.md" ]; then
    if grep -q "MANDATORY - THESE RULES MUST NEVER BE REMOVED" CLAUDE.md 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} CLAUDE.md contains mandatory workflow rules"
    else
        echo -e "  ${YELLOW}⚠${NC} CLAUDE.md exists but may be missing mandatory rules"
    fi
else
    echo -e "  ${RED}✗${NC} CLAUDE.md is missing"
fi

# Check 3: Ship scripts are available
echo
echo "Checking ship command availability..."
if [ -f ".claude/scripts/ship-core.sh" ] && [ -x ".claude/scripts/ship-core.sh" ]; then
    echo -e "  ${GREEN}✓${NC} Ship-core script is available and executable"

    # Check if it handles main branch properly
    if grep -q "Consider using 'launch' command first" .claude/scripts/ship-core.sh 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Ship-core suggests launch when on main branch"
    fi
else
    echo -e "  ${RED}✗${NC} Ship-core script is missing or not executable"
fi

# Check 4: Current branch status
echo
echo "Checking current git status..."
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ "$CURRENT_BRANCH" == "main" ] || [ "$CURRENT_BRANCH" == "master" ]; then
    echo -e "  ${YELLOW}⚠${NC} Currently on $CURRENT_BRANCH branch"

    # Check for uncommitted changes on main
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
        echo -e "  ${YELLOW}⚠${NC} Uncommitted changes on $CURRENT_BRANCH"
        echo "    Recommended: Use /launch first to create a feature branch"
        echo "    Then: Use /ship to create a PR"
    else
        echo "    Remember: Create feature branches for all changes"
    fi
else
    echo -e "  ${GREEN}✓${NC} On feature branch: $CURRENT_BRANCH"

    # Check for uncommitted changes on feature branch
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
        echo -e "  ${YELLOW}⚠${NC} Uncommitted changes detected"
        echo "    Use /ship to commit and create PR"
    else
        echo -e "  ${GREEN}✓${NC} Working directory is clean"
    fi
fi

# Summary
echo
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Workflow Summary:${NC}"
echo "  • On main with changes: Use /launch to create feature branch"
echo "  • On feature branch: Use /ship to create PR"
echo "  • Never push directly to main (except rare CI fixes)"
echo "  • ship-core.sh always creates PRs, never pushes to main"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"