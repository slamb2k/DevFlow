# Branch Protection Rules

This document outlines the required branch protection rules for the `main` branch.

## Required Settings

Navigate to Settings → Branches → Add rule for `main`:

### ✅ Required Status Checks

Enable "Require status checks to pass before merging" with these checks:

- `Format Check` - Code formatting validation
- `Lint Check` - ESLint validation
- `Type Check` - TypeScript validation
- `Unit Tests` - Test suite must pass
- `Build Check` - Project must build

### ✅ Pull Request Requirements

- **Require pull request reviews before merging**
  - Required approving reviews: 1
  - Dismiss stale pull request approvals when new commits are pushed
  - Require review from CODEOWNERS (optional)

### ✅ Additional Settings

- **Require branches to be up to date before merging**
- **Require conversation resolution before merging**
- **Include administrators** (apply rules to admins too)
- **Restrict force pushes** (only allow admins in emergencies)

## Quick Setup with GitHub CLI

```bash
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["Format Check","Lint Check","Type Check","Unit Tests","Build Check"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false \
  --field required_conversation_resolution=true
```

## Bypass for CI

To allow GitHub Actions to push version commits and tags:

1. Use the default `GITHUB_TOKEN` for most operations
2. For npm publishing, add `NPM_TOKEN` as a repository secret
3. Configure workflow permissions as needed

## Troubleshooting

### Common Issues

1. **"Required status check is expected"**
   - Ensure workflow job names match exactly
   - Check workflows are triggered on pull_request events

2. **"Cannot push to protected branch"**
   - Always use PRs for changes
   - Configure PAT or GitHub App for CI pushes if needed

3. **"Merging is blocked"**
   - Ensure all required checks pass
   - Update branch with latest main
   - Resolve all PR conversations