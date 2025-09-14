#!/bin/bash
# Claude Code PreToolUse hook for git commit operations
# This hook only triggers for actual git commit commands

# Check if the command being run is a git commit
# Claude Code passes the tool and arguments via environment variables
if [[ "$CLAUDE_TOOL_NAME" == "Bash" ]]; then
  # Check if the command contains 'git commit'
  if [[ "$CLAUDE_TOOL_ARGS" == *"git commit"* ]]; then
    # Check if we're inside a /ship workflow (ship-core.sh handles commits)
    if pgrep -f "ship-core.sh" > /dev/null 2>&1; then
      echo "✅ /ship workflow detected - allowing automatic commit"
      exit 0
    fi

    # Check for AUTOSHIP environment variable
    if [[ "$AUTOSHIP" == "true" ]]; then
      echo "✅ AUTOSHIP=true - allowing automatic commit"
      exit 0
    fi

    echo "⚠️  Git commit detected. Please explicitly approve this action."
    echo ""
    echo "To allow: Say 'Yes, commit these changes' or use '/ship'"
    echo "To deny: Say 'No, don't commit'"
    echo ""
    exit 1  # Block the commit
  fi
fi

# Allow all other commands
exit 0
