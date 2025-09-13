/**
 * DevFlow Init Command
 * Initialize DevFlow in a project
 */

import { BaseCommand } from './BaseCommand.js';
import { ProjectMemory } from '../core/memory/ProjectMemory.js';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

export class InitCommand extends BaseCommand {
  getHelp() {
    return {
      description: 'Initialize DevFlow in your project',
      usage: 'devflow-init [options]',
      options: {
        '--force': 'Overwrite existing configuration',
        '--template': 'Project template (react, node, python)',
        '--name': 'Project name',
        '--skip-git': 'Skip git initialization'
      },
      examples: [
        'devflow-init',
        'devflow-init --template react',
        'devflow-init --name my-app --template node'
      ]
    };
  }

  async execute(args, options = {}) {
    const projectRoot = options.projectRoot || process.cwd();
    const force = options.force || false;
    const template = options.template || 'auto';
    const projectName = options.name || path.basename(projectRoot);
    const skipGit = options['skip-git'] || false;

    this.log('🚀 Initializing DevFlow...', 'info');

    // Check if already initialized
    const memory = new ProjectMemory(projectRoot);
    const devflowPath = path.join(projectRoot, '.devflow');

    try {
      await fs.access(devflowPath);
      if (!force) {
        return {
          success: false,
          message: 'DevFlow is already initialized. Use --force to reinitialize.'
        };
      }
    } catch {
      // Directory doesn't exist, proceed
    }

    // Initialize project memory
    await memory.init();

    // Detect project type if auto
    let projectType = template;
    if (template === 'auto') {
      projectType = await this.detectProjectType(projectRoot);
      this.log(`📦 Detected project type: ${projectType}`, 'info');
    }

    // Set initial configuration
    const config = {
      projectName,
      projectType,
      createdAt: new Date().toISOString(),
      version: '1.0.0',
      features: {
        cicd: true,
        testing: true,
        linting: true,
        docker: false
      }
    };

    await memory.updateConfig(config);

    // Create initial state
    const state = {
      initialized: true,
      currentPhase: 'setup',
      completedTasks: [],
      activeFeatures: []
    };

    await memory.setState(state);

    // Set up git hooks if not skipping
    if (!skipGit) {
      await this.setupGitHooks(projectRoot);
    }

    // Create initial templates based on project type
    await this.createInitialTemplates(memory, projectType);

    // Generate welcome message
    const message = this.generateWelcomeMessage(projectName, projectType);

    this.log('✅ DevFlow initialized successfully!', 'success');
    console.log(message);

    return {
      success: true,
      message: `DevFlow initialized for ${projectName}`,
      config,
      projectType
    };
  }

  async detectProjectType(projectRoot) {
    try {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      // Check for React
      if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
        return 'react';
      }

      // Check for Next.js
      if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
        return 'nextjs';
      }

      // Check for Vue
      if (packageJson.dependencies?.vue || packageJson.devDependencies?.vue) {
        return 'vue';
      }

      // Check for Express/Node
      if (packageJson.dependencies?.express) {
        return 'express';
      }

      // Default to Node.js
      return 'node';
    } catch {
      // Check for Python
      try {
        await fs.access(path.join(projectRoot, 'requirements.txt'));
        return 'python';
      } catch {
        // Check for setup.py
        try {
          await fs.access(path.join(projectRoot, 'setup.py'));
          return 'python';
        } catch {
          return 'generic';
        }
      }
    }
  }

  async setupGitHooks(projectRoot) {
    const hooksDir = path.join(projectRoot, '.git', 'hooks');

    try {
      await fs.access(hooksDir);

      // Create pre-commit hook
      const preCommitHook = `#!/bin/sh
# DevFlow pre-commit hook
echo "🔍 Running DevFlow pre-commit checks..."

# Run tests if available
if [ -f "package.json" ]; then
  npm test --if-present
fi

# Run linting if available
if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.cjs" ]; then
  npm run lint --if-present
fi

echo "✅ Pre-commit checks passed!"
`;

      await fs.writeFile(
        path.join(hooksDir, 'pre-commit'),
        preCommitHook,
        { mode: 0o755 }
      );

      this.log('🔗 Git hooks configured', 'info');
    } catch {
      // Git not initialized or hooks directory doesn't exist
    }
  }

  async createInitialTemplates(memory, projectType) {
    const templates = {
      'github-actions': {
        name: 'GitHub Actions CI/CD',
        type: 'cicd',
        content: this.getGitHubActionsTemplate(projectType)
      },
      'dockerfile': {
        name: 'Dockerfile',
        type: 'docker',
        content: this.getDockerfileTemplate(projectType)
      },
      'readme': {
        name: 'README template',
        type: 'documentation',
        content: this.getReadmeTemplate()
      }
    };

    for (const [key, template] of Object.entries(templates)) {
      await memory.saveTemplate(key, template);
    }
  }

  getGitHubActionsTemplate(projectType) {
    const templates = {
      node: `name: CI/CD

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
    - run: npm ci
    - run: npm test
    - run: npm run build`,

      python: `name: CI/CD

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-python@v4
      with:
        python-version: '3.9'
    - run: pip install -r requirements.txt
    - run: pytest`
    };

    return templates[projectType] || templates.node;
  }

  getDockerfileTemplate(projectType) {
    const templates = {
      node: `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]`,

      python: `FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "app.py"]`
    };

    return templates[projectType] || templates.node;
  }

  getReadmeTemplate() {
    return `# Project Name

## 🚀 Quick Start

\`\`\`bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test
\`\`\`

## 📁 Project Structure

\`\`\`
src/
├── components/     # React components
├── services/       # Business logic
├── utils/          # Utility functions
└── tests/          # Test files
\`\`\`

## 🛠️ DevFlow Commands

- \`/devflow-analyze\` - Analyze project structure
- \`/devflow-roadmap\` - Generate development roadmap
- \`/devflow-optimize\` - Get optimization suggestions

## 📦 Tech Stack

- Framework: [Your framework]
- Testing: [Your testing framework]
- CI/CD: GitHub Actions

## 📝 License

MIT`;
  }

  generateWelcomeMessage(projectName, projectType) {
    return chalk.blue(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🎉 Welcome to DevFlow!                             ║
║                                                       ║
║   Project: ${chalk.yellow(projectName.padEnd(42))}║
║   Type: ${chalk.green(projectType.padEnd(45))}║
║                                                       ║
║   Next steps:                                         ║
║   1. Run ${chalk.cyan('/devflow-analyze')} to analyze your project   ║
║   2. Run ${chalk.cyan('/devflow-roadmap')} to create a roadmap      ║
║   3. Run ${chalk.cyan('/devflow-optimize')} for optimizations       ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
`);
  }
}