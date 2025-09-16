---
name: /ship
description: "Ship code with governed fast-path (alias for /han-solo:ship)"
requires_args: false
argument-hint: "[--check] [--nowait] [--force] [--staged] [--title 'text'] [--body 'text'] [--draft]"
allowed-tools:
  - Task
  - Bash
  - Read
---

## Purpose
This is a convenience alias for `/han-solo:ship` that works regardless of where han-solo is installed (project-level or user-level).

## Implementation

### Step 1: Display Banner
Use the Bash tool to run:
```bash
./.claude/scripts/block-text.sh -s "SHIPPING"
```

If the banner script doesn't exist locally, check user-level:
```bash
~/.claude/scripts/block-text.sh -s "SHIPPING"
```

### Step 2: Delegate to git-shipper
Use the Task tool with:
- **subagent_type**: "git-shipper"
- **description**: "Ship code changes via PR"
- **prompt**: Pass all command arguments and flags directly to the agent

## Notes
- The git-shipper agent will use `./.claude/scripts/ship-core.sh` if available locally
- If han-solo is installed at user-level, ensure symlinks or wrapper scripts exist
- The actual implementation is in `/han-solo:ship` command