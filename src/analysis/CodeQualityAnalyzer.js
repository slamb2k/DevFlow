const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const glob = require('glob');
const { promisify } = require('util');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const globAsync = promisify(glob);

class CodeQualityAnalyzer {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }

  async analyze() {
    const results = {
      complexity: await this.analyzeComplexity(),
      coverage: await this.analyzeCoverage(),
      duplication: await this.detectDuplication(),
      maintainability: await this.calculateMaintainabilityIndex(),
      timestamp: new Date().toISOString()
    };

    results.summary = this.generateSummary(results);
    results.recommendations = this.generateRecommendations(results);

    return results;
  }

  async analyzeComplexity() {
    try {
      const jsFiles = await globAsync('**/*.{js,jsx}', {
        cwd: this.projectPath,
        ignore: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', '__tests__/**', '*.test.js']
      });

      if (jsFiles.length === 0) {
        return { skipped: true, reason: 'No JavaScript files found' };
      }

      const complexityData = {
        totalComplexity: 0,
        averageComplexity: 0,
        functions: [],
        highComplexity: [],
        files: {}
      };

      for (const file of jsFiles) {
        const filePath = path.join(this.projectPath, file);
        const fileComplexity = await this.calculateComplexity(filePath);

        if (!fileComplexity.error) {
          complexityData.files[file] = fileComplexity;
          complexityData.totalComplexity += fileComplexity.complexity;
          complexityData.functions.push(...fileComplexity.functions);

          const highComplexityFunctions = fileComplexity.functions.filter(f => f.complexity > 10);
          complexityData.highComplexity.push(...highComplexityFunctions.map(f => ({
            ...f,
            file
          })));
        }
      }

      if (complexityData.functions.length > 0) {
        complexityData.averageComplexity = (
          complexityData.totalComplexity / complexityData.functions.length
        ).toFixed(2);
      }

      complexityData.highComplexity.sort((a, b) => b.complexity - a.complexity);

      return complexityData;
    } catch (error) {
      return { error: error.message };
    }
  }

  async calculateComplexity(filePath) {
    try {
      const code = await fs.readFile(filePath, 'utf8');
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
        errorRecovery: true
      });

      const functions = [];
      let fileComplexity = 0;

      traverse(ast, {
        'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression': (path) => {
          const complexity = this.calculateCyclomaticComplexity(path.node);
          const functionName = this.getFunctionName(path);

          functions.push({
            name: functionName,
            complexity,
            line: path.node.loc?.start?.line
          });

          fileComplexity += complexity;
        }
      });

      return {
        complexity: fileComplexity,
        functions,
        averageComplexity: functions.length > 0 ? (fileComplexity / functions.length).toFixed(2) : 0
      };
    } catch (error) {
      return { error: error.message, complexity: 0, functions: [] };
    }
  }

  calculateCyclomaticComplexity(node) {
    let complexity = 1;

    traverse(node, {
      'IfStatement|ConditionalExpression|SwitchCase|ForStatement|WhileStatement|DoWhileStatement': () => {
        complexity++;
      },
      LogicalExpression: (path) => {
        if (path.node.operator === '&&' || path.node.operator === '||') {
          complexity++;
        }
      },
      CatchClause: () => {
        complexity++;
      }
    }, null, null, true);

    return complexity;
  }

  getFunctionName(path) {
    if (path.node.id?.name) {
      return path.node.id.name;
    }

    if (path.parent?.type === 'VariableDeclarator' && path.parent.id?.name) {
      return path.parent.id.name;
    }

    if (path.parent?.type === 'ObjectProperty' && path.parent.key?.name) {
      return path.parent.key.name;
    }

    if (path.parent?.type === 'ClassMethod' && path.parent.key?.name) {
      return path.parent.key.name;
    }

    return '<anonymous>';
  }

  async analyzeCoverage() {
    try {
      const coveragePath = path.join(this.projectPath, 'coverage', 'coverage-summary.json');

      try {
        const coverageData = await fs.readFile(coveragePath, 'utf8');
        const coverage = JSON.parse(coverageData);

        const total = coverage.total;
        const uncovered = [];

        for (const [filePath, data] of Object.entries(coverage)) {
          if (filePath !== 'total' && data.lines.pct === 0) {
            uncovered.push(filePath);
          }
        }

        return {
          lines: total.lines.pct,
          statements: total.statements.pct,
          functions: total.functions.pct,
          branches: total.branches.pct,
          overall: ((total.lines.pct + total.functions.pct + total.branches.pct) / 3).toFixed(2),
          uncovered,
          details: {
            lines: total.lines,
            statements: total.statements,
            functions: total.functions,
            branches: total.branches
          }
        };
      } catch (error) {
        try {
          execSync('npm test -- --coverage --coverageReporters=json-summary', {
            cwd: this.projectPath,
            encoding: 'utf8',
            stdio: 'pipe'
          });

          const coverageData = await fs.readFile(coveragePath, 'utf8');
          const coverage = JSON.parse(coverageData);
          const total = coverage.total;

          return {
            lines: total.lines.pct,
            statements: total.statements.pct,
            functions: total.functions.pct,
            branches: total.branches.pct,
            overall: ((total.lines.pct + total.functions.pct + total.branches.pct) / 3).toFixed(2)
          };
        } catch (testError) {
          return { skipped: true, reason: 'Coverage data not available' };
        }
      }
    } catch (error) {
      return { error: error.message };
    }
  }

  async detectDuplication() {
    try {
      const jsFiles = await globAsync('**/*.{js,jsx}', {
        cwd: this.projectPath,
        ignore: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', '__tests__/**', '*.test.js']
      });

      if (jsFiles.length === 0) {
        return { skipped: true, reason: 'No JavaScript files found' };
      }

      const fileContents = {};
      const duplicates = [];
      let totalLines = 0;
      let duplicateLines = 0;

      for (const file of jsFiles) {
        const filePath = path.join(this.projectPath, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        fileContents[file] = lines;
        totalLines += lines.length;
      }

      const minDuplicateLines = 10;
      const processedBlocks = new Set();

      for (const file1 of Object.keys(fileContents)) {
        for (const file2 of Object.keys(fileContents)) {
          if (file1 >= file2) continue;

          const duplicateBlocks = this.findDuplicateBlocks(
            fileContents[file1],
            fileContents[file2],
            minDuplicateLines
          );

          for (const block of duplicateBlocks) {
            const blockKey = `${block.content.slice(0, 100)}`;
            if (!processedBlocks.has(blockKey)) {
              processedBlocks.add(blockKey);
              duplicates.push({
                files: [file1, file2],
                lines: block.lines,
                startLine1: block.startLine1,
                startLine2: block.startLine2,
                tokens: block.lines * 10
              });
              duplicateLines += block.lines * 2;
            }
          }
        }
      }

      const percentage = totalLines > 0 ? ((duplicateLines / totalLines) * 100).toFixed(2) : 0;

      return {
        duplicates: duplicates.sort((a, b) => b.lines - a.lines),
        percentage: parseFloat(percentage),
        totalDuplicateLines: duplicateLines,
        totalLines
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  findDuplicateBlocks(lines1, lines2, minLines) {
    const duplicates = [];

    for (let i = 0; i < lines1.length - minLines; i++) {
      for (let j = 0; j < lines2.length - minLines; j++) {
        let matchLength = 0;

        while (
          i + matchLength < lines1.length &&
          j + matchLength < lines2.length &&
          this.normalizeCode(lines1[i + matchLength]) === this.normalizeCode(lines2[j + matchLength])
        ) {
          matchLength++;
        }

        if (matchLength >= minLines) {
          const content = lines1.slice(i, i + matchLength).join('\n');
          duplicates.push({
            startLine1: i + 1,
            startLine2: j + 1,
            lines: matchLength,
            content
          });

          i += matchLength - 1;
          break;
        }
      }
    }

    return duplicates;
  }

  normalizeCode(line) {
    return line
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/['"`]/g, '')
      .replace(/\/\/.*/g, '')
      .replace(/\/\*.*?\*\//g, '');
  }

  async calculateMaintainabilityIndex() {
    try {
      const complexity = await this.analyzeComplexity();
      const coverage = await this.analyzeCoverage();

      if (complexity.skipped || coverage.skipped) {
        return { skipped: true, reason: 'Insufficient data for calculation' };
      }

      const halsteadVolume = 100;
      const cyclomaticComplexity = parseFloat(complexity.averageComplexity || 10);
      const linesOfCode = 1000;

      const maintainabilityIndex = Math.max(
        0,
        Math.min(
          100,
          171 - 5.2 * Math.log(halsteadVolume) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(linesOfCode)
        )
      );

      const adjustedIndex = maintainabilityIndex * 0.8 + (coverage.overall ? parseFloat(coverage.overall) * 0.2 : 0);

      let grade;
      if (adjustedIndex >= 80) grade = 'A';
      else if (adjustedIndex >= 60) grade = 'B';
      else if (adjustedIndex >= 40) grade = 'C';
      else if (adjustedIndex >= 20) grade = 'D';
      else grade = 'F';

      return {
        index: parseFloat(adjustedIndex.toFixed(2)),
        grade,
        factors: {
          complexity: cyclomaticComplexity,
          coverage: coverage.overall || 0,
          volume: halsteadVolume,
          linesOfCode
        }
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  generateSummary(results) {
    const summary = {
      overallQuality: 'Unknown',
      issues: [],
      strengths: [],
      metrics: {}
    };

    if (results.complexity && !results.complexity.skipped) {
      summary.metrics.averageComplexity = results.complexity.averageComplexity;

      if (results.complexity.highComplexity.length > 0) {
        summary.issues.push(`${results.complexity.highComplexity.length} functions with high complexity`);
      }

      if (parseFloat(results.complexity.averageComplexity) < 5) {
        summary.strengths.push('Low average complexity');
      }
    }

    if (results.coverage && !results.coverage.skipped) {
      summary.metrics.coverage = results.coverage.overall + '%';

      if (results.coverage.overall < 60) {
        summary.issues.push('Low test coverage');
      } else if (results.coverage.overall > 80) {
        summary.strengths.push('Good test coverage');
      }

      if (results.coverage.uncovered && results.coverage.uncovered.length > 0) {
        summary.issues.push(`${results.coverage.uncovered.length} files with no coverage`);
      }
    }

    if (results.duplication && !results.duplication.skipped) {
      summary.metrics.duplication = results.duplication.percentage + '%';

      if (results.duplication.percentage > 5) {
        summary.issues.push('High code duplication');
      } else {
        summary.strengths.push('Low code duplication');
      }
    }

    if (results.maintainability && !results.maintainability.skipped) {
      summary.metrics.maintainability = results.maintainability.grade;

      if (results.maintainability.grade === 'A' || results.maintainability.grade === 'B') {
        summary.strengths.push('Good maintainability');
      } else if (results.maintainability.grade === 'D' || results.maintainability.grade === 'F') {
        summary.issues.push('Poor maintainability');
      }
    }

    const issueCount = summary.issues.length;
    const strengthCount = summary.strengths.length;

    if (strengthCount > issueCount * 2) {
      summary.overallQuality = 'Excellent';
    } else if (strengthCount > issueCount) {
      summary.overallQuality = 'Good';
    } else if (issueCount > strengthCount * 2) {
      summary.overallQuality = 'Poor';
    } else {
      summary.overallQuality = 'Fair';
    }

    return summary;
  }

  generateRecommendations(results) {
    const recommendations = [];

    if (results.complexity && !results.complexity.skipped) {
      if (results.complexity.highComplexity.length > 0) {
        const topComplex = results.complexity.highComplexity.slice(0, 3);
        recommendations.push(
          `Refactor high complexity functions: ${topComplex.map(f => `${f.name} (${f.complexity})`).join(', ')}`
        );
      }

      if (parseFloat(results.complexity.averageComplexity) > 10) {
        recommendations.push('Consider breaking down complex functions into smaller, more focused functions');
      }
    }

    if (results.coverage && !results.coverage.skipped) {
      if (results.coverage.overall < 60) {
        recommendations.push('Increase test coverage to at least 60%');
      }

      if (results.coverage.branches < 50) {
        recommendations.push('Add more tests for conditional branches');
      }

      if (results.coverage.uncovered && results.coverage.uncovered.length > 0) {
        recommendations.push(
          `Add tests for uncovered files: ${results.coverage.uncovered.slice(0, 3).join(', ')}`
        );
      }
    }

    if (results.duplication && !results.duplication.skipped) {
      if (results.duplication.percentage > 5) {
        recommendations.push('Extract duplicate code into shared utilities or components');

        if (results.duplication.duplicates.length > 0) {
          const topDuplicates = results.duplication.duplicates.slice(0, 3);
          recommendations.push(
            `Review duplicate blocks in: ${topDuplicates.map(d => d.files.join(' & ')).join(', ')}`
          );
        }
      }
    }

    if (results.maintainability && !results.maintainability.skipped) {
      if (results.maintainability.grade === 'C' || results.maintainability.grade === 'D') {
        recommendations.push('Improve code maintainability through refactoring and better documentation');
      }

      if (results.maintainability.grade === 'F') {
        recommendations.push('Critical: Code maintainability is very poor - consider major refactoring');
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Code quality is good - maintain current standards');
    }

    return recommendations;
  }
}

module.exports = CodeQualityAnalyzer;