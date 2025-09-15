const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');
const { promisify } = require('util');

const globAsync = promisify(glob);

class SecurityScanner {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }

  async scan() {
    const results = {
      javascript: await this.scanJavaScript(),
      python: await this.scanPython(),
      dependencies: await this.scanDependencies(),
      timestamp: new Date().toISOString(),
    };

    results.vulnerabilities = this.aggregateVulnerabilities(results);
    results.summary = this.generateSummary(results);

    return results;
  }

  async scanJavaScript() {
    try {
      const jsFiles = await globAsync('**/*.{js,jsx,ts,tsx}', {
        cwd: this.projectPath,
        ignore: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**'],
      });

      if (jsFiles.length === 0) {
        return { skipped: true, reason: 'No JavaScript files found' };
      }

      const eslintConfigPath = path.join(this.projectPath, '.eslintrc.security.json');
      await this.createESLintSecurityConfig(eslintConfigPath);

      try {
        const command = `npx eslint --config ${eslintConfigPath} --format json ${jsFiles.join(' ')}`;
        const output = execSync(command, { cwd: this.projectPath, encoding: 'utf8' });
        const results = JSON.parse(output);

        const vulnerabilities = [];
        for (const result of results) {
          for (const message of result.messages) {
            if (message.ruleId && message.ruleId.includes('security')) {
              vulnerabilities.push({
                file: path.relative(this.projectPath, result.filePath),
                rule: message.ruleId,
                severity: this.mapESLintSeverity(message.severity),
                message: message.message,
                line: message.line,
                column: message.column,
              });
            }
          }
        }

        return { vulnerabilities, scanned: jsFiles.length };
      } catch (error) {
        if (error.stdout) {
          try {
            const results = JSON.parse(error.stdout);
            const vulnerabilities = [];
            for (const result of results) {
              for (const message of result.messages) {
                if (message.ruleId && message.ruleId.includes('security')) {
                  vulnerabilities.push({
                    file: path.relative(this.projectPath, result.filePath),
                    rule: message.ruleId,
                    severity: this.mapESLintSeverity(message.severity),
                    message: message.message,
                    line: message.line,
                    column: message.column,
                  });
                }
              }
            }
            return { vulnerabilities, scanned: jsFiles.length };
          } catch (parseError) {
            return { error: error.message, skipped: false };
          }
        }
        return { error: error.message, skipped: false };
      }
    } catch (error) {
      return { error: error.message, skipped: false };
    }
  }

  async scanPython() {
    try {
      const pyFiles = await globAsync('**/*.py', {
        cwd: this.projectPath,
        ignore: ['venv/**', '__pycache__/**', '*.pyc'],
      });

      if (pyFiles.length === 0) {
        return { skipped: true, reason: 'No Python files found' };
      }

      try {
        const command = `bandit -r . -f json`;
        const output = execSync(command, { cwd: this.projectPath, encoding: 'utf8' });
        const results = JSON.parse(output);

        const vulnerabilities = results.results.map((issue) => ({
          file: path.relative(this.projectPath, issue.filename),
          severity: issue.issue_severity,
          confidence: issue.issue_confidence,
          message: issue.issue_text,
          line: issue.line_number,
          cwe: issue.issue_cwe,
          testId: issue.test_id,
        }));

        return { vulnerabilities, scanned: pyFiles.length };
      } catch (error) {
        if (error.message.includes('bandit: command not found')) {
          return { skipped: true, reason: 'Bandit not installed' };
        }
        return { error: error.message, skipped: false };
      }
    } catch (error) {
      return { error: error.message, skipped: false };
    }
  }

  async scanDependencies() {
    const results = {};

    try {
      await fs.access(path.join(this.projectPath, 'package.json'));
      results.npm = await this.scanNpmDependencies();
    } catch (error) {
      results.npm = { skipped: true, reason: 'No package.json found' };
    }

    try {
      await fs.access(path.join(this.projectPath, 'requirements.txt'));
      results.python = await this.scanPythonDependencies();
    } catch (error) {
      results.python = { skipped: true, reason: 'No requirements.txt found' };
    }

    return results;
  }

  async scanNpmDependencies() {
    try {
      const command = 'npm audit --json';
      const output = execSync(command, { cwd: this.projectPath, encoding: 'utf8' });
      const auditReport = JSON.parse(output);

      return {
        vulnerabilities: auditReport.vulnerabilities || {},
        high: auditReport.metadata?.vulnerabilities?.high || 0,
        moderate: auditReport.metadata?.vulnerabilities?.moderate || 0,
        low: auditReport.metadata?.vulnerabilities?.low || 0,
        info: auditReport.metadata?.vulnerabilities?.info || 0,
      };
    } catch (error) {
      if (error.stdout) {
        try {
          const auditReport = JSON.parse(error.stdout);
          return {
            vulnerabilities: auditReport.vulnerabilities || {},
            high: auditReport.metadata?.vulnerabilities?.high || 0,
            moderate: auditReport.metadata?.vulnerabilities?.moderate || 0,
            low: auditReport.metadata?.vulnerabilities?.low || 0,
            info: auditReport.metadata?.vulnerabilities?.info || 0,
          };
        } catch (parseError) {
          return { error: error.message };
        }
      }
      return { error: error.message };
    }
  }

  async scanPythonDependencies() {
    try {
      const command = 'pip-audit --format json';
      const output = execSync(command, { cwd: this.projectPath, encoding: 'utf8' });
      const auditReport = JSON.parse(output);

      const vulnerabilities = auditReport.map((vuln) => ({
        name: vuln.name,
        version: vuln.version,
        vulns: vuln.vulns,
        fixVersions: vuln.vulns.map((v) => v.fix_versions).flat(),
      }));

      return { vulnerabilities };
    } catch (error) {
      if (error.message.includes('pip-audit: command not found')) {
        return { skipped: true, reason: 'pip-audit not installed' };
      }
      return { error: error.message };
    }
  }

  async createESLintSecurityConfig(configPath) {
    const config = {
      extends: ['plugin:security/recommended'],
      plugins: ['security'],
      rules: {
        'security/detect-non-literal-fs-filename': 'warn',
        'security/detect-non-literal-regexp': 'warn',
        'security/detect-unsafe-regex': 'error',
        'security/detect-buffer-noassert': 'error',
        'security/detect-child-process': 'warn',
        'security/detect-disable-mustache-escape': 'error',
        'security/detect-eval-with-expression': 'error',
        'security/detect-no-csrf-before-method-override': 'error',
        'security/detect-non-literal-require': 'warn',
        'security/detect-object-injection': 'warn',
        'security/detect-possible-timing-attacks': 'warn',
        'security/detect-pseudoRandomBytes': 'error',
      },
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
      },
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  }

  mapESLintSeverity(severity) {
    switch (severity) {
      case 2:
        return 'HIGH';
      case 1:
        return 'MEDIUM';
      default:
        return 'LOW';
    }
  }

  aggregateVulnerabilities(results) {
    const allVulnerabilities = [];

    if (results.javascript?.vulnerabilities) {
      allVulnerabilities.push(
        ...results.javascript.vulnerabilities.map((v) => ({
          ...v,
          source: 'javascript',
        }))
      );
    }

    if (results.python?.vulnerabilities) {
      allVulnerabilities.push(
        ...results.python.vulnerabilities.map((v) => ({
          ...v,
          source: 'python',
        }))
      );
    }

    return allVulnerabilities;
  }

  generateSummary(results) {
    const summary = {
      totalVulnerabilities: 0,
      bySeverity: {
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
      },
      bySource: {},
    };

    if (results.vulnerabilities) {
      summary.totalVulnerabilities = results.vulnerabilities.length;

      for (const vuln of results.vulnerabilities) {
        if (vuln.severity && summary.bySeverity[vuln.severity] !== undefined) {
          summary.bySeverity[vuln.severity]++;
        }

        if (vuln.source) {
          summary.bySource[vuln.source] = (summary.bySource[vuln.source] || 0) + 1;
        }
      }
    }

    if (results.dependencies?.npm) {
      summary.npmVulnerabilities = {
        high: results.dependencies.npm.high || 0,
        moderate: results.dependencies.npm.moderate || 0,
        low: results.dependencies.npm.low || 0,
      };
    }

    return summary;
  }
}

module.exports = SecurityScanner;
