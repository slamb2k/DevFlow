#!/usr/bin/env bash
# scrub-core.sh - Comprehensive branch cleanup with safety checks
set -euo pipefail

# Parse arguments
FORCE=false
QUIET=false
DRY_RUN=false

for arg in "$@"; do
  case $arg in
    --force) FORCE=true ;;
    --quiet) QUIET=true ;;
    --dry-run) DRY_RUN=true ;;
  esac
done

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# Display colorful banner
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${SCRIPT_DIR}/block-text.sh" -s "SCRUBBING"
echo

# Get default branch
DEFAULT=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo 'main')

# Function to check if a branch has been squash-merged
is_squash_merged() {
  local BRANCH=$1
  local BASE=${2:-${DEFAULT}}
  
  # Method 1: Check if all commits are cherry-picked/equivalent
  # git cherry returns '-' for commits that are equivalent in upstream
  local UNMERGED_COUNT
  UNMERGED_COUNT=$(git cherry "${BASE}" "${BRANCH}" 2>/dev/null | grep '^+' | wc -l)
  UNMERGED_COUNT=${UNMERGED_COUNT:-0}
  # Remove any whitespace or newlines
  UNMERGED_COUNT=$(echo "${UNMERGED_COUNT}" | tr -d '[:space:]')
  if [[ "${UNMERGED_COUNT}" -eq 0 ]]; then
    return 0  # All commits are equivalent, branch is merged
  fi
  
  # Method 2: Check if the patch is empty when applied to base
  # This catches squash merges where the changes are already in base
  local PATCH_EMPTY=false
  local MERGE_BASE=$(git merge-base "${BASE}" "${BRANCH}" 2>/dev/null || true)
  if [[ -n "${MERGE_BASE}" ]]; then
    # Get the cumulative diff and check if it is already applied
    local DIFF=$(git diff "${BASE}"..."${BRANCH}" 2>/dev/null | wc -l)
    if [[ "${DIFF}" -eq 0 ]]; then
      PATCH_EMPTY=true
    fi
  fi
  
  if [[ "${PATCH_EMPTY}" = true ]]; then
    return 0  # Changes are already in base
  fi
  
  # Method 3: Look for PR merge commits that reference this branch
  # Search for squash merge commits in the base branch
  local BRANCH_SHORT=${BRANCH#origin/}
  local SQUASH_COMMIT=$(git log "${BASE}" --grep="${BRANCH_SHORT}" --grep="(#[0-9]*)" --pretty=format:"%H" -n 1 2>/dev/null || true)
  if [[ -n "${SQUASH_COMMIT}" ]]; then
    return 0  # Found a merge commit referencing this branch
  fi
  
  return 1  # Branch is not merged
}

echo -e "${GREEN}🔍 Analyzing branches...${NC}"

# Fetch and prune
git fetch --all --prune >/dev/null 2>&1
echo "✓ Fetched latest remote state"

# Track cleanup stats
REMOTE_DELETED=0
LOCAL_DELETED=0
PRESERVED=0
PRESERVED_BRANCHES=()

# Clean up remote branches
REMOTE_BRANCHES=$(git branch -r | grep -v HEAD | grep -v main | grep -v master || true)
REMOTE_COUNT=0
if [[ -n "${REMOTE_BRANCHES}" ]]; then
  REMOTE_COUNT=$(echo "${REMOTE_BRANCHES}" | wc -l)
fi
echo "✓ Found ${REMOTE_COUNT} remote branches to check"

if [[ -n "${REMOTE_BRANCHES}" ]]; then
  for branch in ${REMOTE_BRANCHES}; do
  BRANCH_NAME="${branch#origin/}"
  
  # Check PR status
  MERGED_PR=$(gh pr list --head "${BRANCH_NAME}" --state merged --json number --jq ".[0].number" 2>/dev/null || true)
  OPEN_PR=$(gh pr list --head "${BRANCH_NAME}" --state open --json number --jq ".[0].number" 2>/dev/null || true)
  
  # Skip if open PR
  if [[ -n "${OPEN_PR}" ]]; then
    echo -e "${BLUE}⏭️ Skipping ${BRANCH_NAME} (open PR #${OPEN_PR})${NC}"
    continue
  fi
  
  if [[ -n "${MERGED_PR}" ]]; then
    # Check for unmerged commits
    UNMERGED=$(git rev-list --count origin/${BRANCH_NAME} ^${DEFAULT} 2>/dev/null || echo 0)
    
    # Check for squash merge even if commits appear unmerged
    if [[ "${UNMERGED}" -gt 0 ]]; then
      if is_squash_merged "origin/${BRANCH_NAME}" "${DEFAULT}"; then
        # Branch is squash-merged, treat as safe to delete
        if [[ "${DRY_RUN}" = true ]]; then
          echo -e "${GREEN}[DRY RUN] Would delete: ${BRANCH_NAME} (PR #${MERGED_PR} squash-merged)${NC}"
        else
          git push origin --delete "${BRANCH_NAME}" >/dev/null 2>&1 && {
            echo -e "${GREEN}🗑️ Deleted squash-merged remote: ${BRANCH_NAME} (PR #${MERGED_PR})${NC}"
            REMOTE_DELETED=$((REMOTE_DELETED + 1))
          }
        fi
        continue
      fi
    fi
    
    if [[ "${UNMERGED}" -gt 0 ]]; then
      if [[ "${FORCE}" = true ]]; then
        # Force delete
        if [[ "${DRY_RUN}" = true ]]; then
          echo -e "${RED}[DRY RUN] Would force delete: ${BRANCH_NAME} (PR #${MERGED_PR}, ${UNMERGED} commits)${NC}"
        else
          git push origin --delete "${BRANCH_NAME}" >/dev/null 2>&1 && {
            echo -e "${RED}🗑️ Force deleted: ${BRANCH_NAME} (PR #${MERGED_PR}, ${UNMERGED} commits lost!)${NC}"
            REMOTE_DELETED=$((REMOTE_DELETED + 1))
          }
        fi
      elif [[ "${QUIET}" = true ]]; then
        # Skip in quiet mode
        PRESERVED_BRANCHES+=("${BRANCH_NAME} (${UNMERGED} commits)")
        PRESERVED=$((PRESERVED + 1))
      else
        # Ask user
        echo -e "\n${YELLOW}⚠️ Branch ${BRANCH_NAME} has ${UNMERGED} unmerged commit(s) but PR #${MERGED_PR} was merged${NC}"
        echo -e "${BLUE}Recent commits:${NC}"
        git log --oneline -5 origin/${BRANCH_NAME} ^${DEFAULT} 2>/dev/null || true
        
        echo -ne "${YELLOW}Delete this branch? (y/N): ${NC}"
        read -r CONFIRM
        if [[ "${CONFIRM}" =~ ^[Yy]$ ]]; then
          if [[ "${DRY_RUN}" = true ]]; then
            echo -e "${YELLOW}[DRY RUN] Would delete: ${BRANCH_NAME}${NC}"
          else
            git push origin --delete "${BRANCH_NAME}" >/dev/null 2>&1 && {
              echo -e "${GREEN}🗑️ Deleted: ${BRANCH_NAME}${NC}"
              REMOTE_DELETED=$((REMOTE_DELETED + 1))
            }
          fi
        else
          echo -e "${BLUE}⏭️ Preserved ${BRANCH_NAME}${NC}"
          PRESERVED_BRANCHES+=("${BRANCH_NAME} (${UNMERGED} commits)")
          PRESERVED=$((PRESERVED + 1))
        fi
      fi
    else
      # Safe to delete
      if [[ "${DRY_RUN}" = true ]]; then
        echo -e "${GREEN}[DRY RUN] Would delete: ${BRANCH_NAME} (PR #${MERGED_PR} merged, no unmerged commits)${NC}"
      else
        git push origin --delete "${BRANCH_NAME}" >/dev/null 2>&1 && {
          echo -e "${GREEN}🗑️ Deleted orphaned remote: ${BRANCH_NAME} (PR #${MERGED_PR})${NC}"
          REMOTE_DELETED=$((REMOTE_DELETED + 1))
        }
      fi
    fi
  fi
  done
fi

# Clean up local branches
LOCAL_BRANCHES=$(git branch | grep -v "^\*" | grep -v "${DEFAULT}" | grep -v master || true)
LOCAL_COUNT=0
if [[ -n "${LOCAL_BRANCHES}" ]]; then
  LOCAL_COUNT=$(echo "${LOCAL_BRANCHES}" | wc -l)
fi
echo "✓ Found ${LOCAL_COUNT} local branches to check"

if [[ -n "${LOCAL_BRANCHES}" ]]; then
  for branch in ${LOCAL_BRANCHES}; do
  BRANCH_NAME="$(echo "$branch" | xargs)"
  
  # Check if fully merged
  if git branch --merged "${DEFAULT}" | grep -qx "  ${BRANCH_NAME}"; then
    # Safe to delete
    if [[ "${DRY_RUN}" = true ]]; then
      echo -e "${GREEN}[DRY RUN] Would delete local: ${BRANCH_NAME} (fully merged)${NC}"
    else
      git branch -d "${BRANCH_NAME}" >/dev/null 2>&1 && {
        echo -e "${GREEN}🧹 Deleted local branch: ${BRANCH_NAME}${NC}"
        LOCAL_DELETED=$((LOCAL_DELETED + 1))
      }
    fi
  else
    # Has unmerged commits
    UNMERGED=$(git rev-list --count ${BRANCH_NAME} ^${DEFAULT} 2>/dev/null || echo 0)
    REMOTE_EXISTS=$(git ls-remote --heads origin "${BRANCH_NAME}" 2>/dev/null || true)
    
    # Check for squash merge even if commits appear unmerged
    if [[ "${UNMERGED}" -gt 0 ]]; then
      if is_squash_merged "${BRANCH_NAME}" "${DEFAULT}"; then
        # Branch is squash-merged, treat as safe to delete
        if [[ "${DRY_RUN}" = true ]]; then
          echo -e "${GREEN}[DRY RUN] Would delete local: ${BRANCH_NAME} (squash-merged)${NC}"
        else
          git branch -D "${BRANCH_NAME}" >/dev/null 2>&1 && {
            echo -e "${GREEN}🧹 Deleted squash-merged local: ${BRANCH_NAME}${NC}"
            LOCAL_DELETED=$((LOCAL_DELETED + 1))
          }
        fi
        continue
      fi
    fi
    
    if [[ "${UNMERGED}" -gt 0 ]] && [[ -z "${REMOTE_EXISTS}" ]]; then
      # Local-only with unmerged commits
      if [[ "${FORCE}" = true ]]; then
        if [[ "${DRY_RUN}" = true ]]; then
          echo -e "${RED}[DRY RUN] Would force delete local: ${BRANCH_NAME} (${UNMERGED} commits)${NC}"
        else
          git branch -D "${BRANCH_NAME}" >/dev/null 2>&1 && {
            echo -e "${RED}🗑️ Force deleted local: ${BRANCH_NAME} (${UNMERGED} commits lost!)${NC}"
            LOCAL_DELETED=$((LOCAL_DELETED + 1))
          }
        fi
      elif [[ "${QUIET}" = false ]]; then
        echo -e "\n${YELLOW}⚠️ Local branch ${BRANCH_NAME} has ${UNMERGED} unmerged commit(s) and no remote${NC}"
        echo -e "${BLUE}Recent commits:${NC}"
        git log --oneline -5 ${BRANCH_NAME} ^${DEFAULT} 2>/dev/null || true
        
        echo -ne "${YELLOW}Delete this local branch? (y/N): ${NC}"
        read -r CONFIRM
        if [[ "${CONFIRM}" =~ ^[Yy]$ ]]; then
          if [[ "${DRY_RUN}" = true ]]; then
            echo -e "${YELLOW}[DRY RUN] Would delete local: ${BRANCH_NAME}${NC}"
          else
            git branch -D "${BRANCH_NAME}" >/dev/null 2>&1 && {
              echo -e "${GREEN}🗑️ Deleted local: ${BRANCH_NAME}${NC}"
              LOCAL_DELETED=$((LOCAL_DELETED + 1))
            }
          fi
        else
          echo -e "${BLUE}⏭️ Preserved ${BRANCH_NAME}${NC}"
          PRESERVED_BRANCHES+=("${BRANCH_NAME} (local, ${UNMERGED} commits)")
          PRESERVED=$((PRESERVED + 1))
        fi
      else
        PRESERVED_BRANCHES+=("${BRANCH_NAME} (local, ${UNMERGED} commits)")
        PRESERVED=$((PRESERVED + 1))
      fi
    fi
  fi
  done
fi

# Report summary
echo -e "\n${GREEN}📊 Cleanup Summary:${NC}"

if [[ "${DRY_RUN}" = true ]]; then
  echo -e "${YELLOW}[DRY RUN MODE - No actual deletions]${NC}"
fi

if [[ ${REMOTE_DELETED} -gt 0 ]]; then
  echo -e "  ${GREEN}• Deleted ${REMOTE_DELETED} remote branch(es)${NC}"
fi

if [[ ${LOCAL_DELETED} -gt 0 ]]; then
  echo -e "  ${GREEN}• Deleted ${LOCAL_DELETED} local branch(es)${NC}"
fi

if [[ ${PRESERVED} -gt 0 ]]; then
  echo -e "  ${YELLOW}• Preserved ${PRESERVED} branch(es) with unmerged commits${NC}"
  for branch in "${PRESERVED_BRANCHES[@]}"; do
    echo -e "    ${YELLOW}- $branch${NC}"
  done
fi

if [[ ${REMOTE_DELETED} -eq 0 ]] && [[ ${LOCAL_DELETED} -eq 0 ]] && [[ ${PRESERVED} -eq 0 ]]; then
  echo -e "  ${GREEN}✨ No branches to clean up${NC}"
fi

# Return appropriate exit code
if [[ "${FORCE}" = true ]] && [[ ${PRESERVED} -gt 0 ]]; then
  exit 1  # Force mode but still had preserved branches
else
  exit 0
fi
