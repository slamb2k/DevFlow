# Branch Protection Rules Configuration

This document describes the required branch protection rules for the `main` branch to ensure PR checks must pass before merging.

## Required GitHub Settings

Navigate to **Settings → Branches** in your GitHub repository and add a branch protection rule for `main` with the following settings:

### Required Status Checks

Enable **"Require status checks to pass before merging"** with these required checks:

- ✅ `Format Check`
- ✅ `Lint Check`
- ✅ `Type Check`
- ✅ `Unit Tests`
- ✅ `Build Check`

### Additional Protection Settings

- ✅ **Require branches to be up to date before merging** - Ensures PR is rebased with latest main
- ✅ **Require conversation resolution before merging** - All PR comments must be resolved
- ✅ **Dismiss stale pull request approvals when new commits are pushed** - Re-review required after changes
- ✅ **Include administrators** - Apply rules to admin users as well

### Optional but Recommended

- ✅ **Require pull request reviews before merging** (1-2 approvals)
- ✅ **Require review from CODEOWNERS** - If using CODEOWNERS file
- ✅ **Restrict who can dismiss pull request reviews** - Only maintainers
- ✅ **Require linear history** - Enforces rebasing over merge commits

## Workflow Architecture

The CI/CD pipeline is structured as follows:

1. **PR Creation/Update** → Triggers `ci.yml`
2. **ci.yml** → Calls reusable `pr-checks.yml` workflow
3. **pr-checks.yml** → Runs all required checks in parallel:
   - Format Check
   - Lint Check
   - Type Check
   - Unit Tests
   - Build Check
4. **All checks must pass** → PR can be merged

## Enforcement

With these rules in place:
- ❌ PRs cannot be merged if any check fails
- ❌ PRs cannot be closed/merged without passing checks
- ❌ Direct pushes to main are blocked (must go through PR)
- ✅ Only PRs with all green checks can be merged

## CLI Configuration

If using GitHub CLI, you can configure branch protection with:

```bash
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field "required_status_checks[strict]=true" \
  --field "required_status_checks[contexts][]=Format Check" \
  --field "required_status_checks[contexts][]=Lint Check" \
  --field "required_status_checks[contexts][]=Type Check" \
  --field "required_status_checks[contexts][]=Unit Tests" \
  --field "required_status_checks[contexts][]=Build Check" \
  --field "enforce_admins=true" \
  --field "required_pull_request_reviews[required_approving_review_count]=1" \
  --field "required_pull_request_reviews[dismiss_stale_reviews]=true" \
  --field "restrictions=null" \
  --field "allow_force_pushes=false" \
  --field "allow_deletions=false" \
  --field "required_conversation_resolution=true"
```

## Verification

To verify branch protection is working:

1. Create a test PR with failing tests
2. Attempt to merge - should be blocked
3. Fix the tests
4. All checks should pass and merge should be allowed

## Notes

- The `/ship` command respects these rules and will wait for checks to pass
- Use `/ship --force` to override (requires admin permissions and should be used sparingly)
- The reusable workflow pattern keeps CI DRY and maintainable