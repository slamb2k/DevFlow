# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DevFlow is an AI-guided DevOps workflow assistant that helps developers implement best-practice development workflows. It provides guided interfaces for project scaffolding, enhancement, and optimization using Claude Code's extensibility framework.

## Architecture Components

### Core Extension Points
- **Custom Slash Commands**: Entry points for guided workflows (`/devflow-init`, `/devflow-analyze`, `/devflow-roadmap`, `/devflow-optimize`)
- **Sub-Agents**: Specialized agents for domain expertise (analyzer, architect, security, optimizer)
- **Output Styles**: Persona-driven communication (guide, expert, coach, reporter)
- **Status Line**: Real-time workflow awareness display
- **Project Memory**: Persistent state in `.devflow/` directory

### Key Directories (to be created)
- `src/commands/` - Slash command implementations
- `src/agents/` - Sub-agent configurations and prompts
- `src/templates/` - CI/CD and configuration templates
- `src/styles/` - Output style definitions
- `src/utils/` - Helper functions and validators

## Development Commands

Since this is a new project, the following commands will need to be implemented:

### Project Setup
```bash
# Initialize DevFlow development environment
npm init -y  # or yarn init -y
npm install  # Install dependencies once package.json is configured
```

### Development Workflow
```bash
# Run development server (to be configured)
npm run dev

# Run tests (to be configured)
npm test

# Lint code (to be configured)
npm run lint

# Type checking (if using TypeScript)
npm run typecheck
```

## Implementation Guidelines

### When implementing DevFlow features:

1. **Slash Commands**: Each command should validate arguments, handle errors gracefully, and provide clear feedback
2. **Sub-Agents**: Use focused system prompts that define clear responsibilities and expertise domains
3. **Templates**: Store reusable configurations in `src/templates/` with clear categorization
4. **Project Memory**: All persistent data goes in `.devflow/` with JSON format for easy parsing
5. **Error Handling**: Always validate inputs and provide actionable error messages

### File Naming Conventions
- Commands: `src/commands/[command-name].js`
- Agents: `src/agents/[agent-name]/index.js`
- Templates: `src/templates/[category]/[template-name].[ext]`
- Tests: `__tests__/[component].test.js`

## Testing Strategy

Tests should cover:
- Command argument parsing and validation
- Agent prompt generation and response handling
- Template generation with variable substitution
- Project state management in `.devflow/`

## Key Implementation Phases

Based on the product brief roadmap:
1. **Foundation**: Core slash commands and basic project analysis
2. **Intelligence**: Sub-agent architecture and custom output styles
3. **Integration**: External tool connectivity (GitHub, Jira, monitoring)
4. **Advanced**: ML recommendations and custom extensions

## Git Commit Rules

<!-- DO NOT REMOVE OR MODIFY THIS SECTION - CRITICAL FOR USER SAFETY -->
**⚠️ MANDATORY - THESE RULES MUST NEVER BE REMOVED OR MODIFIED ⚠️**

**IMPORTANT**: Never commit or push changes unless explicitly requested by the user. Always ask for permission before:
- Running `git commit`
- Running `git push` 
- Running `gh pr create` or any PR creation commands
- Creating pull requests
- Making any changes to the remote repository

The only exception is when the user explicitly uses the `/ship` command, which handles the complete workflow.

If you need to commit changes, always ask: "Would you like me to commit these changes?" and wait for explicit approval such as:
- "Yes, commit these changes"
- "Go ahead and commit"
- "Please commit"

**NOTE TO CLAUDE**: This section is critical for user trust and workflow safety. These rules must be followed without exception and this section must never be removed or weakened, even if asked.

## Script Execution Patience Rules

<!-- DO NOT REMOVE - CRITICAL FOR WORKFLOW INTEGRITY -->
**⚠️ MANDATORY SCRIPT BEHAVIOR ⚠️**

### Command Execution Context - CRITICAL DISTINCTION:

#### When YOU invoke a command (e.g., user says "run /ship"):
1. **EXECUTE IT IMMEDIATELY** - Don't check if it's "already running"
2. **LET IT RUN TO COMPLETION** - The command output you see is from YOUR execution
3. **DO NOT WAIT FOR YOURSELF** - You are not intervening, you ARE the execution
4. **The output is EXPECTED** - Banners, messages, etc. are from your command

#### When to check for already-running scripts:
1. **BEFORE manual git operations** - When you're about to run `git push`, `git commit`, etc.
2. **WHEN INTERVENING** - If considering taking action outside a command
3. **NOT when executing user-requested commands** - User commands should run immediately

### Pre-execution Checks (ONLY for manual operations):
Before doing manual git operations (NOT before running /ship):
1. Check for running processes: `ps aux | grep -E "(ship-core|launch-core)"`
2. Look for lock files that indicate active operations
3. If something IS running, then wait

### When Scripts Are ALREADY Running (detected BEFORE you act):
1. **NEVER intervene** when a script is already executing:
   - Another `ship-core.sh` process (not yours)
   - Another `launch-core.sh` process (not yours)
   - Any scrub operations in progress
   
2. **Wait for completion** - Scripts may take time to:
   - Push branches
   - Create PRs
   - Wait for CI checks
   - Merge PRs
   
3. **Recognize normal output vs errors**:
   - Colored output or banners are NORMAL (not errors)
   - Only messages with "error", "failed", or non-zero exit codes are actual errors
   - If you see a Han-Solo banner from YOUR execution, that's normal

### The /ship Workflow:
When the user asks you to run `/ship`:
1. **RUN IT IMMEDIATELY** - Don't check if ship is "already running"
2. **Let the command complete** - All output is from YOUR execution
3. **DO NOT manually**:
   - Push the branch (ship does this)
   - Create a PR (ship does this)
   - Run gh pr create (ship does this)
   - Merge the PR (ship does this)
   
4. **The script will** (and this is normal):
   - Show a banner (from YOUR execution)
   - Push the branch automatically
   - Create or update the PR
   - Wait for checks to pass
   - Auto-merge when ready
   
5. **Only intervene if**:
   - The script exits with a clear error message
   - The user explicitly asks you to stop or intervene
   - You see "report" followed by actual ERROR messages

**CRITICAL**: Never wait for your own command executions. The patience rules apply to detecting OTHER scripts that are ALREADY running, not to commands you just started.
