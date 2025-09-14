const fs = require('fs').promises;
const path = require('path');

class AnalysisReportAggregator {
  constructor() {
    this.defaultWeights = {
      security: 0.35,
      performance: 0.25,
      codeQuality: 0.25,
      dependencies: 0.15
    };
  }

  aggregate(results) {
    const timestamp = new Date().toISOString();

    const report = {
      ...results,
      timestamp,
      summary: this.generateSummary(results)
    };

    return report;
  }

  generateSummary(results) {
    const summary = {
      totalIssues: 0,
      criticalIssues: 0,
      warnings: 0,
      overallHealth: 0,
      categories: {}
    };

    if (results.security) {
      const securitySummary = this.summarizeSecurity(results.security);
      summary.categories.security = securitySummary;
      summary.totalIssues += securitySummary.issueCount;
      summary.criticalIssues += securitySummary.criticalCount;
      summary.warnings += securitySummary.warningCount;
    }

    if (results.performance) {
      const performanceSummary = this.summarizePerformance(results.performance);
      summary.categories.performance = performanceSummary;
      summary.totalIssues += performanceSummary.issueCount;
      summary.warnings += performanceSummary.warningCount;
    }

    if (results.codeQuality) {
      const qualitySummary = this.summarizeCodeQuality(results.codeQuality);
      summary.categories.codeQuality = qualitySummary;
      summary.totalIssues += qualitySummary.issueCount;
      summary.warnings += qualitySummary.warningCount;
    }

    if (results.dependencies) {
      const dependencySummary = this.summarizeDependencies(results.dependencies);
      summary.categories.dependencies = dependencySummary;
      summary.totalIssues += dependencySummary.issueCount;
      summary.warnings += dependencySummary.warningCount;
    }

    summary.overallHealth = this.calculateHealthScore(results);

    return summary;
  }

  summarizeSecurity(security) {
    const summary = {
      issueCount: 0,
      criticalCount: 0,
      warningCount: 0,
      score: 100
    };

    if (security.vulnerabilities && Array.isArray(security.vulnerabilities)) {
      summary.issueCount = security.vulnerabilities.length;

      for (const vuln of security.vulnerabilities) {
        if (vuln.severity === 'HIGH' || vuln.severity === 'CRITICAL') {
          summary.criticalCount++;
        } else if (vuln.severity === 'MEDIUM') {
          summary.warningCount++;
        }
      }

      summary.score = Math.max(0, 100 - (summary.criticalCount * 20) - (summary.warningCount * 5));
    }

    if (security.dependencies) {
      if (security.dependencies.npm) {
        summary.issueCount += (security.dependencies.npm.high || 0) + (security.dependencies.npm.moderate || 0);
        summary.criticalCount += security.dependencies.npm.high || 0;
        summary.warningCount += security.dependencies.npm.moderate || 0;
      }
    }

    return summary;
  }

  summarizePerformance(performance) {
    const summary = {
      issueCount: 0,
      warningCount: 0,
      score: 100
    };

    if (performance.bundle && !performance.bundle.skipped) {
      const bundleSizeMB = parseFloat(performance.bundle.totalSizeInMB);

      if (bundleSizeMB > 10) {
        summary.issueCount++;
        summary.score -= 30;
      } else if (bundleSizeMB > 5) {
        summary.warningCount++;
        summary.score -= 15;
      }
    }

    if (performance.buildPerformance) {
      if (performance.buildPerformance.buildTime && !performance.buildPerformance.buildTime.skipped) {
        const buildTimeMs = performance.buildPerformance.buildTime.buildTime;

        if (buildTimeMs > 60000) {
          summary.issueCount++;
          summary.score -= 20;
        } else if (buildTimeMs > 30000) {
          summary.warningCount++;
          summary.score -= 10;
        }
      }

      if (performance.buildPerformance.memory && !performance.buildPerformance.memory.skipped) {
        const peakMemoryMB = parseFloat(performance.buildPerformance.memory.peakMemoryMB);

        if (peakMemoryMB > 1024) {
          summary.issueCount++;
          summary.score -= 15;
        } else if (peakMemoryMB > 512) {
          summary.warningCount++;
          summary.score -= 5;
        }
      }
    }

    summary.score = Math.max(0, summary.score);

    return summary;
  }

  summarizeCodeQuality(codeQuality) {
    const summary = {
      issueCount: 0,
      warningCount: 0,
      score: 100
    };

    if (codeQuality.complexity && !codeQuality.complexity.skipped) {
      if (codeQuality.complexity.highComplexity) {
        const highComplexityCount = codeQuality.complexity.highComplexity.length;

        if (highComplexityCount > 10) {
          summary.issueCount += Math.floor(highComplexityCount / 10);
          summary.score -= highComplexityCount * 2;
        } else if (highComplexityCount > 5) {
          summary.warningCount++;
          summary.score -= highComplexityCount;
        }
      }
    }

    if (codeQuality.coverage && !codeQuality.coverage.skipped) {
      const coverage = codeQuality.coverage.overall || codeQuality.coverage.lines || 0;

      if (coverage < 50) {
        summary.issueCount++;
        summary.score -= 30;
      } else if (coverage < 70) {
        summary.warningCount++;
        summary.score -= 15;
      } else if (coverage > 80) {
        summary.score += 10;
      }
    }

    if (codeQuality.duplication && !codeQuality.duplication.skipped) {
      const duplicationPercentage = codeQuality.duplication.percentage;

      if (duplicationPercentage > 10) {
        summary.issueCount++;
        summary.score -= 20;
      } else if (duplicationPercentage > 5) {
        summary.warningCount++;
        summary.score -= 10;
      }
    }

    if (codeQuality.maintainability && !codeQuality.maintainability.skipped) {
      const grade = codeQuality.maintainability.grade;

      if (grade === 'F') {
        summary.issueCount++;
        summary.score -= 25;
      } else if (grade === 'D') {
        summary.warningCount++;
        summary.score -= 15;
      } else if (grade === 'A') {
        summary.score += 10;
      }
    }

    summary.score = Math.max(0, Math.min(100, summary.score));

    return summary;
  }

  summarizeDependencies(dependencies) {
    const summary = {
      issueCount: 0,
      warningCount: 0,
      score: 100
    };

    if (dependencies.outdated) {
      let outdatedCount = 0;

      if (dependencies.outdated.npm && !dependencies.outdated.npm.skipped) {
        outdatedCount += Object.keys(dependencies.outdated.npm).length;
      }

      if (dependencies.outdated.python && !dependencies.outdated.python.skipped) {
        outdatedCount += Object.keys(dependencies.outdated.python).length;
      }

      if (outdatedCount > 20) {
        summary.issueCount++;
        summary.score -= 20;
      } else if (outdatedCount > 10) {
        summary.warningCount++;
        summary.score -= 10;
      }
    }

    if (dependencies.licenses) {
      const licenseIssues = dependencies.licenses.incompatible.length + dependencies.licenses.unlicensed.length;

      if (licenseIssues > 0) {
        summary.issueCount += Math.ceil(licenseIssues / 5);
        summary.score -= licenseIssues * 5;
      }
    }

    if (dependencies.circular && !dependencies.circular.error) {
      const circularCount = Object.keys(dependencies.circular).length;

      if (circularCount > 0) {
        summary.issueCount += circularCount;
        summary.score -= circularCount * 10;
      }
    }

    summary.score = Math.max(0, summary.score);

    return summary;
  }

  calculateHealthScore(results) {
    let weightedScore = 0;
    let totalWeight = 0;

    if (results.security && !results.security.error) {
      const securityScore = this.summarizeSecurity(results.security).score;
      weightedScore += securityScore * this.defaultWeights.security;
      totalWeight += this.defaultWeights.security;
    }

    if (results.performance && !results.performance.error) {
      const performanceScore = this.summarizePerformance(results.performance).score;
      weightedScore += performanceScore * this.defaultWeights.performance;
      totalWeight += this.defaultWeights.performance;
    }

    if (results.codeQuality && !results.codeQuality.error) {
      const qualityScore = this.summarizeCodeQuality(results.codeQuality).score;
      weightedScore += qualityScore * this.defaultWeights.codeQuality;
      totalWeight += this.defaultWeights.codeQuality;
    }

    if (results.dependencies && !results.dependencies.error) {
      const dependencyScore = this.summarizeDependencies(results.dependencies).score;
      weightedScore += dependencyScore * this.defaultWeights.dependencies;
      totalWeight += this.defaultWeights.dependencies;
    }

    if (totalWeight === 0) {
      return 0;
    }

    return Math.round(weightedScore / totalWeight);
  }

  formatReport(results, format = 'json') {
    const report = this.aggregate(results);

    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(report, null, 2);

      case 'markdown':
        return this.formatAsMarkdown(report);

      case 'html':
        return this.formatAsHTML(report);

      case 'text':
        return this.formatAsText(report);

      default:
        return JSON.stringify(report, null, 2);
    }
  }

  formatAsMarkdown(report) {
    let markdown = '# Analysis Report\n\n';
    markdown += `**Generated:** ${report.timestamp}\n\n`;

    if (report.summary) {
      markdown += '## Summary\n\n';
      markdown += `- **Overall Health:** ${report.summary.overallHealth}/100\n`;
      markdown += `- **Total Issues:** ${report.summary.totalIssues}\n`;
      markdown += `- **Critical Issues:** ${report.summary.criticalIssues}\n`;
      markdown += `- **Warnings:** ${report.summary.warnings}\n\n`;
    }

    if (report.security) {
      markdown += '## Security\n\n';

      if (report.security.vulnerabilities && report.security.vulnerabilities.length > 0) {
        markdown += '### Vulnerabilities\n\n';
        markdown += '| File | Severity | Issue |\n';
        markdown += '|------|----------|-------|\n';

        for (const vuln of report.security.vulnerabilities.slice(0, 10)) {
          markdown += `| ${vuln.file} | ${vuln.severity} | ${vuln.message || vuln.rule} |\n`;
        }
        markdown += '\n';
      }

      if (report.security.summary) {
        markdown += `**Summary:** ${JSON.stringify(report.security.summary)}\n\n`;
      }
    }

    if (report.performance) {
      markdown += '## Performance\n\n';

      if (report.performance.bundle && !report.performance.bundle.skipped) {
        markdown += `- **Bundle Size:** ${report.performance.bundle.totalSizeInMB} MB\n`;
      }

      if (report.performance.buildPerformance) {
        if (report.performance.buildPerformance.buildTime) {
          markdown += `- **Build Time:** ${report.performance.buildPerformance.buildTime.buildTimeSeconds} seconds\n`;
        }
        if (report.performance.buildPerformance.memory) {
          markdown += `- **Peak Memory:** ${report.performance.buildPerformance.memory.peakMemoryMB} MB\n`;
        }
      }

      if (report.performance.recommendations && report.performance.recommendations.length > 0) {
        markdown += '\n### Recommendations\n\n';
        for (const rec of report.performance.recommendations) {
          markdown += `- ${rec}\n`;
        }
      }
      markdown += '\n';
    }

    if (report.codeQuality) {
      markdown += '## Code Quality\n\n';

      if (report.codeQuality.coverage && !report.codeQuality.coverage.skipped) {
        markdown += `- **Coverage:** ${report.codeQuality.coverage.overall || report.codeQuality.coverage.lines}%\n`;
      }

      if (report.codeQuality.complexity && !report.codeQuality.complexity.skipped) {
        markdown += `- **Average Complexity:** ${report.codeQuality.complexity.averageComplexity}\n`;
      }

      if (report.codeQuality.duplication && !report.codeQuality.duplication.skipped) {
        markdown += `- **Code Duplication:** ${report.codeQuality.duplication.percentage}%\n`;
      }

      if (report.codeQuality.maintainability && !report.codeQuality.maintainability.skipped) {
        markdown += `- **Maintainability Grade:** ${report.codeQuality.maintainability.grade}\n`;
      }

      markdown += '\n';
    }

    if (report.dependencies) {
      markdown += '## Dependencies\n\n';

      if (report.dependencies.summary) {
        markdown += `- **Health:** ${report.dependencies.summary.health}\n`;
        markdown += `- **Outdated:** ${report.dependencies.summary.outdatedCount}\n`;
        markdown += `- **License Issues:** ${report.dependencies.summary.licenseIssues}\n`;
        markdown += `- **Circular Dependencies:** ${report.dependencies.summary.circularDependencies}\n`;
      }

      markdown += '\n';
    }

    return markdown;
  }

  formatAsHTML(report) {
    let html = `<!DOCTYPE html>
<html>
<head>
  <title>Analysis Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    h2 { color: #666; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .metric { margin: 10px 0; }
    .critical { color: #d9534f; }
    .warning { color: #f0ad4e; }
    .success { color: #5cb85c; }
    table { border-collapse: collapse; width: 100%; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <h1>Analysis Report</h1>
  <p><strong>Generated:</strong> ${report.timestamp}</p>`;

    if (report.summary) {
      html += `
  <div class="summary">
    <h2>Summary</h2>
    <div class="metric">Overall Health: <strong>${report.summary.overallHealth}/100</strong></div>
    <div class="metric">Total Issues: <strong>${report.summary.totalIssues}</strong></div>
    <div class="metric">Critical Issues: <strong class="critical">${report.summary.criticalIssues}</strong></div>
    <div class="metric">Warnings: <strong class="warning">${report.summary.warnings}</strong></div>
  </div>`;
    }

    if (report.security && report.security.vulnerabilities && report.security.vulnerabilities.length > 0) {
      html += `
  <h2>Security Vulnerabilities</h2>
  <table>
    <tr><th>File</th><th>Severity</th><th>Issue</th></tr>`;

      for (const vuln of report.security.vulnerabilities.slice(0, 10)) {
        const severityClass = vuln.severity === 'HIGH' ? 'critical' : vuln.severity === 'MEDIUM' ? 'warning' : '';
        html += `
    <tr>
      <td>${vuln.file}</td>
      <td class="${severityClass}">${vuln.severity}</td>
      <td>${vuln.message || vuln.rule}</td>
    </tr>`;
      }

      html += `
  </table>`;
    }

    if (report.codeQuality) {
      html += `
  <h2>Code Quality</h2>
  <div class="metric">Coverage: ${report.codeQuality.coverage?.overall || report.codeQuality.coverage?.lines || 'N/A'}%</div>
  <div class="metric">Average Complexity: ${report.codeQuality.complexity?.averageComplexity || 'N/A'}</div>
  <div class="metric">Code Duplication: ${report.codeQuality.duplication?.percentage || 'N/A'}%</div>
  <div class="metric">Maintainability Grade: ${report.codeQuality.maintainability?.grade || 'N/A'}</div>`;
    }

    html += `
</body>
</html>`;

    return html;
  }

  formatAsText(report) {
    let text = 'ANALYSIS REPORT\n';
    text += '=' . repeat(50) + '\n\n';
    text += `Generated: ${report.timestamp}\n\n`;

    if (report.summary) {
      text += 'SUMMARY\n';
      text += '-'.repeat(30) + '\n';
      text += `Overall Health: ${report.summary.overallHealth}/100\n`;
      text += `Total Issues: ${report.summary.totalIssues}\n`;
      text += `Critical Issues: ${report.summary.criticalIssues}\n`;
      text += `Warnings: ${report.summary.warnings}\n\n`;
    }

    if (report.security) {
      text += 'SECURITY\n';
      text += '-'.repeat(30) + '\n';

      if (report.security.vulnerabilities && report.security.vulnerabilities.length > 0) {
        text += `Found ${report.security.vulnerabilities.length} vulnerabilities\n`;

        for (const vuln of report.security.vulnerabilities.slice(0, 5)) {
          text += `  - ${vuln.file}: ${vuln.severity} - ${vuln.message || vuln.rule}\n`;
        }
      }
      text += '\n';
    }

    if (report.performance) {
      text += 'PERFORMANCE\n';
      text += '-'.repeat(30) + '\n';

      if (report.performance.bundle && !report.performance.bundle.skipped) {
        text += `Bundle Size: ${report.performance.bundle.totalSizeInMB} MB\n`;
      }

      if (report.performance.buildPerformance?.buildTime) {
        text += `Build Time: ${report.performance.buildPerformance.buildTime.buildTimeSeconds} seconds\n`;
      }
      text += '\n';
    }

    if (report.codeQuality) {
      text += 'CODE QUALITY\n';
      text += '-'.repeat(30) + '\n';

      if (report.codeQuality.coverage && !report.codeQuality.coverage.skipped) {
        text += `Coverage: ${report.codeQuality.coverage.overall || report.codeQuality.coverage.lines}%\n`;
      }

      if (report.codeQuality.complexity && !report.codeQuality.complexity.skipped) {
        text += `Average Complexity: ${report.codeQuality.complexity.averageComplexity}\n`;
      }

      if (report.codeQuality.duplication && !report.codeQuality.duplication.skipped) {
        text += `Code Duplication: ${report.codeQuality.duplication.percentage}%\n`;
      }
      text += '\n';
    }

    if (report.dependencies && report.dependencies.summary) {
      text += 'DEPENDENCIES\n';
      text += '-'.repeat(30) + '\n';
      text += `Health: ${report.dependencies.summary.health}\n`;
      text += `Outdated: ${report.dependencies.summary.outdatedCount}\n`;
      text += `License Issues: ${report.dependencies.summary.licenseIssues}\n`;
      text += '\n';
    }

    return text;
  }

  async exportReport(report, outputPath, format = 'json') {
    const formatted = this.formatReport(report, format);
    const outputDir = path.dirname(outputPath);

    try {
      await fs.access(outputDir);
    } catch {
      await fs.mkdir(outputDir, { recursive: true });
    }

    await fs.writeFile(outputPath, formatted, 'utf8');

    return outputPath;
  }

  compareReports(previousReport, currentReport) {
    const diff = {
      timestamp: new Date().toISOString(),
      previous: previousReport.timestamp,
      current: currentReport.timestamp,
      changes: {}
    };

    if (previousReport.security && currentReport.security) {
      diff.security = this.compareSecurityReports(previousReport.security, currentReport.security);
    }

    if (previousReport.performance && currentReport.performance) {
      diff.performance = this.comparePerformanceReports(previousReport.performance, currentReport.performance);
    }

    if (previousReport.codeQuality && currentReport.codeQuality) {
      diff.codeQuality = this.compareCodeQualityReports(previousReport.codeQuality, currentReport.codeQuality);
    }

    if (previousReport.dependencies && currentReport.dependencies) {
      diff.dependencies = this.compareDependencyReports(previousReport.dependencies, currentReport.dependencies);
    }

    diff.summary = this.generateDiffSummary(diff);

    return diff;
  }

  compareSecurityReports(previous, current) {
    const diff = {
      fixed: [],
      new: [],
      vulnerabilityChange: 0
    };

    if (previous.vulnerabilities && current.vulnerabilities) {
      const previousIds = new Set(previous.vulnerabilities.map(v => `${v.file}:${v.rule}:${v.line}`));
      const currentIds = new Set(current.vulnerabilities.map(v => `${v.file}:${v.rule}:${v.line}`));

      for (const id of previousIds) {
        if (!currentIds.has(id)) {
          diff.fixed.push(id);
        }
      }

      for (const id of currentIds) {
        if (!previousIds.has(id)) {
          diff.new.push(id);
        }
      }

      diff.vulnerabilityChange = current.vulnerabilities.length - previous.vulnerabilities.length;
    }

    return diff;
  }

  comparePerformanceReports(previous, current) {
    const diff = {};

    if (previous.bundle && current.bundle) {
      const previousSize = parseFloat(previous.bundle.totalSizeInMB || 0);
      const currentSize = parseFloat(current.bundle.totalSizeInMB || 0);
      diff.bundleSizeChange = (currentSize - previousSize).toFixed(2);
    }

    if (previous.buildPerformance?.buildTime && current.buildPerformance?.buildTime) {
      const previousTime = previous.buildPerformance.buildTime.buildTime || 0;
      const currentTime = current.buildPerformance.buildTime.buildTime || 0;
      diff.buildTimeChange = currentTime - previousTime;
    }

    return diff;
  }

  compareCodeQualityReports(previous, current) {
    const diff = {
      improvements: [],
      regressions: []
    };

    if (previous.coverage && current.coverage) {
      const previousCoverage = previous.coverage.overall || previous.coverage.lines || 0;
      const currentCoverage = current.coverage.overall || current.coverage.lines || 0;
      diff.coverageChange = currentCoverage - previousCoverage;

      if (diff.coverageChange > 0) {
        diff.improvements.push('coverage');
      } else if (diff.coverageChange < 0) {
        diff.regressions.push('coverage');
      }
    }

    if (previous.complexity && current.complexity) {
      const previousComplexity = parseFloat(previous.complexity.averageComplexity || 0);
      const currentComplexity = parseFloat(current.complexity.averageComplexity || 0);
      diff.complexityChange = currentComplexity - previousComplexity;

      if (diff.complexityChange < 0) {
        diff.improvements.push('complexity');
      } else if (diff.complexityChange > 0) {
        diff.regressions.push('complexity');
      }
    }

    if (previous.duplication && current.duplication) {
      const previousDuplication = previous.duplication.percentage || 0;
      const currentDuplication = current.duplication.percentage || 0;
      diff.duplicationChange = currentDuplication - previousDuplication;

      if (diff.duplicationChange < 0) {
        diff.improvements.push('duplication');
      } else if (diff.duplicationChange > 0) {
        diff.regressions.push('duplication');
      }
    }

    return diff;
  }

  compareDependencyReports(previous, current) {
    const diff = {
      newOutdated: 0,
      fixed: 0
    };

    if (previous.outdated?.npm && current.outdated?.npm) {
      const previousPackages = Object.keys(previous.outdated.npm);
      const currentPackages = Object.keys(current.outdated.npm);

      diff.fixed = previousPackages.filter(p => !currentPackages.includes(p)).length;
      diff.newOutdated = currentPackages.filter(p => !previousPackages.includes(p)).length;
    }

    return diff;
  }

  generateDiffSummary(diff) {
    const summary = {
      improvements: [],
      regressions: [],
      neutral: []
    };

    if (diff.security) {
      if (diff.security.fixed.length > 0) {
        summary.improvements.push(`Fixed ${diff.security.fixed.length} security vulnerabilities`);
      }
      if (diff.security.new.length > 0) {
        summary.regressions.push(`${diff.security.new.length} new security vulnerabilities`);
      }
    }

    if (diff.performance) {
      if (diff.performance.bundleSizeChange) {
        const change = parseFloat(diff.performance.bundleSizeChange);
        if (change < 0) {
          summary.improvements.push(`Bundle size reduced by ${Math.abs(change)} MB`);
        } else if (change > 0) {
          summary.regressions.push(`Bundle size increased by ${change} MB`);
        }
      }
    }

    if (diff.codeQuality) {
      if (diff.codeQuality.coverageChange) {
        if (diff.codeQuality.coverageChange > 0) {
          summary.improvements.push(`Coverage increased by ${diff.codeQuality.coverageChange}%`);
        } else if (diff.codeQuality.coverageChange < 0) {
          summary.regressions.push(`Coverage decreased by ${Math.abs(diff.codeQuality.coverageChange)}%`);
        }
      }
    }

    return summary;
  }
}

module.exports = AnalysisReportAggregator;