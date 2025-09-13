# Technical Stack

> Last Updated: 2025-09-13
> Version: 1.0.0

## Application Framework

- **Framework:** Node.js/JavaScript
- **Version:** Node.js 18+ LTS

## Database

- **Primary Database:** File-based JSON storage in `.devflow/` directory
- **Configuration Storage:** YAML/JSON configuration files
- **Template Storage:** File system templates in `src/templates/`

## JavaScript

- **Framework:** Node.js with ES modules
- **Package Manager:** npm or yarn
- **Testing Framework:** Jest
- **Linting:** ESLint with standard configuration

## CSS Framework

- **Framework:** N/A (Command-line tool, no UI framework needed)

## Core Technologies

- **Claude Code Integration:** Custom slash commands and sub-agents
- **Template Engine:** Handlebars for configuration template generation
- **File Processing:** Node.js fs/promises for file operations
- **Process Management:** child_process for external tool integration
- **Configuration Management:** cosmiconfig for flexible configuration loading

## External Integrations

- **Version Control:** Git CLI integration
- **CI/CD Platforms:** GitHub Actions, GitLab CI, Jenkins templates
- **Container Platforms:** Docker, Kubernetes configuration generation
- **Cloud Providers:** AWS, GCP, Azure deployment templates
- **Monitoring Tools:** Prometheus, Grafana, DataDog integration guides

## Development Tools

- **Code Quality:** ESLint, Prettier
- **Testing:** Jest with coverage reporting
- **Documentation:** JSDoc for code documentation
- **Build Tools:** Native ES modules, no bundling required
- **Version Management:** Semantic versioning with standard-version