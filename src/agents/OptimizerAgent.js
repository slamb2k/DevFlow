import { BaseAgent } from './BaseAgent.js';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';

const execAsync = promisify(exec);

/**
 * OptimizerAgent - Performs performance profiling, bundle analysis,
 * bottleneck detection, and optimization suggestions
 */
export class OptimizerAgent extends BaseAgent {
  constructor(config = {}) {
    super({
      ...config,
      id: 'optimizer',
      name: 'OptimizerAgent',
      description:
        'Performs performance profiling, bundle analysis, bottleneck detection, and optimization suggestions',
    });

    this.capabilities = [
      'performance-profiling',
      'bundle-analysis',
      'bottleneck-detection',
      'optimization-suggestions',
    ];

    // Performance cache
    this.performanceCache = new Map();
  }

  async onInitialize() {
    // Load optimization rules and baselines
    this.state.optimizationRules = this.loadOptimizationRules();
    this.state.performanceBaseline = this.state.performanceBaseline || {};
    this.state.optimizationHistory = this.state.optimizationHistory || [];
    this.state.performanceTrends = this.state.performanceTrends || [];
  }

  loadOptimizationRules() {
    return {
      algorithms: {
        'nested-loops': {
          pattern: /for.*{[\s\S]*?for.*{/,
          complexity: 'O(n²)',
          suggestion: 'Consider using hash maps or optimized algorithms',
        },
        'array-includes-in-loop': {
          pattern: /for.*{[\s\S]*?\.includes\(/,
          complexity: 'O(n²)',
          suggestion: 'Use Set for O(1) lookups instead of array.includes()',
        },
      },
      async: {
        'sequential-awaits': {
          pattern: /for.*{[\s\S]*?await/,
          suggestion: 'Use Promise.all for parallel execution',
        },
        'waterfall-requests': {
          pattern: /await.*\n.*await.*\n.*await/,
          suggestion: 'Execute independent async operations in parallel',
        },
      },
      react: {
        'missing-memo': {
          pattern: /function\s+\w+Component.*{[\s\S]*?\.map\(/,
          suggestion: 'Consider using React.memo for components with expensive renders',
        },
        'unstable-keys': {
          pattern: /key\s*=\s*{?\s*Math\.random/,
          suggestion: 'Use stable, unique identifiers for keys',
        },
      },
      memory: {
        'unbounded-cache': {
          pattern: /cache\[.*?\]\s*=/,
          suggestion: 'Implement cache size limits and eviction policies',
        },
        'missing-cleanup': {
          pattern: /addEventListener.*(?!removeEventListener)/,
          suggestion: 'Add cleanup for event listeners to prevent memory leaks',
        },
      },
    };
  }

  canHandle(task) {
    const validTasks = [
      'profile-performance',
      'analyze-bundle',
      'detect-bottlenecks',
      'suggest-optimizations',
      'generate-report',
      'calculate-metrics',
      'track-performance',
    ];
    return validTasks.includes(task);
  }

  async onExecute(task, context) {
    switch (task) {
      case 'profile-performance':
        return await this.profilePerformance(context);
      case 'analyze-bundle':
        return await this.analyzeBundle(context);
      case 'detect-bottlenecks':
        return await this.detectBottlenecks(context);
      case 'suggest-optimizations':
        return await this.suggestOptimizations(context);
      case 'generate-report':
        return await this.generateOptimizationReport(context);
      case 'calculate-metrics':
        return await this.calculateMetrics(context);
      case 'track-performance':
        return await this.trackPerformance(context);
      default:
        throw new Error(`Unknown task: ${task}`);
    }
  }

  async profilePerformance(context) {
    const { filePath, useCache } = context;

    // Check cache
    if (useCache && this.performanceCache.has(filePath)) {
      return {
        ...this.performanceCache.get(filePath),
        cached: true,
      };
    }

    try {
      const code = await fs.readFile(filePath, 'utf-8');
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx'],
        errorRecovery: true,
      });

      const profile = {
        functions: {},
        bottlenecks: [],
        asyncPatterns: [],
        memoryIssues: [],
        recommendations: [],
      };

      // Analyze functions
      traverse.default(ast, {
        FunctionDeclaration(path) {
          const funcName = path.node.id?.name || 'anonymous';
          profile.functions[funcName] = this.analyzeFunctionComplexity(path);
        },
        ArrowFunctionExpression(path) {
          const parent = path.parent;
          const funcName = parent.id?.name || 'arrow-function';
          profile.functions[funcName] = this.analyzeFunctionComplexity(path);
        },
      });

      // Detect bottlenecks
      for (const [rule, config] of Object.entries(this.state.optimizationRules.algorithms)) {
        if (config.pattern.test(code)) {
          profile.bottlenecks.push({
            type: rule.replace('-', '-'),
            complexity: config.complexity,
            suggestion: config.suggestion,
          });
        }
      }

      // Detect async patterns
      for (const [rule, config] of Object.entries(this.state.optimizationRules.async)) {
        if (config.pattern.test(code)) {
          profile.asyncPatterns.push({
            pattern: rule.replace('-', '-'),
            recommendation: config.suggestion,
          });
        }
      }

      // Detect memory issues
      for (const [rule, config] of Object.entries(this.state.optimizationRules.memory)) {
        if (config.pattern.test(code)) {
          profile.memoryIssues.push({
            type: rule.replace('-', '-'),
            suggestion: config.suggestion,
          });
        }
      }

      // Generate recommendations
      if (profile.bottlenecks.length > 0) {
        profile.recommendations.push('Optimize algorithmic complexity to improve performance');
      }
      if (profile.asyncPatterns.length > 0) {
        profile.recommendations.push('Parallelize async operations where possible');
      }
      if (profile.memoryIssues.length > 0) {
        profile.recommendations.push('Address memory management issues to prevent leaks');
      }

      // Cache result
      if (useCache) {
        this.performanceCache.set(filePath, profile);
      }

      // Update history
      this.state.optimizationHistory.push({
        file: filePath,
        timestamp: new Date().toISOString(),
        bottlenecks: profile.bottlenecks.length,
      });

      await this.saveState();

      return profile;
    } catch (error) {
      throw new Error(`Failed to profile performance: ${error.message}`);
    }
  }

  analyzeFunctionComplexity(path) {
    let complexity = 1;
    let lines = 0;

    if (path.node.loc) {
      lines = path.node.loc.end.line - path.node.loc.start.line;
    }

    path.traverse({
      IfStatement() {
        complexity++;
      },
      ConditionalExpression() {
        complexity++;
      },
      ForStatement() {
        complexity++;
      },
      WhileStatement() {
        complexity++;
      },
      DoWhileStatement() {
        complexity++;
      },
      SwitchCase() {
        complexity++;
      },
    });

    return { complexity, lines };
  }

  async analyzeBundle(context) {
    const { statsFile, directory, filePath, lockFile } = context;

    if (statsFile) {
      // Analyze webpack stats
      try {
        const stats = JSON.parse(await fs.readFile(statsFile, 'utf-8'));
        const totalSize = stats.assets.reduce((sum, asset) => sum + asset.size, 0);
        const largestModules = stats.modules
          .sort((a, b) => b.size - a.size)
          .slice(0, 10)
          .map((m) => ({ name: m.name, size: m.size }));

        const recommendations = [];
        if (totalSize > 5000000) {
          recommendations.push('Bundle size exceeds 5MB - consider code splitting');
        }

        stats.modules.forEach((module) => {
          if (module.name.includes('moment')) {
            recommendations.push('Consider replacing moment.js with date-fns or dayjs');
          }
        });

        return {
          totalSize,
          assets: stats.assets,
          largestModules,
          recommendations,
        };
      } catch (error) {
        throw new Error(`Failed to analyze webpack stats: ${error.message}`);
      }
    }

    if (directory) {
      // Analyze dependencies
      try {
        const packageJsonPath = path.join(directory, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

        const largeDependencies = [];
        const alternatives = {};

        // Check for large/replaceable dependencies
        const deps = Object.keys(packageJson.dependencies || {});

        if (deps.includes('moment')) {
          largeDependencies.push('moment');
          alternatives['moment'] = ['date-fns', 'dayjs'];
        }
        if (deps.includes('lodash')) {
          largeDependencies.push('lodash');
          alternatives['lodash'] = ['lodash-es', 'ramda'];
        }
        if (deps.includes('antd')) {
          largeDependencies.push('antd');
          alternatives['antd'] = ['material-ui', 'chakra-ui'];
        }

        // Mock size check
        try {
          const { stdout: _stdout } = await execAsync('du -s node_modules/*', { cwd: directory });
          // Parse sizes from du output
        } catch (_error) {
          // Ignore du errors - intentionally empty
        }

        return {
          largeDependencies,
          alternatives,
        };
      } catch (error) {
        throw new Error(`Failed to analyze bundle: ${error.message}`);
      }
    }

    if (filePath) {
      // Analyze code splitting opportunities
      try {
        const code = await fs.readFile(filePath, 'utf-8');
        const importCount = (code.match(/import\s+.*from/g) || []).length;

        const codeSplitting = {
          opportunities: 0,
          suggestions: [],
        };

        if (importCount > 10) {
          codeSplitting.opportunities = Math.floor(importCount / 5);
          codeSplitting.suggestions.push('lazy-loading');
        }

        return { codeSplitting };
      } catch (error) {
        throw new Error(`Failed to analyze code splitting: ${error.message}`);
      }
    }

    if (lockFile) {
      // Check for duplicate dependencies
      try {
        const lockContent = JSON.parse(await fs.readFile(lockFile, 'utf-8'));
        const duplicates = [];

        // Simple duplicate detection
        const packages = {};
        for (const [name, info] of Object.entries(lockContent.dependencies || {})) {
          const baseName = name.split('@')[0];
          if (!packages[baseName]) {
            packages[baseName] = [];
          }
          packages[baseName].push(info.version);
        }

        for (const [name, versions] of Object.entries(packages)) {
          if (versions.length > 1) {
            duplicates.push({ package: name, versions });
          }
        }

        return { duplicates };
      } catch (error) {
        throw new Error(`Failed to analyze lock file: ${error.message}`);
      }
    }

    throw new Error('No valid input provided for bundle analysis');
  }

  async detectBottlenecks(context) {
    const { filePath } = context;

    try {
      const code = await fs.readFile(filePath, 'utf-8');
      const bottlenecks = [];

      // Detect N+1 query problems
      if (/for.*{[\s\S]*?await.*query/i.test(code)) {
        bottlenecks.push({
          type: 'n+1-query',
          severity: 'high',
          suggestion: 'Batch database queries or use eager loading',
        });
      }

      // Detect missing memoization
      if (/function.*Component[\s\S]*?\.map\(/i.test(code) && !code.includes('memo')) {
        bottlenecks.push({
          type: 'missing-memoization',
          severity: 'medium',
          suggestion: 'Use React.memo or useMemo for expensive computations',
        });
      }

      // Detect unstable keys
      if (/key\s*=\s*{?\s*Math\.random/i.test(code)) {
        bottlenecks.push({
          type: 'unstable-keys',
          severity: 'high',
          suggestion: 'Use stable, unique identifiers for React keys',
        });
      }

      // Detect waterfall requests
      const awaitCount = (code.match(/await\s+fetch/g) || []).length;
      if (awaitCount > 3) {
        const sequentialAwaits = /await.*\n\s*await.*\n\s*await/;
        if (sequentialAwaits.test(code)) {
          bottlenecks.push({
            type: 'waterfall-requests',
            severity: 'medium',
            suggestion: 'Use Promise.all to parallelize independent requests',
          });
        }
      }

      // Detect excessive polling
      if (/setInterval.*\d{1,3}(?:\s*\)|\s*,)/i.test(code)) {
        bottlenecks.push({
          type: 'excessive-polling',
          severity: 'medium',
          suggestion: 'Increase polling interval or use WebSockets for real-time updates',
        });
      }

      return { bottlenecks };
    } catch (error) {
      throw new Error(`Failed to detect bottlenecks: ${error.message}`);
    }
  }

  async suggestOptimizations(context) {
    const { filePath } = context;

    try {
      const code = await fs.readFile(filePath, 'utf-8');
      const suggestions = [];

      // Algorithm optimizations
      if (/for.*{[\s\S]*?for.*{[\s\S]*?\.includes/i.test(code)) {
        suggestions.push({
          type: 'algorithm',
          current: 'O(n²)',
          suggested: 'O(n)',
          implementation:
            'Use Set or Map for constant-time lookups instead of nested loops with includes()',
        });
      }

      // Caching suggestions
      if (
        /function.*{[\s\S]*?(?:calculate|compute|process)/i.test(code) &&
        !code.includes('cache')
      ) {
        suggestions.push({
          type: 'caching',
          strategy: 'memoization',
          suggestion: 'Add memoization for expensive computations',
        });
      }

      // Lazy loading suggestions
      if (/import.*from.*chart|heavy|large/i.test(code)) {
        suggestions.push({
          type: 'lazy-loading',
          target: 'ChartLibrary',
          suggestion: 'Use dynamic imports for heavy libraries',
        });
      }

      return { suggestions };
    } catch (error) {
      throw new Error(`Failed to suggest optimizations: ${error.message}`);
    }
  }

  async generateOptimizationReport(context) {
    const { directory, comprehensive } = context;

    const report = {
      summary: {
        timestamp: new Date().toISOString(),
        directory,
      },
      score: 0,
      topIssues: [],
      actionItems: [],
    };

    if (comprehensive) {
      // Run comprehensive analysis
      const files = await this.getAllFiles(directory, ['.js', '.jsx']);

      let totalBottlenecks = 0;
      let totalSuggestions = 0;

      for (const file of files.slice(0, 5)) {
        // Limit for performance
        try {
          const bottlenecks = await this.detectBottlenecks({ filePath: file });
          totalBottlenecks += bottlenecks.bottlenecks.length;

          const suggestions = await this.suggestOptimizations({ filePath: file });
          totalSuggestions += suggestions.suggestions.length;
        } catch (error) {
          // Skip files with errors
        }
      }

      report.topIssues = [`${totalBottlenecks} performance bottlenecks found`];
      report.actionItems = [`Review and implement ${totalSuggestions} optimization suggestions`];
    }

    // Calculate score
    report.score = 100 - report.topIssues.length * 10;
    report.score = Math.max(0, Math.min(100, report.score));

    let grade;
    if (report.score >= 90) {
      grade = 'A';
    } else if (report.score >= 80) {
      grade = 'B';
    } else if (report.score >= 70) {
      grade = 'C';
    } else if (report.score >= 60) {
      grade = 'D';
    } else {
      grade = 'F';
    }

    report.grade = grade;

    return { report };
  }

  async calculateMetrics(context) {
    const { metrics } = context;

    let score = 100;

    // Penalize slow load times
    if (metrics.loadTime > 3000) {
      score -= 20;
    } else if (metrics.loadTime > 2000) {
      score -= 10;
    }

    // Penalize large bundle sizes
    if (metrics.bundleSize > 2000000) {
      score -= 20;
    } else if (metrics.bundleSize > 1000000) {
      score -= 10;
    }

    // Bonus for good cache hit rate
    if (metrics.cacheHitRate > 0.8) {
      score += 10;
    }

    score = Math.max(0, Math.min(100, score));

    let grade;
    if (score >= 90) {
      grade = 'A';
    } else if (score >= 80) {
      grade = 'B';
    } else if (score >= 70) {
      grade = 'C';
    } else if (score >= 60) {
      grade = 'D';
    } else {
      grade = 'F';
    }

    const areas = {
      loadTime: metrics.loadTime < 2000 ? 'good' : 'needs-improvement',
      bundleSize: metrics.bundleSize < 1000000 ? 'good' : 'needs-improvement',
      caching: metrics.cacheHitRate > 0.7 ? 'good' : 'needs-improvement',
    };

    return { score, grade, areas };
  }

  async trackPerformance(context) {
    const { metrics } = context;

    // Add to trends
    this.state.performanceTrends.push({
      timestamp: new Date().toISOString(),
      ...metrics,
    });

    // Calculate improvement
    if (this.state.performanceTrends.length > 1) {
      const previous = this.state.performanceTrends[this.state.performanceTrends.length - 2];
      const current = metrics;

      this.state.improvement = {
        loadTime: ((previous.loadTime - current.loadTime) / previous.loadTime) * 100,
        bundleSize: ((previous.bundleSize - current.bundleSize) / previous.bundleSize) * 100,
      };
    }

    await this.saveState();

    return {
      tracked: true,
      trends: this.state.performanceTrends,
    };
  }

  async getAllFiles(dir, extensions) {
    const files = [];

    try {
      const entries = await fs.readdir(dir);

      for (const entry of entries) {
        if (entry === 'node_modules' || entry.startsWith('.')) {
          continue;
        }

        const fullPath = path.join(dir, entry);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          const subFiles = await this.getAllFiles(fullPath, extensions);
          files.push(...subFiles);
        } else if (stat.isFile() && extensions.some((ext) => entry.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }

    return files;
  }
}
