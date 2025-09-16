#!/bin/bash
# han-solo.sh - Full-featured Han-Solo status line
# Shows: CWD | Branch | Git stats | Model | Safety warnings

# Colors
RED='\033[38;5;196m'
YELLOW='\033[38;5;226m'
GREEN='\033[38;5;46m'
BLUE='\033[38;5;117m'
CYAN='\033[38;5;51m'
ORANGE='\033[38;5;208m'
PURPLE='\033[38;5;141m'
GRAY='\033[38;5;244m'
NC='\033[0m'
BOLD='\033[1m'

# Icons
FOLDER='📁'
BRANCH_ICON='🌿'
STAR='🌟'
WARNING='⚠️'
CHECK='✅'
ROCKET='🚀'
MODEL='🤖'

# Read JSON from stdin if available (Claude Code provides this)
if [ ! -t 0 ]; then
  CLAUDE_JSON=$(cat)
else
  CLAUDE_JSON=""
fi

# Get current directory (basename only)
CWD=$(basename "$(pwd)")

# Get current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)

# Not in a git repo
if [ -z "$BRANCH" ]; then
  echo -e "${FOLDER} ${CYAN}${CWD}${NC} ${GRAY}(not a git repo)${NC}"
  exit 0
fi

# Get git statistics
get_git_stats() {
  local staged=$(git diff --cached --numstat 2>/dev/null | wc -l)
  local modified=$(git diff --numstat 2>/dev/null | wc -l)
  local untracked=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l)
  
  # Get lines added/removed for current changes
  local added=$(git diff --stat 2>/dev/null | tail -1 | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo "0")
  local removed=$(git diff --stat 2>/dev/null | tail -1 | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' || echo "0")
  
  local stats=""
  
  # File counts
  if [ "$staged" -gt 0 ]; then
    stats="${stats}${GREEN}●${staged}${NC} "
  fi
  if [ "$modified" -gt 0 ]; then
    stats="${stats}${ORANGE}●${modified}${NC} "
  fi
  if [ "$untracked" -gt 0 ]; then
    stats="${stats}${GRAY}●${untracked}${NC} "
  fi
  
  # Lines changed
  if [ "$added" -gt 0 ] || [ "$removed" -gt 0 ]; then
    stats="${stats}${GREEN}+${added}${NC}/${RED}-${removed}${NC}"
  fi
  
  if [ -z "$stats" ]; then
    echo "${GREEN}✓ clean${NC}"
  else
    echo "$stats"
  fi
}

# Get sync status
get_sync_status() {
  local upstream=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null)
  
  if [ -z "$upstream" ]; then
    echo "${GRAY}no remote${NC}"
    return
  fi
  
  local local_rev=$(git rev-parse HEAD 2>/dev/null)
  local remote_rev=$(git rev-parse @{u} 2>/dev/null)
  local base_rev=$(git merge-base HEAD @{u} 2>/dev/null)
  
  if [ "$local_rev" = "$remote_rev" ]; then
    echo "${GREEN}✓ synced${NC}"
  elif [ "$local_rev" = "$base_rev" ]; then
    local behind=$(git rev-list --count HEAD..@{u} 2>/dev/null)
    echo "${CYAN}↓${behind}${NC}"
  elif [ "$remote_rev" = "$base_rev" ]; then
    local ahead=$(git rev-list --count @{u}..HEAD 2>/dev/null)
    echo "${YELLOW}↑${ahead}${NC}"
  else
    echo "${RED}↕${NC}"
  fi
}

# Get PR status
get_pr_status() {
  if ! command -v gh &> /dev/null; then
    return
  fi

  local pr_num=$(gh pr list --head "$BRANCH" --json number --jq '.[0].number' 2>/dev/null)
  if [ -n "$pr_num" ]; then
    local pr_state=$(gh pr view "$pr_num" --json state,mergeable --jq '.state + ":" + .mergeable' 2>/dev/null)
    case "$pr_state" in
      *MERGED*)
        # Check if branch has commits after the merge
        local merge_commit=$(gh pr view "$pr_num" --json mergeCommit --jq '.mergeCommit.oid' 2>/dev/null)
        if [ -n "$merge_commit" ]; then
          local commits_after=$(git rev-list --count "$merge_commit"..HEAD 2>/dev/null || echo 0)
          if [ "$commits_after" -gt 0 ]; then
            echo "${YELLOW}PR#${pr_num}✓⚠️${NC}"  # Merged but has new commits (divergence warning)
          else
            echo "${GREEN}PR#${pr_num}✓${NC}"     # Cleanly merged
          fi
        else
          echo "${GREEN}PR#${pr_num}✓${NC}"       # Merged (can't check commits)
        fi
        ;;
      *OPEN:MERGEABLE*)
        echo "${BLUE}PR#${pr_num}→${NC}"
        ;;
      *OPEN:CONFLICTING*)
        echo "${RED}PR#${pr_num}⚡${NC}"
        ;;
      *)
        echo "${YELLOW}PR#${pr_num}${NC}"
        ;;
    esac
  fi
}

# Get model info from Claude Code JSON or environment
get_model_info() {
  local model_name=""
  local model_id=""
  local display_name=""
  
  # First try to get from Claude Code JSON (most accurate)
  if [ -n "$CLAUDE_JSON" ] && command -v jq &> /dev/null; then
    model_id=$(echo "$CLAUDE_JSON" | jq -r '.model.id // empty' 2>/dev/null)
    display_name=$(echo "$CLAUDE_JSON" | jq -r '.model.display_name // empty' 2>/dev/null)
  fi
  
  # If we got a display name from JSON, use it
  if [ -n "$display_name" ]; then
    model_name="$display_name"
  # Fallback to environment variable
  elif [ -n "$CLAUDE_MODEL" ]; then
    model_id="$CLAUDE_MODEL"
  fi
  
  # If we still don't have a name but have an ID, map it
  if [ -z "$model_name" ] && [ -n "$model_id" ]; then
    case "$model_id" in
      *opus-4-1*)
        model_name="Opus 4.1"
        ;;
      *claude-3-5-sonnet*|*claude-3.5-sonnet*)
        model_name="Sonnet 3.5"
        ;;
      *claude-3-5-haiku*|*claude-3.5-haiku*)
        model_name="Haiku 3.5"
        ;;
      *claude-3-opus*)
        model_name="Opus 3"
        ;;
      *claude-3-sonnet*)
        model_name="Sonnet 3"
        ;;
      *claude-3-haiku*)
        model_name="Haiku 3"
        ;;
      *sonnet*)
        model_name="Sonnet"
        ;;
      *opus*)
        model_name="Opus"
        ;;
      *haiku*)
        model_name="Haiku"
        ;;
      *)
        # If no match, use the raw model id but truncate if too long
        model_name="$model_id"
        if [ ${#model_name} -gt 15 ]; then
          model_name="${model_name:0:12}..."
        fi
        ;;
    esac
  fi
  
  # Display the model info
  if [ -n "$model_name" ]; then
    echo "${MODEL} ${PURPLE}${model_name}${NC}"
  else
    # Default if nothing is available
    echo "${MODEL} ${PURPLE}Claude${NC}"
  fi
}

# Get context usage using ccusage's efficient caching mechanism
get_context_usage() {
  local context_info=""
  local session_id=""
  local tokens_used=""
  local percentage_used=""
  
  # Extract session ID from Claude JSON
  if [ -n "$CLAUDE_JSON" ] && command -v jq &> /dev/null; then
    session_id=$(echo "$CLAUDE_JSON" | jq -r '.session_id // empty' 2>/dev/null)
  fi
  
  # TIER 1: Check ccusage cache file first (fastest <5ms)
  if [ -n "$session_id" ] && [ -f "/tmp/ccusage-semaphore/${session_id}.lock" ]; then
    local cache_file="/tmp/ccusage-semaphore/${session_id}.lock"
    
    # Read cache and check if it's fresh (within 1 second)
    if command -v jq &> /dev/null; then
      local cached_data=$(cat "$cache_file" 2>/dev/null)
      local last_update=$(echo "$cached_data" | jq -r '.lastUpdateTime // 0' 2>/dev/null)
      local last_output=$(echo "$cached_data" | jq -r '.lastOutput // empty' 2>/dev/null)
      local current_time=$(($(date +%s) * 1000))
      
      # Check if cache is fresh (within 1 second)
      if [ -n "$last_output" ] && [ $((current_time - last_update)) -lt 1000 ]; then
        # Extract context portion from cached output - look for the percentage in parentheses
        local context_part=$(echo "$last_output" | grep -oE '🧠[^|]*' | sed 's/[[:space:]]*$//')
        if [ -n "$context_part" ] && [ "$context_part" != "🧠 N/A" ]; then
          # Extract the percentage from the cached output (e.g., "🧠 36,203 (18%)")
          percentage_used=$(echo "$context_part" | grep -oE '\([0-9]+%\)' | tr -d '()%')
        fi
      fi
    fi
  fi
  
  # TIER 2: Call ccusage statusline if we didn't get percentage from cache
  if [ -z "$percentage_used" ] && command -v ccusage &> /dev/null && [ -n "$CLAUDE_JSON" ]; then
    # Pass the JSON to ccusage and extract just the context portion
    local ccusage_output=$(echo "$CLAUDE_JSON" | ccusage statusline 2>/dev/null || echo "")
    
    # Extract the brain emoji portion (context usage)
    if [ -n "$ccusage_output" ]; then
      # Look for the 🧠 emoji and extract that portion
      local context_part=$(echo "$ccusage_output" | grep -oE '🧠[^|]*' | sed 's/[[:space:]]*$//')
      if [ -n "$context_part" ] && [ "$context_part" != "🧠 N/A" ]; then
        # Extract the percentage from the output
        percentage_used=$(echo "$context_part" | grep -oE '\([0-9]+%\)' | tr -d '()%')
      fi
    fi
  fi
  
  # TIER 3: Calculate from Claude JSON directly if still no percentage
  if [ -z "$percentage_used" ] && [ -n "$CLAUDE_JSON" ] && command -v jq &> /dev/null; then
    local tokens_used_num=$(echo "$CLAUDE_JSON" | jq -r '.context.tokens_used // empty' 2>/dev/null)
    local max_tokens=$(echo "$CLAUDE_JSON" | jq -r '.context.max_tokens // empty' 2>/dev/null)
    
    if [ -n "$tokens_used_num" ] && [ -n "$max_tokens" ] && [ "$max_tokens" != "0" ]; then
      percentage_used=$((tokens_used_num * 100 / max_tokens))
    fi
  fi
  
  # If we have a percentage, format the output with bar graph
  if [ -n "$percentage_used" ]; then
    local percentage_remaining=$((100 - percentage_used))
    
    # Create bar graph (10 blocks total)
    local bar_length=10
    local filled_blocks=$((percentage_used * bar_length / 100))
    local empty_blocks=$((bar_length - filled_blocks))
    
    # Choose color based on usage
    local color=""
    if [ "$percentage_used" -lt 50 ]; then
      color="${GREEN}"
    elif [ "$percentage_used" -lt 80 ]; then
      color="${YELLOW}"
    else
      color="${RED}"
    fi
    
    # Build the bar
    local bar=""
    for ((i=0; i<filled_blocks; i++)); do
      bar="${bar}█"
    done
    for ((i=0; i<empty_blocks; i++)); do
      bar="${bar}░"
    done
    
    # Output: 🧠 [██████░░░░] 40% left
    echo "🧠 ${color}[${bar}] ${percentage_remaining}% left${NC}"
  fi
}

# Format branch name with feature indicator
format_branch() {
  local branch_display="$1"
  
  # Truncate if too long
  if [ ${#branch_display} -gt 20 ]; then
    branch_display="${branch_display:0:17}..."
  fi
  
  # Add star for feature branches with dark yellow color
  if [[ "$branch_display" == feat/* ]] || [[ "$branch_display" == feature/* ]]; then
    echo "${STAR} ${YELLOW}${branch_display}${NC}"
  elif [ "$branch_display" = "main" ] || [ "$branch_display" = "master" ]; then
    echo "${BRANCH_ICON} ${RED}${BOLD}${branch_display} (Use /launch)${NC}"
  else
    echo "${BRANCH_ICON} ${YELLOW}${branch_display}${NC}"
  fi
}

# Build the status line
OUTPUT=""

# CWD
OUTPUT="${FOLDER} ${BOLD}${BLUE}${CWD}${NC}"

# Branch
BRANCH_FORMATTED=$(format_branch "$BRANCH")
OUTPUT="${OUTPUT} ${GRAY}|${NC} ${BRANCH_FORMATTED}"

# Git stats
GIT_STATS=$(get_git_stats)
OUTPUT="${OUTPUT} ${GRAY}|${NC} ${GIT_STATS}"

# Sync status
SYNC=$(get_sync_status)
OUTPUT="${OUTPUT} ${GRAY}|${NC} ${SYNC}"

# PR status (if exists)
PR=$(get_pr_status)
if [ -n "$PR" ]; then
  OUTPUT="${OUTPUT} ${GRAY}|${NC} ${PR}"
fi

# Model info
MODEL_INFO=$(get_model_info)
OUTPUT="${OUTPUT} ${GRAY}|${NC} ${MODEL_INFO}"

# Context usage (if available)
CONTEXT=$(get_context_usage)
if [ -n "$CONTEXT" ]; then
  OUTPUT="${OUTPUT} ${GRAY}|${NC} ${CONTEXT}"
fi

echo -e "$OUTPUT"