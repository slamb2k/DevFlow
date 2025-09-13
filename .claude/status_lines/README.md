# Han-Solo Status Line

The Han-Solo status line provides real-time git repository information directly in your terminal with comprehensive safety warnings and context tracking.

## 🚀 Status Line (`han-solo.sh`)

A complete standalone status line with comprehensive repository information.

#### What It Shows
- **📁 Current Directory** - Working directory basename
- **🌿 Branch Name** - With feature branch indicators (🌟 for feat/*)
- **📈 Git Statistics** - Staged, modified, untracked files, lines added/removed
- **🔄 Sync Status** - Ahead/behind/diverged indicators
- **🔗 PR Status** - Open PR state and mergeability
- **🤖 Model Info** - Current Claude model (Opus 4.1, Sonnet 3.5, etc.)
- **🧠 Context Usage** - Visual bar graph showing remaining context
- **⚠️ Safety Warnings** - Red alerts when on main/master

#### Example Output
```
📁 han-solo | 🌟 feat/new-feature | ●3 +45/-12 | ↑2 | PR#42→ | 🤖 Opus 4.1 | 🧠 [██░░░░░░░░] 78% left
📁 project | ⚠️ main | ✓ clean | ✓ | 🤖 Sonnet 3.5 | 🧠 [████░░░░░░] 60% left [USE /launch TO START WORK]
```


## Installation

### Using the Interactive Installer

```bash
npx han-solo-installer
```

The installer will prompt you to choose which components to install, including the status line.

### Manual Installation

1. Copy the desired script:
```bash
# For full status line
cp .claude/status_lines/han-solo.sh ~/.claude/status_lines/
chmod +x ~/.claude/status_lines/han-solo.sh

# For minimal status line (integration)
cp .claude/status_lines/han-solo-minimal.sh ~/.claude/status_lines/
chmod +x ~/.claude/status_lines/han-solo-minimal.sh
```

2. Configure:

**For Full Status Line** (in `~/.claude/settings.local.json`):
```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/status_lines/han-solo.sh",
    "padding": 0
  }
}
```

**For Minimal Status Line**: See integration examples above for your shell/framework.

## Usage with Claude Code

Control the full status line using the `/status-line` command:

```bash
# Enable the full status line
/status-line enable

# Disable the status line
/status-line disable

# Check current status
/status-line current

# Show help
/status-line help
```

## Features Comparison

| Feature | Full (`han-solo.sh`) | Minimal (`han-solo-minimal.sh`) |
|---------|---------------------|----------------------------------|
| Current Directory | ✅ | ❌ |
| Branch Name | ✅ Full name | ❌ (only main warning) |
| Git Statistics | ✅ Detailed | ✅ Compact |
| Sync Status | ✅ | ✅ |
| PR Status | ✅ Detailed | ✅ Number only |
| Model Info | ✅ | ❌ |
| Safety Warnings | ✅ Verbose | ✅ Compact |
| Use Case | Standalone | Integration |
| Output Length | ~60-80 chars | ~10-20 chars |

## Visual Indicators

### Colors
- 🔴 **Red**: Critical warnings (main branch, diverged)
- 🟡 **Yellow**: Caution (ahead, uncommitted changes)
- 🟢 **Green**: Good state (synced, clean)
- 🔵 **Cyan**: Informational (branch names, behind)
- 🟣 **Purple**: PR information
- 🟠 **Orange**: Active changes
- ⚫ **Gray**: Untracked files

### Symbols
- `●` Uncommitted changes (number follows)
- `✓` Clean/synced state
- `↑` Commits ahead of origin
- `↓` Commits behind origin
- `↕` Diverged from origin
- `🌟` Feature branch (feat/* or feature/*)
- `⚠️` Warning (on main/master)
- `PR#` Pull request number

## Troubleshooting

### Status line not appearing
- Verify scripts are executable: `chmod +x ~/.claude/status_lines/han-solo*.sh`
- Test manually: `~/.claude/status_lines/han-solo.sh`
- Check settings file for full version: `~/.claude/settings.local.json`

### Minimal version not showing in prompt
- Ensure the script path is correct in your shell configuration
- Test the script outputs something: `~/.claude/status_lines/han-solo-minimal.sh`
- Check that you're in a git repository

### GitHub PR status not working
- Install GitHub CLI: `brew install gh` or `apt install gh`
- Authenticate: `gh auth login`

## Best Practices

### For Full Status Line
1. Use with Claude Code for maximum integration
2. Keep enabled for constant repository awareness
3. Pay attention to red warnings

### For Minimal Status Line
1. Position after directory/branch in your prompt
2. Use colors that contrast with your theme
3. Consider adding separators for clarity

## Performance

Both scripts are optimized for speed:
- Execute in < 50ms typically
- Use git plumbing commands when possible
- Cache GitHub API calls briefly
- Fail gracefully without output on errors

## Contributing

To modify or extend the status lines:
1. Edit the scripts in `.claude/status_lines/`
2. Test changes: `./han-solo.sh` or `./han-solo-minimal.sh`
3. Ensure fast execution (< 100ms)
4. Maintain error resilience