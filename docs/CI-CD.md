# CI/CD Documentation

## Overview

DevFlow uses GitHub Actions for continuous integration and deployment.

## Workflows

### CI Pipeline (`ci.yml`)

**Triggers**: Pull requests and pushes to main

**Jobs**:
1. **Test Job** - Runs on all PRs and pushes
   - Format check (`npm run format:check`)
   - Lint (`npm run lint`)
   - Type check (`npm run typecheck`)
   - Unit tests (`npm test`)
   - Build (`npm run build`)

2. **Check Release Job** - Only on main branch pushes
   - Checks if version was manually bumped
   - Checks for releasable commits (feat, fix, perf, BREAKING CHANGE)
   - Determines if release is needed

3. **Release Job** - Calls reusable release workflow
   - Automatically triggered when release conditions are met
   - Uses semantic versioning based on commits
   - Publishes to npm and creates GitHub release

### PR Checks (`pr-checks.yml`)

**Triggers**: Pull requests to main

**Required Checks**:
- Format Check
- Lint Check
- Type Check
- Unit Tests
- Build Check

### Release Management (`release.yml`)

**Triggers**:
- Manual workflow dispatch
- Called from CI pipeline (workflow_call)

**Reusable Workflow**:
This workflow is designed as a reusable workflow that can be:
- Called automatically from CI when releasable commits are merged
- Triggered manually for specific version bumps
- Used by other workflows via `workflow_call`

**Options**:
- **Release Type**:
  - `auto` - Detect from commits (default for CI)
  - `patch`, `minor`, `major` - Specific bumps
  - `prerelease` - Pre-release versions
  - `skip` - Use when version already bumped
- **Prerelease ID**: beta, alpha, or rc (for prereleases)

**Features**:
- Semantic versioning based on conventional commits
- Automatic version detection from commit messages
- Changelog generation with categorization
- NPM publishing with appropriate tags
- GitHub release creation
- Handles both automatic and manual releases

## Setup Instructions

### 1. NPM Publishing Setup

1. Create npm access token at npmjs.com
2. Add to GitHub repository secrets as `NPM_TOKEN`

### 2. Branch Protection

Configure main branch protection with these required status checks:
- Format Check
- Lint Check
- Type Check
- Unit Tests
- Build Check

### 3. Local Testing

Run all CI checks locally:
```bash
npm run ci:validate
```

Or individual checks:
```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## Publishing Process

### Automatic Publishing

1. Update version in `package.json`
2. Push to main (via PR)
3. CI automatically publishes if version changed

### Manual Release (Recommended)

Use the Release Management workflow:

1. Go to Actions → Release Management
2. Click "Run workflow"
3. Select release type (patch/minor/major/prerelease)
4. Click "Run workflow"

The workflow will:
- Bump version
- Generate changelog
- Run tests
- Publish to npm
- Create GitHub release
- Tag the commit

### Local Publishing (Emergency Only)

```bash
npm version patch  # or minor/major
git push origin main --tags
npm publish --access public
```

## Dependabot

Automated dependency updates are configured:
- Weekly checks for npm packages
- Weekly checks for GitHub Actions
- Grouped updates for dev dependencies

## Troubleshooting

### CI Failures

1. Run failed check locally
2. Fix issues
3. Push fixes

### Publishing Issues

- Verify NPM_TOKEN is set correctly
- Check package name availability
- Ensure version is bumped

## Best Practices

1. Always run `npm run ci:validate` before pushing
2. Use conventional commits for clear history
3. Keep PRs small and focused
4. Ensure all checks pass before merge