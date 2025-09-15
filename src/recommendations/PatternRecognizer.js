import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

class PatternRecognizer {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.patterns = {
      commits: {},
      files: {},
      workflow: {},
      structure: {},
    };
  }

  async analyzeProjectHistory() {
    const patterns = {
      commits: await this.analyzeCommitHistory(),
      files: await this.analyzeFilePatterns(),
      workflow: await this.analyzeWorkflowPatterns(),
      structure: await this.analyzeProjectStructure(),
    };

    this.patterns = patterns;
    return patterns;
  }

  async analyzeCommitHistory() {
    try {
      const gitLog = execSync(
        'git log --pretty=format:"%H|%s|%an|%ae|%ad" --name-only --max-count=100',
        { cwd: this.projectPath, encoding: 'utf8' }
      );

      const commits = this.parseGitLog(gitLog);
      return this.analyzeCommits(commits);
    } catch (error) {
      return { error: error.message };
    }
  }

  parseGitLog(gitLog) {
    const commits = [];
    const lines = gitLog.split('\n');
    let currentCommit = null;

    for (const line of lines) {
      if (line.includes('|')) {
        if (currentCommit) {
          commits.push(currentCommit);
        }
        const [hash, message, author, email, date] = line.split('|');
        currentCommit = {
          hash,
          message,
          author,
          email,
          date: new Date(date),
          files: [],
        };
      } else if (line.trim() && currentCommit) {
        currentCommit.files.push(line.trim());
      }
    }

    if (currentCommit) {
      commits.push(currentCommit);
    }

    return commits;
  }

  analyzeCommits(commits) {
    const patterns = {
      frequentlyChangedFiles: {},
      commitTypes: {},
      commitTopics: {},
      authorPatterns: {},
      timePatterns: {},
      coChangedFiles: [],
    };

    // Analyze frequently changed files
    for (const commit of commits) {
      for (const file of commit.files) {
        patterns.frequentlyChangedFiles[file] = (patterns.frequentlyChangedFiles[file] || 0) + 1;
      }

      // Analyze commit types (conventional commits)
      const typeMatch = commit.message.match(/^(\w+)(?:\([\w-]+\))?:/);
      if (typeMatch) {
        const type = typeMatch[1];
        patterns.commitTypes[type] = (patterns.commitTypes[type] || 0) + 1;
      }

      // Analyze commit topics
      const topics = this.extractTopics(commit.message);
      for (const topic of topics) {
        patterns.commitTopics[topic] = (patterns.commitTopics[topic] || 0) + 1;
      }

      // Analyze author patterns
      patterns.authorPatterns[commit.author] = (patterns.authorPatterns[commit.author] || 0) + 1;

      // Analyze time patterns
      const hour = commit.date.getHours();
      const dayOfWeek = commit.date.getDay();
      patterns.timePatterns[`hour_${hour}`] = (patterns.timePatterns[`hour_${hour}`] || 0) + 1;
      patterns.timePatterns[`day_${dayOfWeek}`] =
        (patterns.timePatterns[`day_${dayOfWeek}`] || 0) + 1;
    }

    // Find co-changed files
    patterns.coChangedFiles = this.findCoChangedFiles(commits);

    // Sort and filter results
    patterns.frequentlyChangedFiles = this.sortAndFilter(patterns.frequentlyChangedFiles, 5);
    patterns.commitTypes = this.sortAndFilter(patterns.commitTypes);
    patterns.commitTopics = this.sortAndFilter(patterns.commitTopics, 5);

    return patterns;
  }

  extractTopics(message) {
    const topics = [];
    const keywords = [
      'security',
      'performance',
      'bug',
      'feature',
      'refactor',
      'test',
      'docs',
      'style',
    ];

    for (const keyword of keywords) {
      if (message.toLowerCase().includes(keyword)) {
        topics.push(keyword);
      }
    }

    return topics;
  }

  findCoChangedFiles(commits) {
    const coChanges = {};

    for (const commit of commits) {
      const files = commit.files;
      for (let i = 0; i < files.length; i++) {
        for (let j = i + 1; j < files.length; j++) {
          const pair = [files[i], files[j]].sort().join('|');
          coChanges[pair] = (coChanges[pair] || 0) + 1;
        }
      }
    }

    return Object.entries(coChanges)
      .filter(([_, count]) => count > 2)
      .map(([pair, count]) => ({
        files: pair.split('|'),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  async analyzeFilePatterns() {
    try {
      const patterns = {
        fileTypes: {},
        largeFiles: [],
        recentlyModified: [],
        staleFiles: [],
      };

      // Get file statistics
      const files = await this.getAllFiles(this.projectPath);

      for (const file of files) {
        const ext = path.extname(file);
        patterns.fileTypes[ext] = (patterns.fileTypes[ext] || 0) + 1;

        const stats = await fs.stat(file);
        const fileInfo = {
          path: path.relative(this.projectPath, file),
          size: stats.size,
          modified: stats.mtime,
        };

        // Track large files
        if (stats.size > 1048576) {
          // > 1MB
          patterns.largeFiles.push(fileInfo);
        }

        // Track recently modified
        const daysSinceModified = (Date.now() - stats.mtime) / (1000 * 60 * 60 * 24);
        if (daysSinceModified < 7) {
          patterns.recentlyModified.push(fileInfo);
        } else if (daysSinceModified > 180) {
          patterns.staleFiles.push(fileInfo);
        }
      }

      // Sort results
      patterns.largeFiles.sort((a, b) => b.size - a.size);
      patterns.recentlyModified.sort((a, b) => b.modified - a.modified);
      patterns.staleFiles.sort((a, b) => a.modified - b.modified);

      return patterns;
    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeWorkflowPatterns() {
    const patterns = {
      branchingStrategy: null,
      prFrequency: null,
      mergeStrategy: null,
      cicdPipeline: null,
    };

    try {
      // Analyze branching strategy
      const branches = execSync('git branch -r', { cwd: this.projectPath, encoding: 'utf8' });
      const branchLines = branches.split('\n').filter((b) => b.trim());

      if (branchLines.some((b) => b.includes('feature/'))) {
        patterns.branchingStrategy = 'feature-branch';
      } else if (branchLines.some((b) => b.includes('develop'))) {
        patterns.branchingStrategy = 'git-flow';
      } else {
        patterns.branchingStrategy = 'trunk-based';
      }

      // Analyze PR frequency (if GitHub repo)
      try {
        const prList = execSync('gh pr list --state all --limit 50 --json createdAt', {
          cwd: this.projectPath,
          encoding: 'utf8',
        });
        const prs = JSON.parse(prList);

        if (prs.length > 0) {
          const dates = prs.map((pr) => new Date(pr.createdAt));
          const daysBetween = [];

          for (let i = 1; i < dates.length; i++) {
            const diff = (dates[i - 1] - dates[i]) / (1000 * 60 * 60 * 24);
            daysBetween.push(diff);
          }

          const avgDays = daysBetween.reduce((a, b) => a + b, 0) / daysBetween.length;

          if (avgDays < 1) {
            patterns.prFrequency = 'multiple-daily';
          } else if (avgDays < 3) {
            patterns.prFrequency = 'daily';
          } else if (avgDays < 7) {
            patterns.prFrequency = 'weekly';
          } else {
            patterns.prFrequency = 'sporadic';
          }
        }
      } catch (error) {
        // GitHub CLI not available or not a GitHub repo
      }

      // Check for CI/CD configuration
      const ciFiles = [
        '.github/workflows',
        '.gitlab-ci.yml',
        'Jenkinsfile',
        '.circleci/config.yml',
        'azure-pipelines.yml',
      ];

      for (const ciFile of ciFiles) {
        try {
          await fs.access(path.join(this.projectPath, ciFile));
          patterns.cicdPipeline = ciFile.includes('github')
            ? 'github-actions'
            : ciFile.includes('gitlab')
              ? 'gitlab-ci'
              : ciFile.includes('Jenkins')
                ? 'jenkins'
                : ciFile.includes('circle')
                  ? 'circleci'
                  : ciFile.includes('azure')
                    ? 'azure-devops'
                    : 'unknown';
          break;
        } catch {
          // File doesn't exist
        }
      }

      return patterns;
    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeProjectStructure() {
    const patterns = {
      projectType: null,
      hasTests: false,
      testFramework: null,
      buildTool: null,
      packageManager: null,
      dependencies: [],
      devDependencies: [],
    };

    try {
      // Detect project type
      const files = await fs.readdir(this.projectPath);

      if (files.includes('package.json')) {
        patterns.projectType = 'node';
        patterns.packageManager = files.includes('yarn.lock')
          ? 'yarn'
          : files.includes('pnpm-lock.yaml')
            ? 'pnpm'
            : 'npm';

        // Analyze package.json
        const packageJson = JSON.parse(
          await fs.readFile(path.join(this.projectPath, 'package.json'), 'utf8')
        );

        patterns.dependencies = Object.keys(packageJson.dependencies || {});
        patterns.devDependencies = Object.keys(packageJson.devDependencies || {});

        // Detect test framework
        const testFrameworks = ['jest', 'mocha', 'jasmine', 'ava', 'tape'];
        for (const framework of testFrameworks) {
          if (patterns.devDependencies.includes(framework)) {
            patterns.testFramework = framework;
            break;
          }
        }

        // Detect build tool
        if (patterns.devDependencies.includes('webpack')) {
          patterns.buildTool = 'webpack';
        } else if (patterns.devDependencies.includes('vite')) {
          patterns.buildTool = 'vite';
        } else if (patterns.devDependencies.includes('rollup')) {
          patterns.buildTool = 'rollup';
        } else if (patterns.devDependencies.includes('parcel')) {
          patterns.buildTool = 'parcel';
        }
      } else if (files.includes('requirements.txt') || files.includes('setup.py')) {
        patterns.projectType = 'python';
      } else if (files.includes('pom.xml')) {
        patterns.projectType = 'java-maven';
      } else if (files.includes('build.gradle')) {
        patterns.projectType = 'java-gradle';
      } else if (files.includes('Cargo.toml')) {
        patterns.projectType = 'rust';
      } else if (files.includes('go.mod')) {
        patterns.projectType = 'go';
      }

      // Check for tests
      patterns.hasTests =
        files.some((f) => f.includes('test')) ||
        files.includes('__tests__') ||
        files.includes('spec');

      return patterns;
    } catch (error) {
      return { error: error.message };
    }
  }

  async analyzeStructure(fileTree) {
    const patterns = {
      hasTests: false,
      componentStructure: null,
      depth: 0,
      fileCount: 0,
    };

    function analyzeTree(tree, depth = 0) {
      patterns.depth = Math.max(patterns.depth, depth);

      for (const [dir, contents] of Object.entries(tree)) {
        if (dir.includes('test') || dir.includes('spec')) {
          patterns.hasTests = true;
        }

        if (Array.isArray(contents)) {
          patterns.fileCount += contents.length;
        } else {
          analyzeTree(contents, depth + 1);
        }
      }
    }

    analyzeTree(fileTree);

    // Determine component structure
    if (patterns.depth > 3) {
      patterns.componentStructure = 'hierarchical';
    } else if (patterns.depth > 1) {
      patterns.componentStructure = 'modular';
    } else {
      patterns.componentStructure = 'flat';
    }

    return patterns;
  }

  analyzeCommitMessages(commits) {
    const patterns = {
      commonTypes: {},
      commonTopics: [],
    };

    for (const commit of commits) {
      // Extract commit type
      const typeMatch = commit.message.match(/^(\w+)(?:\([\w-]+\))?:/);
      if (typeMatch) {
        const type = typeMatch[1];
        patterns.commonTypes[type] = (patterns.commonTypes[type] || 0) + 1;
      }

      // Extract topics
      const topics = this.extractTopics(commit.message);
      patterns.commonTopics.push(...topics);
    }

    // Deduplicate topics
    patterns.commonTopics = [...new Set(patterns.commonTopics)];

    return patterns;
  }

  async getAllFiles(dir, files = []) {
    const items = await fs.readdir(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);

      // Skip common directories to ignore
      if (
        item.name === 'node_modules' ||
        item.name === '.git' ||
        item.name === 'dist' ||
        item.name === 'build'
      ) {
        continue;
      }

      if (item.isDirectory()) {
        await this.getAllFiles(fullPath, files);
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  sortAndFilter(obj, limit = null) {
    const sorted = Object.entries(obj)
      .sort(([, a], [, b]) => b - a)
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});

    if (limit) {
      const limited = {};
      const keys = Object.keys(sorted).slice(0, limit);
      for (const key of keys) {
        limited[key] = sorted[key];
      }
      return limited;
    }

    return sorted;
  }

  async savePatterns(patterns) {
    const patternsPath = path.join(this.projectPath, '.devflow/intelligence/patterns.json');
    await fs.mkdir(path.dirname(patternsPath), { recursive: true });
    await fs.writeFile(patternsPath, JSON.stringify(patterns, null, 2));
  }

  async loadPatterns() {
    try {
      const patternsPath = path.join(this.projectPath, '.devflow/intelligence/patterns.json');
      const data = await fs.readFile(patternsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }
}

export default PatternRecognizer;
