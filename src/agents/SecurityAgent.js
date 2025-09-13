import { BaseAgent } from './BaseAgent.js';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * SecurityAgent - Performs vulnerability scanning, SAST analysis,
 * dependency auditing, and secret detection
 */
export class SecurityAgent extends BaseAgent {
  constructor(config = {}) {
    super({
      ...config,
      id: 'security',
      name: 'SecurityAgent',
      description: 'Performs vulnerability scanning, SAST analysis, dependency auditing, and secret detection'
    });

    this.capabilities = [
      'vulnerability-scanning',
      'sast-analysis',
      'dependency-audit',
      'secret-detection'
    ];
  }

  async onInitialize() {
    // Load security rules and vulnerability database
    this.state.securityRules = this.loadSecurityRules();
    this.state.vulnerabilityDatabase = this.loadVulnerabilityDatabase();
    this.state.scanHistory = this.state.scanHistory || [];
    this.state.vulnerabilityTrends = this.state.vulnerabilityTrends || [];
  }

  loadSecurityRules() {
    return {
      vulnerabilities: {
        'sql-injection': {
          patterns: [
            /query\s*\(\s*["'`].*?\+.*?["'`]/,
            /execute\s*\(\s*["'`].*?\+.*?["'`]/,
            /WHERE.*?\+.*?(?:req\.|request\.|params\.|query\.)/
          ],
          severity: 'high'
        },
        'xss': {
          patterns: [
            /innerHTML\s*=.*?(?:req\.|request\.|params\.|query\.)/,
            /document\.write\s*\(.*?(?:req\.|request\.|params\.)/,
            /res\.send\s*\(\s*['"`].*?\+.*?req\./
          ],
          severity: 'high'
        },
        'path-traversal': {
          patterns: [
            /path\.join\s*\(.*?(?:req\.|request\.|params\.|query\.)/,
            /readFile.*?(?:req\.|request\.|params\.|query\.)/,
            /sendFile.*?(?:req\.|request\.|params\.|query\.)/
          ],
          severity: 'high'
        },
        'command-injection': {
          patterns: [
            /exec\s*\(.*?\+.*?(?:req\.|request\.|params\.|query\.)/,
            /spawn\s*\(.*?\+.*?(?:req\.|request\.|params\.|query\.)/,
            /execSync\s*\(.*?\+.*?(?:req\.|request\.|params\.|query\.)/
          ],
          severity: 'critical'
        }
      },
      secrets: {
        'api-key': /(?:api[_-]?key|apikey)[\s:=]+['"]?([a-zA-Z0-9\-_]{20,})['"]?/i,
        'aws-access-key': /AKIA[0-9A-Z]{16}/,
        'aws-secret-key': /[0-9a-zA-Z/+=]{40}/,
        'private-key': /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/,
        'database-url': /(?:mongodb|postgresql|mysql):\/\/[^:]+:[^@]+@[^/]+/,
        'github-token': /ghp_[a-zA-Z0-9]{36}/,
        'jwt-secret': /(?:jwt[_-]?secret|secret[_-]?key)[\s:=]+['"]([^'"]{10,})['"]?/i
      },
      weakCrypto: {
        'md5': /createHash\s*\(\s*['"]md5['"]/,
        'sha1': /createHash\s*\(\s*['"]sha1['"]/,
        'weak-random': /Math\.random\s*\(\s*\)/
      }
    };
  }

  loadVulnerabilityDatabase() {
    return {
      'minimist': { versions: ['< 1.2.6'], severity: 'high', cve: 'CVE-2021-44906' },
      'serialize-javascript': { versions: ['< 3.1.0'], severity: 'high', cve: 'CVE-2020-7660' },
      'lodash': { versions: ['< 4.17.21'], severity: 'high', cve: 'CVE-2021-23337' }
    };
  }

  canHandle(task) {
    const validTasks = [
      'scan-vulnerabilities',
      'sast-analysis',
      'audit-dependencies',
      'detect-secrets',
      'generate-report',
      'calculate-score'
    ];
    return validTasks.includes(task);
  }

  async onExecute(task, context) {
    switch (task) {
      case 'scan-vulnerabilities':
        return await this.scanVulnerabilities(context);
      case 'sast-analysis':
        return await this.performSASTAnalysis(context);
      case 'audit-dependencies':
        return await this.auditDependencies(context);
      case 'detect-secrets':
        return await this.detectSecrets(context);
      case 'generate-report':
        return await this.generateSecurityReport(context);
      case 'calculate-score':
        return await this.calculateSecurityScore(context);
      default:
        throw new Error(`Unknown task: ${task}`);
    }
  }

  async scanVulnerabilities(context) {
    const { filePath } = context;

    try {
      const code = await fs.readFile(filePath, 'utf-8');
      const vulnerabilities = [];

      // Scan for each vulnerability type
      for (const [vulnType, config] of Object.entries(this.state.securityRules.vulnerabilities)) {
        for (const pattern of config.patterns) {
          const matches = code.match(pattern);
          if (matches) {
            const lines = code.substring(0, code.indexOf(matches[0])).split('\n');
            vulnerabilities.push({
              type: vulnType,
              severity: config.severity,
              line: lines.length,
              file: filePath,
              snippet: matches[0].substring(0, 100)
            });
          }
        }
      }

      // Update scan history
      this.state.scanHistory.push({
        type: 'scan-vulnerabilities',
        file: filePath,
        timestamp: new Date().toISOString(),
        vulnerabilities: vulnerabilities.length
      });

      // Track trends
      this.state.vulnerabilityTrends.push({
        timestamp: new Date().toISOString(),
        count: vulnerabilities.length,
        critical: vulnerabilities.filter(v => v.severity === 'critical').length,
        high: vulnerabilities.filter(v => v.severity === 'high').length
      });

      await this.saveState();

      return { vulnerabilities };
    } catch (error) {
      throw new Error(`Failed to scan vulnerabilities: ${error.message}`);
    }
  }

  async performSASTAnalysis(context) {
    const { filePath, useESLint } = context;

    try {
      const code = await fs.readFile(filePath, 'utf-8');
      const issues = [];

      // Check for weak cryptography
      for (const [weakness, pattern] of Object.entries(this.state.securityRules.weakCrypto)) {
        if (pattern.test(code)) {
          issues.push({
            type: 'weak-crypto',
            message: `Weak cryptography detected: ${weakness}`,
            severity: 'medium'
          });
        }
      }

      // Check for weak random number generation
      if (/Math\.random/.test(code)) {
        issues.push({
          type: 'weak-random',
          message: 'Math.random() is not cryptographically secure',
          severity: 'low'
        });
      }

      // Check for insecure configurations
      if (/cors\s*\(\s*{\s*origin:\s*['"`]\*['"`]/.test(code)) {
        issues.push({
          type: 'insecure-cors',
          message: 'CORS configured with wildcard origin',
          severity: 'medium'
        });
      }

      if (/contentSecurityPolicy:\s*false/.test(code)) {
        issues.push({
          type: 'disabled-security-feature',
          message: 'Content Security Policy is disabled',
          severity: 'medium'
        });
      }

      // Run ESLint if requested
      let eslintIssues = [];
      if (useESLint) {
        try {
          const { stdout } = await execAsync(`eslint --format json ${filePath}`);
          eslintIssues = JSON.parse(stdout);
        } catch (error) {
          // ESLint might exit with error code if issues found
          if (error.stdout) {
            try {
              eslintIssues = JSON.parse(error.stdout);
            } catch (parseError) {
              // Ignore parse errors
            }
          }
        }
      }

      return { issues, eslintIssues };
    } catch (error) {
      throw new Error(`Failed to perform SAST analysis: ${error.message}`);
    }
  }

  async auditDependencies(context) {
    const { directory, checkOutdated } = context;

    try {
      const packageJsonPath = path.join(directory, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      const summary = {
        critical: 0,
        high: 0,
        moderate: 0,
        low: 0
      };

      const vulnerabilities = [];
      const knownVulnerabilities = [];

      // Check against known vulnerability database
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      for (const [pkg, version] of Object.entries(allDeps)) {
        if (this.state.vulnerabilityDatabase[pkg]) {
          const vuln = this.state.vulnerabilityDatabase[pkg];
          knownVulnerabilities.push({
            package: pkg,
            version,
            severity: vuln.severity,
            cve: vuln.cve
          });

          if (vuln.severity === 'critical') summary.critical++;
          else if (vuln.severity === 'high') summary.high++;
          else if (vuln.severity === 'moderate') summary.moderate++;
          else summary.low++;
        }
      }

      // Try to run npm audit
      try {
        const { stdout } = await execAsync('npm audit --json', { cwd: directory });
        const auditResult = JSON.parse(stdout);

        if (auditResult.metadata) {
          summary.critical = auditResult.metadata.vulnerabilities.critical || 0;
          summary.high = auditResult.metadata.vulnerabilities.high || 0;
          summary.moderate = auditResult.metadata.vulnerabilities.moderate || 0;
          summary.low = auditResult.metadata.vulnerabilities.low || 0;
        }

        if (auditResult.advisories) {
          for (const advisory of Object.values(auditResult.advisories)) {
            vulnerabilities.push({
              module: advisory.module_name,
              severity: advisory.severity,
              title: advisory.title
            });
          }
        }
      } catch (error) {
        // npm audit might fail, use our known vulnerabilities
        vulnerabilities.push(...knownVulnerabilities);
      }

      // Check for outdated packages if requested
      let outdated = [];
      if (checkOutdated) {
        try {
          const { stdout } = await execAsync('npm outdated --json', { cwd: directory });
          outdated = JSON.parse(stdout);
        } catch (error) {
          // npm outdated exits with error if packages are outdated
          if (error.stdout) {
            try {
              outdated = JSON.parse(error.stdout);
            } catch (parseError) {
              // Ignore parse errors
            }
          }
        }
      }

      const recommendations = [];
      if (summary.critical > 0 || summary.high > 0) {
        recommendations.push('Run npm audit fix to automatically fix vulnerabilities');
      }

      return {
        summary,
        vulnerabilities,
        knownVulnerabilities,
        outdated,
        recommendations
      };
    } catch (error) {
      throw new Error(`Failed to audit dependencies: ${error.message}`);
    }
  }

  async detectSecrets(context) {
    const { filePath, directory } = context;

    if (directory) {
      // Scan entire directory
      const files = await this.getAllFiles(directory);
      let totalSecrets = 0;
      const allSecrets = [];

      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          const secrets = this.scanForSecrets(content, file);
          allSecrets.push(...secrets);
          totalSecrets += secrets.length;
        } catch (error) {
          // Skip files that can't be read
        }
      }

      return {
        filesScanned: files.length,
        totalSecrets,
        secrets: allSecrets
      };
    }

    // Scan single file
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const secrets = this.scanForSecrets(content, filePath);

      // Update scan history
      this.state.scanHistory.push({
        type: 'detect-secrets',
        file: filePath,
        timestamp: new Date().toISOString(),
        secretsFound: secrets.length
      });

      await this.saveState();

      return { secrets };
    } catch (error) {
      throw new Error(`Failed to detect secrets: ${error.message}`);
    }
  }

  scanForSecrets(content, filePath) {
    const secrets = [];

    for (const [type, pattern] of Object.entries(this.state.securityRules.secrets)) {
      const matches = content.match(new RegExp(pattern, 'g'));
      if (matches) {
        secrets.push({
          type,
          severity: type === 'private-key' || type === 'api-key' ? 'critical' : 'high',
          file: filePath,
          count: matches.length
        });
      }
    }

    return secrets;
  }

  async generateSecurityReport(context) {
    const { directory, includeAll } = context;

    const report = {
      summary: {
        timestamp: new Date().toISOString(),
        directory
      },
      vulnerabilities: [],
      dependencies: {},
      secrets: [],
      recommendations: [],
      score: 0
    };

    if (includeAll) {
      // Comprehensive scan
      const files = await this.getAllFiles(directory);

      for (const file of files.slice(0, 10)) { // Limit for performance
        if (file.endsWith('.js') || file.endsWith('.jsx')) {
          try {
            const vulns = await this.scanVulnerabilities({ filePath: file });
            report.vulnerabilities.push(...vulns.vulnerabilities);
          } catch (error) {
            // Skip files with errors
          }
        }
      }

      // Audit dependencies
      try {
        const audit = await this.auditDependencies({ directory });
        report.dependencies = audit;
      } catch (error) {
        // Skip if audit fails
      }

      // Detect secrets
      try {
        const secrets = await this.detectSecrets({ directory });
        report.secrets = secrets.secrets || [];
      } catch (error) {
        // Skip if secret detection fails
      }
    }

    // Calculate score
    const scoreData = await this.calculateSecurityScore({
      metrics: {
        vulnerabilities: {
          critical: report.vulnerabilities.filter(v => v.severity === 'critical').length,
          high: report.vulnerabilities.filter(v => v.severity === 'high').length,
          medium: report.vulnerabilities.filter(v => v.severity === 'medium').length,
          low: report.vulnerabilities.filter(v => v.severity === 'low').length
        },
        coverage: {
          sast: true,
          dependencies: true,
          secrets: report.secrets.length === 0
        }
      }
    });

    report.score = scoreData.score;
    report.grade = scoreData.grade;

    // Generate recommendations
    if (report.vulnerabilities.length > 0) {
      report.recommendations.push('Fix identified vulnerabilities, prioritizing critical and high severity issues');
    }
    if (report.secrets.length > 0) {
      report.recommendations.push('Remove hardcoded secrets and use environment variables or secret management systems');
    }
    if (report.dependencies.summary && report.dependencies.summary.high > 0) {
      report.recommendations.push('Update vulnerable dependencies using npm audit fix');
    }

    return { report };
  }

  async calculateSecurityScore(context) {
    const { metrics } = context;

    let score = 100;

    // Deduct points for vulnerabilities
    score -= metrics.vulnerabilities.critical * 20;
    score -= metrics.vulnerabilities.high * 10;
    score -= metrics.vulnerabilities.medium * 5;
    score -= metrics.vulnerabilities.low * 2;

    // Bonus for coverage
    if (metrics.coverage.sast) score += 5;
    if (metrics.coverage.dependencies) score += 5;
    if (metrics.coverage.secrets) score += 5;

    score = Math.max(0, Math.min(100, score));

    let grade;
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';

    return { score, grade };
  }

  async getAllFiles(dir, extensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.env']) {
    const files = [];

    try {
      const entries = await fs.readdir(dir);

      for (const entry of entries) {
        if (entry === 'node_modules' || entry.startsWith('.git')) continue;

        const fullPath = path.join(dir, entry);
        try {
          const stat = await fs.stat(fullPath);

          if (stat.isDirectory()) {
            const subFiles = await this.getAllFiles(fullPath, extensions);
            files.push(...subFiles);
          } else if (stat.isFile() && (extensions.length === 0 || extensions.some(ext => entry.endsWith(ext)))) {
            files.push(fullPath);
          }
        } catch (error) {
          // Skip files/dirs that can't be accessed
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }

    return files;
  }
}