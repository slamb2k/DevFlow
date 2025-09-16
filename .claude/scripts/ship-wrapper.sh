#!/bin/bash
# Wrapper script for ship-core.sh that checks both project and user locations

# Check for project-level installation first
if [ -f "./.claude/scripts/ship-core.sh" ]; then
    exec ./.claude/scripts/ship-core.sh "$@"
# Check for user-level installation
elif [ -f "$HOME/.claude/scripts/ship-core.sh" ]; then
    exec "$HOME/.claude/scripts/ship-core.sh" "$@"
else
    echo "Error: ship-core.sh not found in project or user .claude directory"
    echo "Please ensure han-solo is properly installed either:"
    echo "  - Project level: ./.claude/scripts/ship-core.sh"
    echo "  - User level: ~/.claude/scripts/ship-core.sh"
    exit 1
fi