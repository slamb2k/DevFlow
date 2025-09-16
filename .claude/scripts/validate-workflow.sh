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

# Check 1: Git hooks are installed
echo "Checking git hooks..."
if [ -f ".git/hooks/pre-push" ] && [ -x ".git/hooks/pre-push" ]; then
    echo -e "  ${GREEN}✓${NC} Pre-push hook is installed and executable"
else
    echo -e "  ${RED}✗${NC} Pre-push hook is missing or not executable"
    echo "    Fix: The pre-push hook should have been created automatically"
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

    # Check if it sets the workflow flag
    if grep -q "SHIP_WORKFLOW_ACTIVE=true" .claude/scripts/ship-core.sh 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Ship-core sets workflow authorization flag"
    else
        echo -e "  ${YELLOW}⚠${NC} Ship-core may not set workflow flag"
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
    echo "    Remember: Always use /ship for changes"
else
    echo -e "  ${GREEN}✓${NC} On feature branch: $CURRENT_BRANCH"
fi

# Check 5: Look for any uncommitted changes that might bypass workflow
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo -e "  ${YELLOW}⚠${NC} Uncommitted changes detected"
    echo "    Use /ship to commit and push changes"
else
    echo -e "  ${GREEN}✓${NC} Working directory is clean"
fi

# Summary
echo
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Summary:${NC}"
echo "  • Use /ship command for all code changes"
echo "  • Direct pushes to main require explicit permission"
echo "  • Pre-push hook enforces these rules as a safety net"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"