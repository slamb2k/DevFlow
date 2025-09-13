#!/usr/bin/env bash
# pr-rescue-core.sh - Analyze and resolve stuck PRs
set -euo pipefail

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Display colorful banner
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${SCRIPT_DIR}/block-text.sh" -s "PR RESCUE"
echo

# Parse arguments
MODE="${1:-analyze}"  # analyze, enable-auto-merge, update-branch, force-merge
PR_NUMBER="${2:-}"

# Function to analyze a PR
analyze_pr() {
  local pr_num=$1
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}Analyzing PR #$pr_num${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  
  # Get PR details
  local pr_json=$(gh pr view "$pr_num" --json number,title,state,mergeable,mergeStateStatus,autoMergeRequest,statusCheckRollup,createdAt,author)
  
  # Extract key information
  local title=$(echo "$pr_json" | jq -r '.title')
  local state=$(echo "$pr_json" | jq -r '.state')
  local mergeable=$(echo "$pr_json" | jq -r '.mergeable')
  local merge_status=$(echo "$pr_json" | jq -r '.mergeStateStatus')
  local auto_merge=$(echo "$pr_json" | jq -r '.autoMergeRequest')
  local created=$(echo "$pr_json" | jq -r '.createdAt')
  local author=$(echo "$pr_json" | jq -r '.author.login')
  
  echo -e "${BOLD}📋 PR Details:${NC}"
  echo -e "  Title: ${GREEN}$title${NC}"
  echo -e "  Author: ${BLUE}$author${NC}"
  echo -e "  Created: $created"
  echo -e "  State: $state"
  echo
  
  # Check status
  echo -e "${BOLD}🔍 Status Analysis:${NC}"
  
  # Check if all required checks passed
  local checks_json=$(echo "$pr_json" | jq '.statusCheckRollup[]')
  local all_checks_passed=true
  local failed_checks=""
  
  echo -e "${BOLD}  Required Checks:${NC}"
  while IFS= read -r check; do
    local name=$(echo "$check" | jq -r '.name')
    local conclusion=$(echo "$check" | jq -r '.conclusion')
    local status=$(echo "$check" | jq -r '.status')
    
    if [[ "$status" = "COMPLETED" ]]; then
      if [[ "$conclusion" = "SUCCESS" ]] || [[ "$conclusion" = "SKIPPED" ]]; then
        echo -e "    ✅ $name: ${GREEN}$conclusion${NC}"
      else
        echo -e "    ❌ $name: ${RED}$conclusion${NC}"
        all_checks_passed=false
        failed_checks="$failed_checks $name"
      fi
    else
      echo -e "    ⏳ $name: ${YELLOW}IN PROGRESS${NC}"
      all_checks_passed=false
    fi
  done <<< "$(echo "$pr_json" | jq -c '.statusCheckRollup[]')"
  
  echo
  echo -e "${BOLD}🎯 Merge Status:${NC}"
  echo -e "  Mergeable: $([ "$mergeable" = "MERGEABLE" ] && echo "${GREEN}YES${NC}" || echo "${RED}$mergeable${NC}")"
  echo -e "  Merge State: $([ "$merge_status" = "CLEAN" ] && echo "${GREEN}$merge_status${NC}" || echo "${YELLOW}$merge_status${NC}")"
  echo -e "  Auto-merge: $([ "$auto_merge" != "null" ] && echo "${GREEN}ENABLED${NC}" || echo "${YELLOW}DISABLED${NC}")"
  
  # Diagnose the issue
  echo
  echo -e "${BOLD}📊 Diagnosis:${NC}"
  
  local issues=()
  local solutions=()
  
  if [[ "$auto_merge" = "null" ]]; then
    issues+=("Auto-merge is not enabled")
    solutions+=("Enable auto-merge: gh pr merge $pr_num --auto --squash")
  fi
  
  if [[ "$merge_status" = "BEHIND" ]]; then
    issues+=("Branch is behind main")
    solutions+=("Update branch: gh pr merge $pr_num --rebase || git checkout <branch> && git rebase origin/main && git push --force-with-lease")
  fi
  
  if [[ "$merge_status" = "CONFLICTING" ]]; then
    issues+=("Branch has merge conflicts")
    solutions+=("Resolve conflicts manually, then push")
  fi
  
  if [[ "$all_checks_passed" = false ]] && [[ -n "$failed_checks" ]]; then
    issues+=("Some checks failed:$failed_checks")
    solutions+=("Fix failing checks or use --force flag to merge anyway")
  fi
  
  if [[ ${#issues[@]} -eq 0 ]] && [[ "$all_checks_passed" = true ]] && [[ "$mergeable" = "MERGEABLE" ]]; then
    if [[ "$auto_merge" = "null" ]]; then
      issues+=("PR is ready but auto-merge was never enabled")
      solutions+=("Enable auto-merge now")
    else
      issues+=("Unknown - PR appears ready but hasn't merged")
      solutions+=("Try disabling and re-enabling auto-merge")
    fi
  fi
  
  # Display issues
  if [[ ${#issues[@]} -gt 0 ]]; then
    echo -e "${YELLOW}  Issues Found:${NC}"
    for issue in "${issues[@]}"; do
      echo -e "    • $issue"
    done
  else
    echo -e "${GREEN}  No issues detected${NC}"
  fi
  
  # Display solutions
  if [[ ${#solutions[@]} -gt 0 ]]; then
    echo
    echo -e "${BOLD}💡 Recommended Actions:${NC}"
    local i=1
    for solution in "${solutions[@]}"; do
      echo -e "  $i. $solution"
      ((i++))
    done
  fi
  
  echo
}

# Function to enable auto-merge
enable_auto_merge() {
  local pr_num=$1
  echo -e "${GREEN}🤖 Enabling auto-merge for PR #$pr_num...${NC}"
  
  if gh pr merge "$pr_num" --auto --squash; then
    echo -e "${GREEN}✅ Auto-merge enabled successfully${NC}"
    echo -e "${CYAN}PR will merge automatically when all checks pass${NC}"
  else
    echo -e "${RED}❌ Failed to enable auto-merge${NC}"
    return 1
  fi
}

# Function to update branch
update_branch() {
  local pr_num=$1
  echo -e "${GREEN}🔄 Updating PR #$pr_num branch...${NC}"
  
  # Get PR branch name
  local branch=$(gh pr view "$pr_num" --json headRefName --jq '.headRefName')
  
  # Try to update via GitHub first
  echo "Attempting to update via GitHub..."
  if gh api "repos/{owner}/{repo}/pulls/$pr_num/update-branch" -X PUT 2>/dev/null; then
    echo -e "${GREEN}✅ Branch updated via GitHub${NC}"
  else
    echo "GitHub update failed, trying local rebase..."
    
    # Fetch and checkout branch
    git fetch origin "$branch"
    git checkout "$branch"
    
    # Rebase on main
    if git rebase origin/main; then
      # Push with force-with-lease
      if git push --force-with-lease origin "$branch"; then
        echo -e "${GREEN}✅ Branch rebased and pushed successfully${NC}"
      else
        echo -e "${RED}❌ Failed to push rebased branch${NC}"
        git rebase --abort 2>/dev/null || true
        return 1
      fi
    else
      echo -e "${RED}❌ Rebase failed - manual conflict resolution required${NC}"
      git rebase --abort 2>/dev/null || true
      return 1
    fi
  fi
}

# Function to force merge
force_merge() {
  local pr_num=$1
  echo -e "${YELLOW}⚠️  Force merging PR #$pr_num...${NC}"
  echo -e "${YELLOW}This will merge even with failing checks!${NC}"
  
  if gh pr merge "$pr_num" --squash --admin; then
    echo -e "${GREEN}✅ PR force merged successfully${NC}"
  else
    echo -e "${RED}❌ Failed to force merge (may require admin permissions)${NC}"
    return 1
  fi
}

# Main logic
case "${MODE}" in
  analyze)
    # Get all open PRs
    echo -e "${BOLD}${BLUE}🔍 Analyzing all open PRs...${NC}"
    echo
    
    pr_numbers=$(gh pr list --state open --json number --jq '.[].number')
    
    if [[ -z "$pr_numbers" ]]; then
      echo -e "${GREEN}✨ No open PRs found!${NC}"
      exit 0
    fi
    
    for pr in $pr_numbers; do
      analyze_pr "$pr"
    done
    
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}📋 Summary${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "Found $(echo "$pr_numbers" | wc -w) open PR(s)"
    echo
    echo -e "${BOLD}Available Actions:${NC}"
    echo -e "  • Enable auto-merge: ${CYAN}./scripts/pr-rescue-core.sh enable-auto-merge <PR#>${NC}"
    echo -e "  • Update branch:     ${CYAN}./scripts/pr-rescue-core.sh update-branch <PR#>${NC}"
    echo -e "  • Force merge:       ${CYAN}./scripts/pr-rescue-core.sh force-merge <PR#>${NC}"
    ;;
    
  enable-auto-merge)
    if [[ -z "${PR_NUMBER}" ]]; then
      echo -e "${RED}Error: PR number required${NC}"
      echo "Usage: $0 enable-auto-merge <PR#>"
      exit 1
    fi
    enable_auto_merge "${PR_NUMBER}"
    ;;
    
  update-branch)
    if [[ -z "${PR_NUMBER}" ]]; then
      echo -e "${RED}Error: PR number required${NC}"
      echo "Usage: $0 update-branch <PR#>"
      exit 1
    fi
    update_branch "${PR_NUMBER}"
    ;;
    
  force-merge)
    if [[ -z "${PR_NUMBER}" ]]; then
      echo -e "${RED}Error: PR number required${NC}"
      echo "Usage: $0 force-merge <PR#>"
      exit 1
    fi
    force_merge "${PR_NUMBER}"
    ;;
    
  *)
    echo -e "${RED}Unknown mode: ${MODE}${NC}"
    echo "Available modes: analyze, enable-auto-merge, update-branch, force-merge"
    exit 1
    ;;
esac
