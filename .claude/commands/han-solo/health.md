---
name: /han-solo:health
description: Comprehensive git repository health check - detect and diagnose potential issues before they cause problems
requires_args: false
argument-hint: "[--quick] [--suggest-cleanup]"
---

## Purpose
Run a comprehensive health check on your git repository to detect issues like diverged branches, stale PRs, uncommitted changes, and other potential problems before they cause merge conflicts.

## Usage
```bash
# Run full health check
/health

# Quick status only
/health --quick

# Include branch cleanup suggestions
/health --suggest-cleanup
```

## What It Checks
1. **Branch Status**
   - Current branch name and age
   - Ahead/behind/diverged from origin
   - Uncommitted changes
   
2. **PR Status**
   - Open PRs and their state
   - Mergeable vs conflicting
   - Stale PRs (>7 days)
   
3. **Repository Health**
   - Last fetch time
   - Untracked files
   - Stash count
   - Remote connectivity
   
4. **Safety Indicators**
   - Working on main branch warning
   - Diverged branches alert
   - Old feature branches
   - Large uncommitted changes

## Implementation
The health command directly executes the health-core.sh script:

```bash
#!/bin/bash
set -e

# Execute health-core.sh with all arguments
if [ -f "./scripts/health-core.sh" ]; then
  echo "Running comprehensive health check..."
  ./scripts/health-core.sh "$@"
  exit $?
else
  echo "Error: health-core.sh script not found"
  echo "Please ensure han-solo is properly installed"
  exit 1
fi
```

## Output Example
```
🏥 Git Repository Health Check
================================

📍 Current Branch
  Branch: feature/add-login
  ✅ Branch age: 2 days

📝 Working Directory
  ⚠️  3 uncommitted changes
  M  src/auth.js
  M  tests/auth.test.js
  ?? notes.txt

🔄 Sync Status
  ✅ Ahead by 2 commits (ready to push)

📦 Stashes
  ✅ No stashes

🎯 Pull Requests
  ✅ No open PRs

📊 Health Summary
  ✅ Good health (90%)

💡 Recommendations
  1. Commit or stash your changes
  → Ready to ship? Run /ship --check first
```

## Success Indicators
- Health score above 90%
- No diverged branches
- Clean working directory
- No old stale branches
- All PRs in good state

## Related Commands
- `/launch` - Start clean feature branch
- `/ship --check` - Pre-flight checks before shipping
- `/scrub` - Clean up old branches

## Best Practices
1. Run `/health` at start of each day
2. Address warnings before they become errors
3. Keep health score above 90%
4. Clean up regularly