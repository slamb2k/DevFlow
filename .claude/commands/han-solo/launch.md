---
name: /han-solo:launch
description: Launch a new feature branch with all safety checks - the safest way to begin new work
requires_args: false
argument-hint: "[branch-name]"
---

## Purpose
Launch a fresh, clean feature branch from an updated main branch. This command ensures you never encounter merge conflicts by always starting from the latest code.

## Usage
```bash
# Create branch with auto-generated name (feature/YYYY-MM-DD-HHMMSS)
/launch

# Create branch with custom name
/launch my-feature

# Create branch with conventional prefix
/launch fix/bug-123
/launch feat/new-feature
/launch docs/update-readme
```

## What It Does
1. **Saves** any uncommitted work to stash
2. **Switches** to main branch
3. **Fetches** latest from origin
4. **Resets** main to match origin/main exactly
5. **Cleans** untracked files and directories
6. **Creates** new feature branch
7. **Restores** stashed work if any

## Safety Features
- ✅ Never loses uncommitted work (auto-stash)
- ✅ Always starts from latest main
- ✅ Cleans up old branches automatically
- ✅ Prevents working on stale code
- ✅ Shows clear status after completion

## Context (Auto-detected)
The command will detect:
- Current repository and branch
- Any uncommitted changes
- Divergence from origin/main
- Age of current branch
- Open PRs

## Examples
```bash
# Monday morning fresh start
/launch monday-work

# Start bug fix with clean slate
/launch fix/login-issue

# Quick feature branch
/launch

# After a failed PR, start over
/launch attempt-2
```

## Implementation
The launch command directly executes the launch-core.sh script:

```bash
#!/bin/bash
set -e

# Execute launch-core.sh with all arguments
if [ -f "./scripts/launch-core.sh" ]; then
  ./scripts/launch-core.sh "$@"
else
  echo "Error: launch-core.sh script not found"
  echo "Please ensure han-solo is properly installed"
  exit 1
fi
```

## Success Criteria
- ✅ On a new feature branch
- ✅ Branch based on latest origin/main
- ✅ No uncommitted changes lost
- ✅ Working directory clean
- ✅ Ready for development

## Troubleshooting
- **"Not in a git repository"**: Run from project root
- **"Failed to checkout main"**: Ensure main/master branch exists
- **"Could not auto-restore stash"**: Manual conflict resolution needed
- **Network issues**: Check internet connection for fetch

## Related Commands
- `/ship` - Ship your changes when ready
- `/health` - Check repository health
- `/scrub` - Clean up old branches

## Best Practices
1. **Use daily**: Start each day with `/launch`
2. **Small branches**: Ship often, keep branches focused
3. **Descriptive names**: Use `feat/`, `fix/`, `docs/` prefixes
4. **Clean regularly**: Don't accumulate old branches