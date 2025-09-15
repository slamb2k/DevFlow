# GitHub Configuration

This directory contains GitHub-specific configuration for DevFlow CI/CD.

## Workflows

- **ci.yml** - Main CI pipeline with test and publish jobs
- **pr-checks.yml** - Required checks for pull requests
- **release.yml** - Manual release workflow for version management

## Setup Required

1. Add `NPM_TOKEN` to repository secrets for publishing
2. Configure branch protection rules for `main` branch:
   - Require PR checks: Format, Lint, Type Check, Unit Tests, Build
   - Require branches to be up to date
   - Require PR reviews (optional)

## Automated Features

- ✅ PR quality checks (format, lint, type, test, build)
- ✅ Automatic npm publishing when version changes
- ✅ GitHub release creation
- ✅ Dependabot for dependency updates