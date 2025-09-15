# DevFlow

[![CI](https://github.com/slamb2k/DevFlow/actions/workflows/ci.yml/badge.svg)](https://github.com/slamb2k/DevFlow/actions/workflows/ci.yml)
[![PR Checks](https://github.com/slamb2k/DevFlow/actions/workflows/pr-checks.yml/badge.svg)](https://github.com/slamb2k/DevFlow/actions/workflows/pr-checks.yml)
[![npm version](https://img.shields.io/npm/v/devflow.svg)](https://www.npmjs.com/package/devflow)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

AI-guided DevOps workflow assistant built on Claude Code's extensibility framework.

## Features

- 🤖 AI-powered DevOps workflows
- 🔄 Automated CI/CD pipelines
- 🔌 Platform integrations (GitHub, GitLab, Jira, Slack)
- 🛡️ Security-first design with encrypted credentials
- 📦 Template-driven project scaffolding

## Installation

```bash
npm install -g devflow
```

## Quick Start

```bash
# Initialize project
devflow init

# Analyze codebase
devflow analyze

# Create roadmap
devflow roadmap
```

## Development

```bash
# Clone repository
git clone https://github.com/slamb2k/DevFlow.git
cd DevFlow

# Install dependencies
npm install

# Run tests
npm test

# Run all CI checks locally
npm run ci:validate
```

## CI/CD

This project uses GitHub Actions for continuous integration and deployment:

- **PR Checks**: Format, lint, type check, tests, build
- **Auto-publish**: Publishes to npm when version changes
- **GitHub Releases**: Automatic release creation

See [CI/CD Documentation](./docs/CI-CD.md) for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run ci:validate`
5. Submit a pull request

All PRs must pass required checks.

## License

MIT - see [LICENSE](LICENSE) file for details.