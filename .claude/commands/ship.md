---
name: /ship
description: "Alias for /han-solo:ship - Ship code with governed fast-path"
requires_args: false
argument-hint: "[--check] [--nowait] [--force] [--staged] [--title 'text'] [--body 'text'] [--draft]"
allowed-tools:
  - Task
  - Bash
---

## This is an alias

This command is an alias for `/han-solo:ship`. Please use that command instead.

The implementation can be found at `.claude/commands/han-solo/ship.md`

## Execution

When invoked, immediately redirect to the han-solo:ship command:

```bash
# This is just a pointer to the actual command
echo "Redirecting to /han-solo:ship..."
```

Then invoke `/han-solo:ship` with all provided arguments.