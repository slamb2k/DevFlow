# Dependabot Strategy for DevFlow

## Overview

This document outlines our automated dependency management strategy using GitHub Dependabot.

## Update Schedule

- **Frequency**: Weekly (every Monday at 4:00 AM UTC)
- **Grouped Updates**: Minor and patch versions are grouped together to reduce PR noise
- **PR Limits**:
  - NPM: Maximum 10 open PRs
  - GitHub Actions: Maximum 5 open PRs

## Auto-merge Policy

### ✅ Automatically Merged

1. **Patch Updates** (1.0.x → 1.0.y)
   - All patch updates are auto-merged after CI passes
   - These typically contain bug fixes and security patches

2. **Minor Updates of Dev Dependencies** (1.x.0 → 1.y.0)
   - Development dependencies only
   - Auto-merged after CI passes
   - No impact on production code

3. **Security Updates**
   - All security updates are prioritized
   - Auto-merged if patch or minor version
   - Major versions require manual review

### ⚠️ Manual Review Required

1. **Major Version Updates** (x.0.0 → y.0.0)
   - All major updates require human review
   - May contain breaking changes
   - Review changelog and migration guide

2. **Production Dependencies Minor Updates**
   - Minor updates to production dependencies
   - Need review for potential behavior changes

3. **Blocked Packages**
   - `commander`: Major versions blocked
   - `jest`: Major versions blocked
   - `typescript`: Major versions blocked
   - `@types/node`: Major versions blocked
   - `express`: Version 5.x blocked (still in beta)

## Labels

All Dependabot PRs are automatically labeled:
- `dependencies`: All dependency updates
- `automated`: Indicates automated PR
- `patch-update`: Patch version updates
- `minor-update`: Minor version updates
- `major-update`: Major version updates (requires review)
- `needs-review`: Applied to major updates
- `security`: Security-related updates
- `github-actions`: GitHub Actions updates

## Review Process

### For Manual Reviews, Check:

1. **Breaking Changes**
   - Review changelog
   - Check for deprecation notices
   - Verify API compatibility

2. **Migration Requirements**
   - Look for migration guides
   - Check if code changes needed
   - Review impact on other dependencies

3. **Test Coverage**
   - Ensure all tests pass
   - Check for new test requirements
   - Verify no regression in coverage

4. **Performance Impact**
   - Monitor bundle size changes
   - Check for performance regressions
   - Review memory usage changes

5. **Security Considerations**
   - Review new dependencies introduced
   - Check for security advisories
   - Verify license compatibility

## Monitoring

### Weekly Review
- Check for failed auto-merges
- Review PRs pending for >7 days
- Monitor security advisories

### Monthly Review
- Analyze dependency update trends
- Review blocked packages for updates
- Update ignore list as needed

## Emergency Procedures

### Security Vulnerability
1. Dependabot creates security PR
2. Auto-merge if patch/minor
3. Emergency review if major version
4. Deploy hotfix if critical

### Failed Auto-merge
1. Check CI failure reason
2. Fix tests/lint issues
3. Re-run CI checks
4. Manual merge if needed

## Configuration Files

- `.github/dependabot.yml`: Main configuration
- `.github/workflows/dependabot-auto-merge.yml`: Auto-merge workflow

## Best Practices

1. **Keep dependencies current**: Don't let updates accumulate
2. **Group related updates**: Reduces PR fatigue
3. **Test thoroughly**: Rely on comprehensive CI checks
4. **Document decisions**: Note why packages are ignored/blocked
5. **Review regularly**: Adjust strategy based on experience

## Contact

For questions or to request changes to the Dependabot strategy, please open an issue or contact @slamb2k.