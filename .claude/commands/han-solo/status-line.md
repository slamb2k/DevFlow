---
name: /han-solo:status-line
description: Configure the Han-Solo status line for your terminal
requires_args: false
argument-hint: "[enable|disable|current|help]"
allowed_tools:
  - Bash
  - Read
  - Edit
  - Write
---

## Purpose
Control the Han-Solo status line that displays important repository information in your terminal.

## Usage
```bash
# Enable the status line
/status-line enable

# Disable the status line
/status-line disable

# Show current status
/status-line current

# Show help
/status-line help
```

## Status Line Features

### Han-Solo Status Line (`han-solo.sh`)
Comprehensive status line showing:
- **Current directory** (CWD basename)
- **Branch name** with feature indicators
- **Git statistics** (staged/modified/untracked files, lines added/removed)
- **Sync status** with origin (ahead/behind/diverged)
- **PR status** if one exists
- **Model info** (Current Claude model: Opus 4.1, Sonnet 3.5, etc.)
- **Context usage** with visual bar graph
- **Safety warnings** when on main branch

```bash
$(~/.claude/status_lines/han-solo-minimal.sh)
```

## Implementation
```bash
#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

# Get the command argument
MODE="${1:-help}"

# Settings file path
SETTINGS_FILE=".claude/settings.local.json"

# Status line paths
HAN_SOLO_FULL=".claude/status_lines/han-solo.sh"
HAN_SOLO_MINIMAL=".claude/status_lines/han-solo-minimal.sh"

# Function to enable status line
enable_status_line() {
  # Ensure settings file exists
  if [ ! -f "$SETTINGS_FILE" ]; then
    echo "{}" > "$SETTINGS_FILE"
  fi
  
  # Update the status line setting using a temp file
  local tmp_file=$(mktemp)
  if command -v jq &> /dev/null; then
    jq --arg path "$HAN_SOLO_FULL" '.statusLine = {"type": "command", "command": $path, "padding": 0}' "$SETTINGS_FILE" > "$tmp_file"
    mv "$tmp_file" "$SETTINGS_FILE"
  else
    # Fallback to simple replacement if jq is not available
    cat > "$tmp_file" << EOF
{
  "statusLine": {
    "type": "command",
    "command": "$HAN_SOLO_FULL",
    "padding": 0
  }
}
EOF
    mv "$tmp_file" "$SETTINGS_FILE"
  fi
  
  echo -e "${GREEN}✅ Han-Solo full status line enabled${NC}"
  echo -e "${CYAN}Showing: CWD | Branch | Git stats | Model | Safety warnings${NC}"
}

# Function to disable status line
disable_status_line() {
  # Ensure settings file exists
  if [ ! -f "$SETTINGS_FILE" ]; then
    echo "{}" > "$SETTINGS_FILE"
  fi
  
  # Remove the status line setting
  local tmp_file=$(mktemp)
  if command -v jq &> /dev/null; then
    jq 'del(.statusLine)' "$SETTINGS_FILE" > "$tmp_file"
    mv "$tmp_file" "$SETTINGS_FILE"
  else
    echo "{}" > "$SETTINGS_FILE"
  fi
  
  echo -e "${YELLOW}Status line disabled${NC}"
}

# Show current status
show_current() {
  if [ -f "$SETTINGS_FILE" ]; then
    if grep -q '"statusLine"' "$SETTINGS_FILE" 2>/dev/null; then
      echo -e "${CYAN}Status line: ${GREEN}Enabled${NC}"
      echo -e "  Showing repository status information"
    else
      echo -e "${CYAN}Status line: ${YELLOW}Disabled${NC}"
    fi
  else
    echo -e "${YELLOW}No status line configured${NC}"
  fi
}

# Show help
show_help() {
  echo -e "${CYAN}Han-Solo Status Line${NC}"
  echo ""
  echo "Usage: /status-line [command]"
  echo ""
  echo "Commands:"
  echo -e "  ${GREEN}enable${NC}   - Enable full Han-Solo status line"
  echo -e "  ${GREEN}disable${NC}  - Disable status line"
  echo -e "  ${GREEN}current${NC}  - Show current status"
  echo -e "  ${GREEN}help${NC}     - Show this help message"
  echo ""
  echo "Full status line (han-solo.sh) displays:"
  echo "  • Current directory and branch"
  echo "  • Git statistics (files, lines changed)"
  echo "  • Sync status and PR info"
  echo "  • Model indicator and safety warnings"
  echo ""
  echo "Minimal status line (han-solo-minimal.sh) provides:"
  echo "  • Compact git safety info for integration"
  echo "  • Use: \$(~/.claude/status_lines/han-solo-minimal.sh)"
}

# Main logic
case "$MODE" in
  enable|on)
    enable_status_line
    ;;
  disable|off)
    disable_status_line
    ;;
  current|status)
    show_current
    ;;
  help|*)
    show_help
    ;;
esac
```

## Examples

### Enable Status Line
```bash
/status-line enable
# Han-Solo status information now visible in terminal
```

### Check Status
```bash
/status-line current
# Shows whether status line is enabled or disabled
```

### Disable Temporarily
```bash
/status-line disable
# Status line hidden
```

## Success Indicators
- Settings file updated successfully
- Status line appears/disappears in terminal
- Repository status information visible when enabled

## Related Commands
- `/launch` - Start new work with clean branch
- `/ship` - Ship your changes
- `/health` - Check repository health

## Best Practices
1. Keep status line **enabled** for safety awareness
2. Provides constant visibility of branch state
3. Helps prevent accidental commits to main
4. Shows when you're out of sync with origin