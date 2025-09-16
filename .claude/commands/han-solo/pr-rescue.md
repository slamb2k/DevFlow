---
name: /han-solo:pr-rescue
description: "Analyze and resolve stuck PRs that haven't merged despite passing checks. Diagnoses issues and provides actionable solutions."
requires_args: false
argument-hint: "[analyze | fix <PR#> | force <PR#>]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# pr-rescue

Comprehensive PR analysis and resolution tool that diagnoses why PRs are stuck and provides automated fixes.

## Purpose
Identify and resolve issues preventing PRs from merging, including:
- Auto-merge not enabled
- Branch behind main
- Missing required checks
- Merge conflicts
- Unknown GitHub API issues

## Usage
```bash
# Analyze all open PRs and get recommendations
/pr-rescue

# Analyze and get interactive fix options
/pr-rescue analyze

# Automatically fix a specific PR (interactive)
/pr-rescue fix 65

# Force merge a PR (admin override)
/pr-rescue force 65
```

## Modes

### Analyze Mode (default)
Provides detailed analysis of all open PRs:
- Current state and merge readiness
- Status of all required checks
- Auto-merge configuration
- Specific issues preventing merge
- Recommended actions for each PR

### Fix Mode
Interactive resolution for a specific PR:
1. Analyzes the PR to identify issues
2. Presents available fix options
3. Executes chosen fix with confirmation
4. Verifies the resolution

### Force Mode
Admin override to merge despite issues:
- Bypasses failing checks
- Requires admin permissions
- Use with extreme caution

## What it does

### Analysis Phase
1. **Fetches PR metadata** including checks, merge status, and auto-merge state
2. **Identifies blockers** such as:
   - Auto-merge never enabled
   - Branch out of date
   - Failing required checks
   - Merge conflicts
3. **Generates action plan** with specific commands to resolve each issue

### Resolution Phase
Depending on the issue, can:
1. **Enable auto-merge**: `gh pr merge --auto --squash`
2. **Update branch**: Rebase on main and force-push
3. **Re-trigger checks**: Push empty commit if needed
4. **Force merge**: Admin override (requires permissions)

## Example Output

### Analysis Mode
```
🔍 Analyzing all open PRs...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Analyzing PR #65
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PR Details:
  Title: fix: remove ineffective exec/sleep from banners
  Author: slamb2k
  Created: 2025-09-11T06:28:36Z
  State: OPEN

🔍 Status Analysis:
  Required Checks:
    ✅ 🧹 Format: SUCCESS
    ✅ 🔎 Lint: SUCCESS
    ✅ 🧠 Typecheck: SUCCESS
    ✅ 🛠️ Build: SUCCESS

🎯 Merge Status:
  Mergeable: YES
  Merge State: BEHIND
  Auto-merge: DISABLED

📊 Diagnosis:
  Issues Found:
    • Auto-merge is not enabled
    • Branch is behind main

💡 Recommended Actions:
  1. Enable auto-merge: gh pr merge 65 --auto --squash
  2. Update branch: gh pr merge 65 --rebase
```

### Fix Mode (Interactive)
```
/pr-rescue fix 65

Found 2 issues with PR #65:
1. Auto-merge is not enabled
2. Branch is behind main

Select action:
[1] Enable auto-merge
[2] Update branch
[3] Do both (recommended)
[4] Cancel

> 3

✅ Branch updated successfully
✅ Auto-merge enabled
🎉 PR #65 will merge automatically when checks pass!
```

## Implementation

First, inform the user by outputting:
```
🛟 Throwing that PR a life preserver...

██████╗ ███████╗███████╗ ██████╗██╗   ██╗██╗███╗   ██╗ ██████╗ 
██╔══██╗██╔════╝██╔════╝██╔════╝██║   ██║██║████╗  ██║██╔════╝ 
██████╔╝█████╗  ███████╗██║     ██║   ██║██║██╔██╗ ██║██║  ███╗
██╔══██╗██╔══╝  ╚════██║██║     ██║   ██║██║██║╚██╗██║██║   ██║
██║  ██║███████╗███████║╚██████╗╚██████╔╝██║██║ ╚████║╚██████╔╝
╚═╝  ╚═╝╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝ ╚═════╝ 
                                                               
```

Then delegate to the pr-rescue-core.sh script which handles:
1. PR analysis using GitHub CLI
2. Issue detection and diagnosis
3. Automated resolution actions
4. Interactive fix selection

### Script Execution
```bash
#!/bin/bash
set -e

# Parse command arguments
ACTION="${1:-analyze}"
PR_NUM="${2:-}"

case "$ACTION" in
  analyze|"")
    ./.claude/scripts/pr-rescue-core.sh analyze
    ;;
  fix)
    if [ -z "$PR_NUM" ]; then
      echo "Error: PR number required for fix mode"
      echo "Usage: /pr-rescue fix <PR#>"
      exit 1
    fi
    
    # First analyze the PR
    ./.claude/scripts/pr-rescue-core.sh analyze "$PR_NUM"
    
    # Then offer fix options
    echo
    echo "Select resolution action:"
    echo "[1] Enable auto-merge"
    echo "[2] Update branch (rebase)"
    echo "[3] Both (enable auto-merge + update)"
    echo "[4] Force merge (admin only)"
    echo "[5] Cancel"
    echo
    read -p "Choice: " choice
    
    case "$choice" in
      1) ./.claude/scripts/pr-rescue-core.sh enable-auto-merge "$PR_NUM" ;;
      2) ./.claude/scripts/pr-rescue-core.sh update-branch "$PR_NUM" ;;
      3)
        ./.claude/scripts/pr-rescue-core.sh update-branch "$PR_NUM"
        ./.claude/scripts/pr-rescue-core.sh enable-auto-merge "$PR_NUM"
        ;;
      4) ./.claude/scripts/pr-rescue-core.sh force-merge "$PR_NUM" ;;
      *) echo "Cancelled" ;;
    esac
    ;;
  force)
    if [ -z "$PR_NUM" ]; then
      echo "Error: PR number required for force mode"
      echo "Usage: /pr-rescue force <PR#>"
      exit 1
    fi
    ./.claude/scripts/pr-rescue-core.sh force-merge "$PR_NUM"
    ;;
  *)
    echo "Unknown action: $ACTION"
    echo "Usage: /pr-rescue [analyze|fix <PR#>|force <PR#>]"
    exit 1
    ;;
esac
```

## Common Issues and Solutions

### Issue: Auto-merge Never Enabled
**Cause**: PR was created without `--auto` flag or auto-merge wasn't enabled after creation
**Solution**: Enable auto-merge with `gh pr merge --auto --squash`

### Issue: Branch Behind Main
**Cause**: Main branch has advanced since PR was created
**Solution**: Rebase branch on main or use GitHub's update button

### Issue: Checks Stuck
**Cause**: GitHub Actions glitch or webhook failure
**Solution**: Push empty commit to retrigger: `git commit --allow-empty -m "Retrigger CI"`

### Issue: Auto-merge Enabled but Not Merging
**Cause**: GitHub API issue or status check mismatch
**Solution**: Disable and re-enable auto-merge

## Related Commands
- `/ship`: Creates PRs with auto-merge enabled by default
- `/ship --nowait`: Creates PR without enabling auto-merge
- `/scrub`: Cleans up merged branches

## Best Practices
1. **Always use `/ship`** for creating PRs - it enables auto-merge by default
2. **Keep branches updated** - rebase regularly to avoid conflicts
3. **Monitor PR status** - use this command if PRs are stuck for >10 minutes
4. **Avoid force merge** unless absolutely necessary

## Success Criteria
- All stuck PRs identified with clear diagnosis
- Actionable solutions provided for each issue
- Automated fixes available for common problems
- Clear feedback on resolution status