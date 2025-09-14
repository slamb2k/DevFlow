#!/bin/bash
# Claude Code PreToolUse hook for git push operations
# This hook only triggers for actual git push commands

# Check if the command being run is a git push
# Claude Code passes the tool and arguments via environment variables
if [[ "$CLAUDE_TOOL_NAME" == "Bash" ]]; then
  # Check if the command contains 'git push'
  if [[ "$CLAUDE_TOOL_ARGS" == *"git push"* ]]; then
    # Check if we're inside a /ship workflow (ship-core.sh handles pushes)
    if pgrep -f "ship-core.sh" > /dev/null 2>&1; then
      echo "✅ /ship workflow detected - allowing automatic push"
      exit 0
    fi

    # Check if we're inside a launch workflow
    if pgrep -f "launch-core.sh" > /dev/null 2>&1; then
      echo "✅ /launch workflow detected - allowing automatic push"
      exit 0
    fi

    # Check for AUTOSHIP environment variable
    if [[ "$AUTOSHIP" == "true" ]]; then
      echo "✅ AUTOSHIP=true - allowing automatic push"
      exit 0
    fi

    echo "⚠️  Git push detected. Please explicitly approve this action."
    echo ""
    echo "To allow: Say 'Yes, push these changes' or use '/ship'"
    echo "To deny: Say 'No, don't push'"
    echo ""
    exit 1  # Block the push
  fi
fi

# Allow all other commands
exit 0
