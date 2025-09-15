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

2. **Publish Job** - Only on main branch pushes
   - Checks if package version changed
   - Publishes to npm if version is new
   - Creates GitHub release

### PR Checks (`pr-checks.yml`)

**Triggers**: Pull requests to main

**Required Checks**:
- Format Check
- Lint Check
- Type Check
- Unit Tests
- Build Check

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

### Manual Publishing

```bash
npm version patch  # or minor/major
git push origin main --tags
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