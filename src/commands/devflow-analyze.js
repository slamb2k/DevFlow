/**
 * DevFlow Analyze Command
 * Analyze project structure and dependencies
 */

import { BaseCommand } from './BaseCommand.js';
import { ProjectMemory } from '../core/memory/ProjectMemory.js';
import fs from 'fs/promises';
import path from 'path';
import fastGlob from 'fast-glob';
import chalk from 'chalk';

export class AnalyzeCommand extends BaseCommand {
  getHelp() {
    return {
      description: 'Analyze project structure and dependencies',
      usage: 'devflow-analyze [options]',
      options: {
        '--deep': 'Perform deep analysis',
        '--format': 'Output format (json, text, visual)',
        '--save': 'Save analysis to project memory'
      },
      examples: [
        'devflow-analyze',
        'devflow-analyze --deep --format visual',
        'devflow-analyze --save'
      ]
    };
  }

  async execute(args, options = {}) {
    const projectRoot = options.projectRoot || process.cwd();
    const deep = options.deep || false;
    const format = options.format || 'visual';
    const save = options.save || false;

    this.log('🔍 Analyzing project structure...', 'info');

    // Analyze different aspects
    const framework = await this.detectFramework(projectRoot);
    const dependencies = await this.analyzeDependencies(projectRoot);
    const structure = await this.analyzeStructure(projectRoot);
    const metrics = await this.calculateMetrics(projectRoot);
    const issues = await this.detectIssues(projectRoot, { deep });

    const analysis = {
      framework,
      dependencies,
      structure,
      metrics,
      issues,
      timestamp: new Date().toISOString()
    };

    // Save to memory if requested
    if (save) {
      const memory = new ProjectMemory(projectRoot);
      await memory.init();
      await memory.updateState({ lastAnalysis: analysis });
      this.log('💾 Analysis saved to project memory', 'info');
    }

    // Format output
    if (format === 'visual') {
      this.displayVisualAnalysis(analysis);
    }

    return analysis;
  }

  async detectFramework(projectRoot) {
    try {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps.react) return { name: 'React', version: deps.react };
      if (deps.next) return { name: 'Next.js', version: deps.next };
      if (deps.vue) return { name: 'Vue', version: deps.vue };
      if (deps.angular) return { name: 'Angular', version: deps.angular };
      if (deps.express) return { name: 'Express', version: deps.express };
      if (deps.fastify) return { name: 'Fastify', version: deps.fastify };

      return { name: 'Node.js', version: process.version };
    } catch {
      return { name: 'Unknown', version: 'N/A' };
    }
  }

  async analyzeDependencies(projectRoot) {
    try {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      return {
        production: Object.keys(packageJson.dependencies || {}).length,
        development: Object.keys(packageJson.devDependencies || {}).length,
        total: Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies }).length,
        outdated: [] // Would need npm outdated check
      };
    } catch {
      return { production: 0, development: 0, total: 0, outdated: [] };
    }
  }

  async analyzeStructure(projectRoot) {
    const patterns = [
      '**/*.js',
      '**/*.jsx',
      '**/*.ts',
      '**/*.tsx',
      '**/*.css',
      '**/*.scss',
      '**/*.json',
      '**/*.md'
    ];

    const files = await fastGlob(patterns, {
      cwd: projectRoot,
      ignore: ['node_modules', 'dist', 'build', '.git'],
      onlyFiles: true
    });

    const structure = {
      totalFiles: files.length,
      byType: {},
      directories: new Set()
    };

    for (const file of files) {
      const ext = path.extname(file);
      structure.byType[ext] = (structure.byType[ext] || 0) + 1;

      const dir = path.dirname(file);
      if (dir !== '.') {
        structure.directories.add(dir.split('/')[0]);
      }
    }

    structure.directories = Array.from(structure.directories);

    return structure;
  }

  async calculateMetrics(projectRoot) {
    const files = await fastGlob('**/*.{js,jsx,ts,tsx}', {
      cwd: projectRoot,
      ignore: ['node_modules', 'dist', 'build'],
      onlyFiles: true
    });

    let totalLines = 0;
    let totalSize = 0;

    for (const file of files) {
      const content = await fs.readFile(path.join(projectRoot, file), 'utf-8');
      totalLines += content.split('\n').length;
      totalSize += content.length;
    }

    return {
      files: files.length,
      lines: totalLines,
      size: `${(totalSize / 1024).toFixed(2)} KB`,
      avgLinesPerFile: files.length ? Math.round(totalLines / files.length) : 0
    };
  }

  async detectIssues(projectRoot, { deep }) {
    const issues = [];

    // Check for missing files
    const requiredFiles = ['.gitignore', 'README.md'];
    for (const file of requiredFiles) {
      try {
        await fs.access(path.join(projectRoot, file));
      } catch {
        issues.push({
          type: 'missing',
          severity: 'warning',
          message: `Missing ${file}`
        });
      }
    }

    // Check for security issues
    try {
      const packageJson = JSON.parse(
        await fs.readFile(path.join(projectRoot, 'package.json'), 'utf-8')
      );

      if (!packageJson.scripts?.test) {
        issues.push({
          type: 'quality',
          severity: 'warning',
          message: 'No test script defined'
        });
      }

      if (!packageJson.scripts?.lint) {
        issues.push({
          type: 'quality',
          severity: 'info',
          message: 'No lint script defined'
        });
      }
    } catch {}

    return issues;
  }

  displayVisualAnalysis(analysis) {
    console.log(chalk.cyan('\n📊 Project Analysis Report\n'));
    console.log(chalk.cyan('═'.repeat(50)));

    // Framework
    console.log(chalk.yellow('\n🏗️  Framework'));
    console.log(`   ${analysis.framework.name} ${analysis.framework.version}`);

    // Dependencies
    console.log(chalk.yellow('\n📦 Dependencies'));
    console.log(`   Production: ${analysis.dependencies.production}`);
    console.log(`   Development: ${analysis.dependencies.development}`);
    console.log(`   Total: ${analysis.dependencies.total}`);

    // Structure
    console.log(chalk.yellow('\n📁 Project Structure'));
    console.log(`   Files: ${analysis.structure.totalFiles}`);
    console.log(`   Directories: ${analysis.structure.directories.join(', ')}`);

    // Metrics
    console.log(chalk.yellow('\n📈 Metrics'));
    console.log(`   Lines of code: ${analysis.metrics.lines}`);
    console.log(`   Total size: ${analysis.metrics.size}`);
    console.log(`   Avg lines/file: ${analysis.metrics.avgLinesPerFile}`);

    // Issues
    if (analysis.issues.length > 0) {
      console.log(chalk.yellow('\n⚠️  Issues'));
      for (const issue of analysis.issues) {
        const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`   ${icon} ${issue.message}`);
      }
    } else {
      console.log(chalk.green('\n✅ No issues detected!'));
    }

    console.log(chalk.cyan('\n' + '═'.repeat(50) + '\n'));
  }
}