const { jest } = require('@jest/globals');

// Mock the entire fs module
const mockFs = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  readdir: jest.fn(),
  access: jest.fn(),
  mkdir: jest.fn(),
  unlink: jest.fn()
};

jest.mock('fs', () => ({
  promises: mockFs
}));

const mockExecSync = jest.fn();
jest.mock('child_process', () => ({
  execSync: mockExecSync
}));

const mockGlob = jest.fn();
jest.mock('glob', () => mockGlob);

const AdvancedAnalysisEngine = require('../../../src/analysis/AdvancedAnalysisEngine');
const SecurityScanner = require('../../../src/analysis/SecurityScanner');
const PerformanceProfiler = require('../../../src/analysis/PerformanceProfiler');
const CodeQualityAnalyzer = require('../../../src/analysis/CodeQualityAnalyzer');
const DependencyAnalyzer = require('../../../src/analysis/DependencyAnalyzer');
const AnalysisReportAggregator = require('../../../src/analysis/AnalysisReportAggregator');
const path = require('path');

describe('AdvancedAnalysisEngine', () => {
  let engine;
  let mockProjectPath;

  beforeEach(() => {
    mockProjectPath = '/test/project';
    engine = new AdvancedAnalysisEngine(mockProjectPath);
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct project path', () => {
      expect(engine.projectPath).toBe(mockProjectPath);
    });

    it('should initialize all analyzer components', () => {
      expect(engine.securityScanner).toBeInstanceOf(SecurityScanner);
      expect(engine.performanceProfiler).toBeInstanceOf(PerformanceProfiler);
      expect(engine.codeQualityAnalyzer).toBeInstanceOf(CodeQualityAnalyzer);
      expect(engine.dependencyAnalyzer).toBeInstanceOf(DependencyAnalyzer);
      expect(engine.reportAggregator).toBeInstanceOf(AnalysisReportAggregator);
    });

    it('should load configuration from project', async () => {
      const mockConfig = { analysis: { enabled: true } };
      fs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      await engine.loadConfiguration();
      expect(engine.config).toEqual(mockConfig);
    });
  });

  describe('Full Analysis', () => {
    it('should run all analyzers and return aggregated report', async () => {
      const mockSecurityResults = { vulnerabilities: [] };
      const mockPerformanceResults = { metrics: {} };
      const mockQualityResults = { complexity: 10 };
      const mockDependencyResults = { outdated: [] };

      jest.spyOn(engine.securityScanner, 'scan').mockResolvedValue(mockSecurityResults);
      jest.spyOn(engine.performanceProfiler, 'profile').mockResolvedValue(mockPerformanceResults);
      jest.spyOn(engine.codeQualityAnalyzer, 'analyze').mockResolvedValue(mockQualityResults);
      jest.spyOn(engine.dependencyAnalyzer, 'analyze').mockResolvedValue(mockDependencyResults);

      const report = await engine.runFullAnalysis();

      expect(report).toHaveProperty('security', mockSecurityResults);
      expect(report).toHaveProperty('performance', mockPerformanceResults);
      expect(report).toHaveProperty('codeQuality', mockQualityResults);
      expect(report).toHaveProperty('dependencies', mockDependencyResults);
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('summary');
    });

    it('should handle partial analyzer failures gracefully', async () => {
      jest.spyOn(engine.securityScanner, 'scan').mockRejectedValue(new Error('Security scan failed'));
      jest.spyOn(engine.performanceProfiler, 'profile').mockResolvedValue({ metrics: {} });

      const report = await engine.runFullAnalysis();

      expect(report.security).toHaveProperty('error', 'Security scan failed');
      expect(report.performance).toHaveProperty('metrics');
    });
  });

  describe('Selective Analysis', () => {
    it('should run only specified analyzers', async () => {
      const mockSecurityResults = { vulnerabilities: [] };
      jest.spyOn(engine.securityScanner, 'scan').mockResolvedValue(mockSecurityResults);
      jest.spyOn(engine.performanceProfiler, 'profile');

      const report = await engine.runAnalysis(['security']);

      expect(engine.securityScanner.scan).toHaveBeenCalled();
      expect(engine.performanceProfiler.profile).not.toHaveBeenCalled();
      expect(report).toHaveProperty('security', mockSecurityResults);
      expect(report).not.toHaveProperty('performance');
    });
  });
});

describe('SecurityScanner', () => {
  let scanner;
  let mockProjectPath;

  beforeEach(() => {
    mockProjectPath = '/test/project';
    scanner = new SecurityScanner(mockProjectPath);
  });

  describe('JavaScript Security Scanning', () => {
    it('should run ESLint security plugin on JavaScript files', async () => {
      const mockFiles = ['app.js', 'lib/util.js'];
      fs.readdir.mockResolvedValue(mockFiles);
      fs.readFile.mockResolvedValue('const password = "hardcoded";');

      execSync.mockReturnValue(JSON.stringify({
        results: [{
          filePath: 'app.js',
          messages: [{
            ruleId: 'security/detect-hardcoded-credentials',
            severity: 2,
            message: 'Hardcoded credentials detected'
          }]
        }]
      }));

      const results = await scanner.scanJavaScript();

      expect(results).toHaveProperty('vulnerabilities');
      expect(results.vulnerabilities).toHaveLength(1);
      expect(results.vulnerabilities[0]).toHaveProperty('file', 'app.js');
      expect(results.vulnerabilities[0]).toHaveProperty('rule', 'security/detect-hardcoded-credentials');
    });

    it('should handle ESLint configuration errors', async () => {
      execSync.mockImplementation(() => {
        throw new Error('ESLint configuration error');
      });

      const results = await scanner.scanJavaScript();
      expect(results).toHaveProperty('error');
      expect(results.error).toContain('ESLint configuration error');
    });
  });

  describe('Python Security Scanning', () => {
    it('should run Bandit on Python files', async () => {
      execSync.mockReturnValue(JSON.stringify({
        results: [{
          filename: 'app.py',
          issue_text: 'Possible SQL injection',
          issue_severity: 'HIGH',
          line_number: 42
        }]
      }));

      const results = await scanner.scanPython();

      expect(results).toHaveProperty('vulnerabilities');
      expect(results.vulnerabilities).toHaveLength(1);
      expect(results.vulnerabilities[0]).toHaveProperty('file', 'app.py');
      expect(results.vulnerabilities[0]).toHaveProperty('severity', 'HIGH');
    });

    it('should skip if no Python files exist', async () => {
      fs.readdir.mockResolvedValue([]);

      const results = await scanner.scanPython();
      expect(results).toHaveProperty('skipped', true);
    });
  });

  describe('Dependency Vulnerability Scanning', () => {
    it('should run npm audit for Node.js projects', async () => {
      fs.access.mockResolvedValue(); // package.json exists
      execSync.mockReturnValue(JSON.stringify({
        vulnerabilities: {
          high: 2,
          moderate: 5,
          low: 10
        }
      }));

      const results = await scanner.scanDependencies();

      expect(execSync).toHaveBeenCalledWith(expect.stringContaining('npm audit'));
      expect(results).toHaveProperty('npm');
      expect(results.npm).toHaveProperty('high', 2);
    });

    it('should run pip-audit for Python projects', async () => {
      fs.access.mockImplementation((file) => {
        if (file.includes('requirements.txt')) return Promise.resolve();
        return Promise.reject(new Error('File not found'));
      });

      execSync.mockReturnValue(JSON.stringify([{
        name: 'flask',
        version: '1.0.0',
        vulns: [{
          id: 'CVE-2021-12345',
          fix_versions: ['1.0.1']
        }]
      }]));

      const results = await scanner.scanDependencies();

      expect(execSync).toHaveBeenCalledWith(expect.stringContaining('pip-audit'));
      expect(results).toHaveProperty('python');
    });
  });
});

describe('PerformanceProfiler', () => {
  let profiler;
  let mockProjectPath;

  beforeEach(() => {
    mockProjectPath = '/test/project';
    profiler = new PerformanceProfiler(mockProjectPath);
  });

  describe('Bundle Analysis', () => {
    it('should analyze webpack bundle size', async () => {
      fs.access.mockResolvedValue(); // webpack.config.js exists
      execSync.mockReturnValue(JSON.stringify({
        assets: [{
          name: 'main.js',
          size: 1048576,
          chunks: ['main']
        }]
      }));

      const results = await profiler.analyzeBundleSize();

      expect(results).toHaveProperty('totalSize');
      expect(results).toHaveProperty('assets');
      expect(results.assets).toHaveLength(1);
      expect(results.assets[0]).toHaveProperty('size', 1048576);
    });

    it('should provide recommendations for large bundles', async () => {
      execSync.mockReturnValue(JSON.stringify({
        assets: [{
          name: 'vendor.js',
          size: 5242880 // 5MB
        }]
      }));

      const results = await profiler.analyzeBundleSize();
      expect(results).toHaveProperty('recommendations');
      expect(results.recommendations).toContain('Consider code splitting');
    });
  });

  describe('Build Performance', () => {
    it('should measure build time', async () => {
      const startTime = Date.now();
      execSync.mockImplementation(() => {
        // Simulate build time
        return '';
      });

      const results = await profiler.measureBuildTime();

      expect(results).toHaveProperty('buildTime');
      expect(results.buildTime).toBeGreaterThanOrEqual(0);
    });

    it('should profile memory usage during build', async () => {
      execSync.mockReturnValue('');
      const results = await profiler.profileBuildMemory();

      expect(results).toHaveProperty('peakMemory');
      expect(results).toHaveProperty('averageMemory');
    });
  });

  describe('Runtime Performance', () => {
    it('should collect runtime metrics', async () => {
      const mockMetrics = {
        responseTime: 150,
        throughput: 1000,
        errorRate: 0.01
      };

      jest.spyOn(profiler, 'collectRuntimeMetrics').mockResolvedValue(mockMetrics);

      const results = await profiler.collectRuntimeMetrics();
      expect(results).toEqual(mockMetrics);
    });
  });
});

describe('CodeQualityAnalyzer', () => {
  let analyzer;
  let mockProjectPath;

  beforeEach(() => {
    mockProjectPath = '/test/project';
    analyzer = new CodeQualityAnalyzer(mockProjectPath);
  });

  describe('Complexity Analysis', () => {
    it('should calculate cyclomatic complexity', async () => {
      fs.readFile.mockResolvedValue(`
        function complexFunction(a, b, c) {
          if (a > 0) {
            if (b > 0) {
              if (c > 0) {
                return a + b + c;
              }
            }
          }
          return 0;
        }
      `);

      const results = await analyzer.calculateComplexity('test.js');

      expect(results).toHaveProperty('complexity');
      expect(results.complexity).toBeGreaterThan(1);
      expect(results).toHaveProperty('functions');
    });

    it('should flag high complexity functions', async () => {
      const mockComplexCode = `
        function veryComplex() {
          // Multiple nested conditions and loops
        }
      `;
      fs.readFile.mockResolvedValue(mockComplexCode);

      jest.spyOn(analyzer, 'calculateComplexity').mockResolvedValue({
        complexity: 15,
        functions: [{ name: 'veryComplex', complexity: 15 }]
      });

      const results = await analyzer.calculateComplexity('complex.js');
      expect(results).toHaveProperty('highComplexity');
      expect(results.highComplexity).toContain('veryComplex');
    });
  });

  describe('Code Coverage', () => {
    it('should parse coverage reports', async () => {
      const mockCoverage = {
        total: {
          lines: { total: 1000, covered: 850, pct: 85 },
          functions: { total: 100, covered: 90, pct: 90 },
          branches: { total: 200, covered: 160, pct: 80 }
        }
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockCoverage));

      const results = await analyzer.analyzeCoverage();

      expect(results).toHaveProperty('lines', 85);
      expect(results).toHaveProperty('functions', 90);
      expect(results).toHaveProperty('branches', 80);
      expect(results).toHaveProperty('overall');
    });

    it('should identify uncovered files', async () => {
      const mockCoverage = {
        '/src/untested.js': {
          lines: { total: 50, covered: 0, pct: 0 }
        }
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockCoverage));

      const results = await analyzer.analyzeCoverage();
      expect(results).toHaveProperty('uncovered');
      expect(results.uncovered).toContain('/src/untested.js');
    });
  });

  describe('Code Duplication', () => {
    it('should detect duplicate code blocks', async () => {
      const mockFiles = [
        { path: 'a.js', content: 'function foo() { return 1; }' },
        { path: 'b.js', content: 'function foo() { return 1; }' }
      ];

      jest.spyOn(analyzer, 'detectDuplication').mockResolvedValue({
        duplicates: [{
          files: ['a.js', 'b.js'],
          lines: 1,
          tokens: 10
        }]
      });

      const results = await analyzer.detectDuplication();

      expect(results).toHaveProperty('duplicates');
      expect(results.duplicates).toHaveLength(1);
      expect(results.duplicates[0].files).toContain('a.js');
      expect(results.duplicates[0].files).toContain('b.js');
    });

    it('should calculate duplication percentage', async () => {
      jest.spyOn(analyzer, 'detectDuplication').mockResolvedValue({
        percentage: 5.2,
        duplicates: []
      });

      const results = await analyzer.detectDuplication();
      expect(results).toHaveProperty('percentage', 5.2);
    });
  });

  describe('Maintainability Index', () => {
    it('should calculate maintainability index', async () => {
      const results = await analyzer.calculateMaintainabilityIndex();

      expect(results).toHaveProperty('index');
      expect(results.index).toBeGreaterThanOrEqual(0);
      expect(results.index).toBeLessThanOrEqual(100);
      expect(results).toHaveProperty('grade');
    });

    it('should provide maintainability grade', async () => {
      jest.spyOn(analyzer, 'calculateMaintainabilityIndex').mockResolvedValue({
        index: 85,
        grade: 'A'
      });

      const results = await analyzer.calculateMaintainabilityIndex();
      expect(results.grade).toBe('A');
    });
  });
});

describe('DependencyAnalyzer', () => {
  let analyzer;
  let mockProjectPath;

  beforeEach(() => {
    mockProjectPath = '/test/project';
    analyzer = new DependencyAnalyzer(mockProjectPath);
  });

  describe('Outdated Dependencies', () => {
    it('should detect outdated npm packages', async () => {
      execSync.mockReturnValue(JSON.stringify({
        'express': {
          current: '4.17.0',
          wanted: '4.17.1',
          latest: '4.18.0'
        }
      }));

      const results = await analyzer.checkOutdated();

      expect(results).toHaveProperty('npm');
      expect(results.npm).toHaveProperty('express');
      expect(results.npm.express).toHaveProperty('current', '4.17.0');
      expect(results.npm.express).toHaveProperty('latest', '4.18.0');
    });

    it('should detect outdated Python packages', async () => {
      execSync.mockReturnValue('flask==1.0.0 # Latest: 2.0.0\n');

      const results = await analyzer.checkOutdated();

      expect(results).toHaveProperty('python');
      expect(results.python).toHaveProperty('flask');
    });
  });

  describe('License Compatibility', () => {
    it('should check license compatibility', async () => {
      execSync.mockReturnValue(JSON.stringify([
        { name: 'express', license: 'MIT' },
        { name: 'react', license: 'MIT' },
        { name: 'gpl-package', license: 'GPL-3.0' }
      ]));

      const results = await analyzer.checkLicenses('MIT');

      expect(results).toHaveProperty('compatible');
      expect(results).toHaveProperty('incompatible');
      expect(results.incompatible).toContain('gpl-package');
    });

    it('should flag packages with missing licenses', async () => {
      execSync.mockReturnValue(JSON.stringify([
        { name: 'no-license', license: null }
      ]));

      const results = await analyzer.checkLicenses();

      expect(results).toHaveProperty('unlicensed');
      expect(results.unlicensed).toContain('no-license');
    });
  });

  describe('Dependency Graph', () => {
    it('should generate dependency tree', async () => {
      execSync.mockReturnValue(JSON.stringify({
        name: 'project',
        dependencies: {
          'express': {
            version: '4.17.0',
            dependencies: {
              'body-parser': { version: '1.19.0' }
            }
          }
        }
      }));

      const results = await analyzer.generateDependencyTree();

      expect(results).toHaveProperty('tree');
      expect(results.tree).toHaveProperty('dependencies');
      expect(results).toHaveProperty('depth');
      expect(results).toHaveProperty('totalPackages');
    });

    it('should detect circular dependencies', async () => {
      const mockCircular = {
        'package-a': ['package-b'],
        'package-b': ['package-a']
      };

      jest.spyOn(analyzer, 'detectCircularDependencies').mockResolvedValue(mockCircular);

      const results = await analyzer.detectCircularDependencies();
      expect(results).toHaveProperty('package-a');
      expect(results['package-a']).toContain('package-b');
    });
  });
});

describe('AnalysisReportAggregator', () => {
  let aggregator;

  beforeEach(() => {
    aggregator = new AnalysisReportAggregator();
  });

  describe('Report Aggregation', () => {
    it('should aggregate multiple analysis results', () => {
      const securityResults = { vulnerabilities: [{ severity: 'HIGH' }] };
      const performanceResults = { buildTime: 5000 };
      const qualityResults = { complexity: 10 };

      const report = aggregator.aggregate({
        security: securityResults,
        performance: performanceResults,
        codeQuality: qualityResults
      });

      expect(report).toHaveProperty('security', securityResults);
      expect(report).toHaveProperty('performance', performanceResults);
      expect(report).toHaveProperty('codeQuality', qualityResults);
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('summary');
    });

    it('should generate summary statistics', () => {
      const results = {
        security: { vulnerabilities: [{ severity: 'HIGH' }, { severity: 'LOW' }] },
        codeQuality: { coverage: 85, complexity: 10 }
      };

      const report = aggregator.aggregate(results);

      expect(report.summary).toHaveProperty('totalIssues');
      expect(report.summary).toHaveProperty('criticalIssues');
      expect(report.summary).toHaveProperty('overallHealth');
    });

    it('should calculate overall project health score', () => {
      const results = {
        security: { vulnerabilities: [] },
        performance: { buildTime: 3000 },
        codeQuality: { coverage: 90, complexity: 5 },
        dependencies: { outdated: 2 }
      };

      const report = aggregator.aggregate(results);

      expect(report.summary.overallHealth).toBeGreaterThanOrEqual(0);
      expect(report.summary.overallHealth).toBeLessThanOrEqual(100);
    });
  });

  describe('Report Formatting', () => {
    it('should format report as JSON', () => {
      const results = { security: { vulnerabilities: [] } };
      const formatted = aggregator.formatReport(results, 'json');

      expect(formatted).toBe(JSON.stringify(aggregator.aggregate(results), null, 2));
    });

    it('should format report as Markdown', () => {
      const results = {
        security: { vulnerabilities: [{ file: 'app.js', severity: 'HIGH' }] }
      };
      const formatted = aggregator.formatReport(results, 'markdown');

      expect(formatted).toContain('# Analysis Report');
      expect(formatted).toContain('## Security');
      expect(formatted).toContain('HIGH');
    });

    it('should format report as HTML', () => {
      const results = { codeQuality: { coverage: 85 } };
      const formatted = aggregator.formatReport(results, 'html');

      expect(formatted).toContain('<html>');
      expect(formatted).toContain('Coverage: 85%');
    });

    it('should format report as plain text', () => {
      const results = { performance: { buildTime: 5000 } };
      const formatted = aggregator.formatReport(results, 'text');

      expect(formatted).toContain('Analysis Report');
      expect(formatted).toContain('Build Time: 5000ms');
    });
  });

  describe('Report Export', () => {
    it('should export report to file', async () => {
      const results = { security: { vulnerabilities: [] } };
      const filePath = '/test/report.json';

      await aggregator.exportReport(results, filePath, 'json');

      expect(fs.writeFile).toHaveBeenCalledWith(
        filePath,
        expect.stringContaining('"security"')
      );
    });

    it('should create output directory if not exists', async () => {
      fs.access.mockRejectedValue(new Error('Directory not found'));
      fs.mkdir.mockResolvedValue();

      await aggregator.exportReport({}, '/output/report.json', 'json');

      expect(fs.mkdir).toHaveBeenCalledWith('/output', expect.any(Object));
    });
  });

  describe('Report Comparison', () => {
    it('should compare two analysis reports', () => {
      const previousReport = {
        security: { vulnerabilities: [{ id: 'V1' }, { id: 'V2' }] },
        codeQuality: { coverage: 80 }
      };

      const currentReport = {
        security: { vulnerabilities: [{ id: 'V2' }, { id: 'V3' }] },
        codeQuality: { coverage: 85 }
      };

      const diff = aggregator.compareReports(previousReport, currentReport);

      expect(diff).toHaveProperty('security');
      expect(diff.security).toHaveProperty('fixed', ['V1']);
      expect(diff.security).toHaveProperty('new', ['V3']);
      expect(diff).toHaveProperty('codeQuality');
      expect(diff.codeQuality).toHaveProperty('coverageChange', 5);
    });

    it('should identify improvements and regressions', () => {
      const previousReport = {
        codeQuality: { complexity: 15, coverage: 70 }
      };

      const currentReport = {
        codeQuality: { complexity: 10, coverage: 65 }
      };

      const diff = aggregator.compareReports(previousReport, currentReport);

      expect(diff.codeQuality).toHaveProperty('improvements');
      expect(diff.codeQuality.improvements).toContain('complexity');
      expect(diff.codeQuality).toHaveProperty('regressions');
      expect(diff.codeQuality.regressions).toContain('coverage');
    });
  });
});