import { SecurityScanner } from './SecurityScanner.js';
import { PerformanceProfiler } from './PerformanceProfiler.js';
import { CodeQualityAnalyzer } from './CodeQualityAnalyzer.js';
import { DependencyAnalyzer } from './DependencyAnalyzer.js';
import { AnalysisReportAggregator } from './AnalysisReportAggregator.js';
import { promises as fs } from 'fs';
import path from 'path';

class AdvancedAnalysisEngine {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.config = null;

    this.securityScanner = new SecurityScanner(projectPath);
    this.performanceProfiler = new PerformanceProfiler(projectPath);
    this.codeQualityAnalyzer = new CodeQualityAnalyzer(projectPath);
    this.dependencyAnalyzer = new DependencyAnalyzer(projectPath);
    this.reportAggregator = new AnalysisReportAggregator();
  }

  async loadConfiguration() {
    try {
      const configPath = path.join(this.projectPath, '.devflow', 'config.json');
      const configData = await fs.readFile(configPath, 'utf8');
      this.config = JSON.parse(configData);
      return this.config;
    } catch (error) {
      this.config = { analysis: { enabled: true } };
      return this.config;
    }
  }

  async runFullAnalysis() {
    const results = {};
    const analyzers = [
      { name: 'security', instance: this.securityScanner, method: 'scan' },
      { name: 'performance', instance: this.performanceProfiler, method: 'profile' },
      { name: 'codeQuality', instance: this.codeQualityAnalyzer, method: 'analyze' },
      { name: 'dependencies', instance: this.dependencyAnalyzer, method: 'analyze' },
    ];

    for (const analyzer of analyzers) {
      try {
        results[analyzer.name] = await analyzer.instance[analyzer.method]();
      } catch (error) {
        results[analyzer.name] = {
          error: error.message,
          status: 'failed',
        };
      }
    }

    const aggregatedReport = this.reportAggregator.aggregate(results);
    return aggregatedReport;
  }

  async runAnalysis(selectedAnalyzers = []) {
    if (!selectedAnalyzers || selectedAnalyzers.length === 0) {
      return this.runFullAnalysis();
    }

    const results = {};
    const analyzerMap = {
      security: { instance: this.securityScanner, method: 'scan' },
      performance: { instance: this.performanceProfiler, method: 'profile' },
      codeQuality: { instance: this.codeQualityAnalyzer, method: 'analyze' },
      dependencies: { instance: this.dependencyAnalyzer, method: 'analyze' },
    };

    for (const analyzerName of selectedAnalyzers) {
      if (analyzerMap[analyzerName]) {
        try {
          const analyzer = analyzerMap[analyzerName];
          results[analyzerName] = await analyzer.instance[analyzer.method]();
        } catch (error) {
          results[analyzerName] = {
            error: error.message,
            status: 'failed',
          };
        }
      }
    }

    const aggregatedReport = this.reportAggregator.aggregate(results);
    return aggregatedReport;
  }

  async exportReport(report, outputPath, format = 'json') {
    return this.reportAggregator.exportReport(report, outputPath, format);
  }

  async compareWithPreviousReport(currentReport, previousReportPath) {
    try {
      const previousData = await fs.readFile(previousReportPath, 'utf8');
      const previousReport = JSON.parse(previousData);
      return this.reportAggregator.compareReports(previousReport, currentReport);
    } catch (error) {
      return { error: 'Could not load previous report', message: error.message };
    }
  }
}

export { AdvancedAnalysisEngine };
export { SecurityScanner };
export { PerformanceProfiler };
export { CodeQualityAnalyzer };
export { DependencyAnalyzer };
export { AnalysisReportAggregator };
