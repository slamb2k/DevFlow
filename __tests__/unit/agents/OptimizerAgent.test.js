import { jest } from '@jest/globals';
import { OptimizerAgent } from '../../../src/agents/OptimizerAgent.js';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Mock child_process module
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, callback) => callback(null, { stdout: '', stderr: '' }))
}));

describe('OptimizerAgent', () => {
  let optimizer;
  let mockFS;
  let mockExec;

  beforeEach(() => {
    optimizer = new OptimizerAgent();

    // Mock file system operations
    mockFS = {
      readFile: jest.spyOn(fs, 'readFile'),
      writeFile: jest.spyOn(fs, 'writeFile'),
      mkdir: jest.spyOn(fs, 'mkdir'),
      readdir: jest.spyOn(fs, 'readdir'),
      stat: jest.spyOn(fs, 'stat')
    };

    // Mock exec for external tools
    mockExec = exec;

    // Mock successful state operations
    mockFS.readFile.mockRejectedValue({ code: 'ENOENT' });
    mockFS.writeFile.mockResolvedValue();
    mockFS.mkdir.mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with correct properties', async () => {
      await optimizer.initialize();

      expect(optimizer.id).toBe('optimizer');
      expect(optimizer.name).toBe('OptimizerAgent');
      expect(optimizer.status).toBe('ready');
      expect(optimizer.getCapabilities()).toContain('performance-profiling');
      expect(optimizer.getCapabilities()).toContain('bundle-analysis');
      expect(optimizer.getCapabilities()).toContain('bottleneck-detection');
      expect(optimizer.getCapabilities()).toContain('optimization-suggestions');
    });

    test('should load optimization rules on initialization', async () => {
      await optimizer.initialize();

      const state = optimizer.getState();
      expect(state.optimizationRules).toBeDefined();
      expect(state.performanceBaseline).toBeDefined();
    });
  });

  describe('Performance Profiling', () => {
    test('should profile JavaScript code performance', async () => {
      await optimizer.initialize();

      const codeToProfile = `
        function fibonacci(n) {
          if (n <= 1) return n;
          return fibonacci(n - 1) + fibonacci(n - 2);
        }

        function optimizedFibonacci(n, memo = {}) {
          if (n in memo) return memo[n];
          if (n <= 1) return n;
          memo[n] = optimizedFibonacci(n - 1, memo) + optimizedFibonacci(n - 2, memo);
          return memo[n];
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(codeToProfile);

      const result = await optimizer.execute('profile-performance', {
        filePath: 'fibonacci.js'
      });

      expect(result.success).toBe(true);
      expect(result.result.profile).toBeDefined();
      expect(result.result.functions).toBeDefined();
      expect(result.result.functions).toHaveProperty('fibonacci');
      expect(result.result.functions).toHaveProperty('optimizedFibonacci');
      expect(result.result.recommendations).toBeDefined();
    });

    test('should detect performance bottlenecks', async () => {
      await optimizer.initialize();

      const inefficientCode = `
        function processData(data) {
          let result = [];
          for (let i = 0; i < data.length; i++) {
            for (let j = 0; j < data.length; j++) {
              if (data[i] === data[j] && i !== j) {
                result.push(data[i]);
              }
            }
          }
          return result;
        }

        function searchInArray(arr, target) {
          for (let i = 0; i < arr.length; i++) {
            if (arr[i] === target) {
              return i;
            }
          }
          return -1;
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(inefficientCode);

      const result = await optimizer.execute('profile-performance', {
        filePath: 'inefficient.js'
      });

      expect(result.success).toBe(true);
      expect(result.result.bottlenecks).toBeDefined();
      expect(result.result.bottlenecks).toContainEqual(
        expect.objectContaining({
          type: 'nested-loops',
          complexity: 'O(n²)'
        })
      );
    });

    test('should analyze async performance patterns', async () => {
      await optimizer.initialize();

      const asyncCode = `
        async function fetchDataSequential(ids) {
          const results = [];
          for (const id of ids) {
            const data = await fetchById(id);
            results.push(data);
          }
          return results;
        }

        async function fetchDataParallel(ids) {
          return Promise.all(ids.map(id => fetchById(id)));
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(asyncCode);

      const result = await optimizer.execute('profile-performance', {
        filePath: 'async.js'
      });

      expect(result.success).toBe(true);
      expect(result.result.asyncPatterns).toBeDefined();
      expect(result.result.asyncPatterns).toContainEqual(
        expect.objectContaining({
          pattern: 'sequential-awaits',
          recommendation: 'Use Promise.all for parallel execution'
        })
      );
    });

    test('should detect memory leaks patterns', async () => {
      await optimizer.initialize();

      const leakyCode = `
        let cache = {};

        function addToCache(key, value) {
          cache[key] = value;
        }

        class EventManager {
          constructor() {
            this.listeners = [];
          }

          addEventListener(callback) {
            this.listeners.push(callback);
            // Missing removeEventListener
          }
        }

        setInterval(() => {
          const data = new Array(1000000).fill('data');
          // No cleanup
        }, 1000);
      `;

      mockFS.readFile.mockResolvedValueOnce(leakyCode);

      const result = await optimizer.execute('profile-performance', {
        filePath: 'leaky.js'
      });

      expect(result.success).toBe(true);
      expect(result.result.memoryIssues).toBeDefined();
      expect(result.result.memoryIssues).toContainEqual(
        expect.objectContaining({
          type: 'unbounded-cache'
        })
      );
      expect(result.result.memoryIssues).toContainEqual(
        expect.objectContaining({
          type: 'missing-cleanup'
        })
      );
    });
  });

  describe('Bundle Analysis', () => {
    test('should analyze webpack bundle', async () => {
      await optimizer.initialize();

      // Mock webpack stats
      const webpackStats = JSON.stringify({
        assets: [
          { name: 'main.js', size: 500000 },
          { name: 'vendor.js', size: 800000 },
          { name: 'styles.css', size: 50000 }
        ],
        modules: [
          { name: 'lodash', size: 200000 },
          { name: 'moment', size: 300000 },
          { name: './src/index.js', size: 5000 }
        ]
      });

      mockFS.readFile.mockResolvedValueOnce(webpackStats);

      const result = await optimizer.execute('analyze-bundle', {
        statsFile: 'webpack-stats.json'
      });

      expect(result.success).toBe(true);
      expect(result.result.totalSize).toBeGreaterThan(0);
      expect(result.result.assets).toBeDefined();
      expect(result.result.largestModules).toBeDefined();
      expect(result.result.recommendations).toBeDefined();
    });

    test('should detect large dependencies', async () => {
      await optimizer.initialize();

      const packageJson = JSON.stringify({
        dependencies: {
          'moment': '^2.29.0',
          'lodash': '^4.17.21',
          'antd': '^5.0.0'
        }
      });

      mockFS.readFile.mockResolvedValueOnce(packageJson);

      // Mock node_modules size check
      mockExec.mockImplementation((cmd, callback) => {
        if (cmd.includes('du -s')) {
          callback(null, {
            stdout: '300000\tnode_modules/moment\n250000\tnode_modules/lodash\n500000\tnode_modules/antd',
            stderr: ''
          });
        }
      });

      const result = await optimizer.execute('analyze-bundle', {
        directory: './'
      });

      expect(result.success).toBe(true);
      expect(result.result.largeDependencies).toBeDefined();
      expect(result.result.alternatives).toBeDefined();
      expect(result.result.alternatives).toMatchObject({
        'moment': expect.arrayContaining(['date-fns', 'dayjs'])
      });
    });

    test('should analyze code splitting opportunities', async () => {
      await optimizer.initialize();

      const routerCode = `
        import Home from './pages/Home';
        import About from './pages/About';
        import Dashboard from './pages/Dashboard';
        import Settings from './pages/Settings';

        const routes = [
          { path: '/', component: Home },
          { path: '/about', component: About },
          { path: '/dashboard', component: Dashboard },
          { path: '/settings', component: Settings }
        ];
      `;

      mockFS.readFile.mockResolvedValueOnce(routerCode);

      const result = await optimizer.execute('analyze-bundle', {
        filePath: 'router.js'
      });

      expect(result.success).toBe(true);
      expect(result.result.codeSplitting).toBeDefined();
      expect(result.result.codeSplitting.opportunities).toBeGreaterThan(0);
      expect(result.result.codeSplitting.suggestions).toContain('lazy-loading');
    });

    test('should detect duplicate dependencies', async () => {
      await optimizer.initialize();

      // Mock package-lock.json with duplicates
      const packageLock = JSON.stringify({
        dependencies: {
          'package-a': {
            version: '1.0.0',
            requires: { 'lodash': '^4.0.0' }
          },
          'package-b': {
            version: '2.0.0',
            requires: { 'lodash': '^3.0.0' }
          }
        }
      });

      mockFS.readFile.mockResolvedValueOnce(packageLock);

      const result = await optimizer.execute('analyze-bundle', {
        lockFile: 'package-lock.json'
      });

      expect(result.success).toBe(true);
      expect(result.result.duplicates).toBeDefined();
      expect(result.result.duplicates.length).toBeGreaterThan(0);
    });
  });

  describe('Bottleneck Detection', () => {
    test('should detect database query bottlenecks', async () => {
      await optimizer.initialize();

      const dbCode = `
        async function getUsers() {
          const users = await db.query('SELECT * FROM users');
          for (const user of users) {
            user.posts = await db.query('SELECT * FROM posts WHERE user_id = ?', user.id);
            user.comments = await db.query('SELECT * FROM comments WHERE user_id = ?', user.id);
          }
          return users;
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(dbCode);

      const result = await optimizer.execute('detect-bottlenecks', {
        filePath: 'database.js'
      });

      expect(result.success).toBe(true);
      expect(result.result.bottlenecks).toContainEqual(
        expect.objectContaining({
          type: 'n+1-query',
          severity: 'high'
        })
      );
    });

    test('should detect rendering bottlenecks', async () => {
      await optimizer.initialize();

      const reactCode = `
        function ExpensiveComponent({ data }) {
          const processedData = data.map(item => {
            // Complex calculation
            return heavyComputation(item);
          });

          return (
            <div>
              {processedData.map(item => (
                <ChildComponent key={item.id} {...item} />
              ))}
            </div>
          );
        }

        function ListComponent({ items }) {
          return items.map(item => <div key={Math.random()}>{item}</div>);
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(reactCode);

      const result = await optimizer.execute('detect-bottlenecks', {
        filePath: 'components.jsx'
      });

      expect(result.success).toBe(true);
      expect(result.result.bottlenecks).toContainEqual(
        expect.objectContaining({
          type: 'missing-memoization'
        })
      );
      expect(result.result.bottlenecks).toContainEqual(
        expect.objectContaining({
          type: 'unstable-keys'
        })
      );
    });

    test('should detect API call bottlenecks', async () => {
      await optimizer.initialize();

      const apiCode = `
        async function loadDashboard() {
          const user = await fetch('/api/user');
          const settings = await fetch('/api/settings');
          const notifications = await fetch('/api/notifications');
          const stats = await fetch('/api/stats');

          return { user, settings, notifications, stats };
        }

        function pollStatus() {
          setInterval(() => {
            fetch('/api/status');
          }, 100); // Too frequent
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(apiCode);

      const result = await optimizer.execute('detect-bottlenecks', {
        filePath: 'api.js'
      });

      expect(result.success).toBe(true);
      expect(result.result.bottlenecks).toContainEqual(
        expect.objectContaining({
          type: 'waterfall-requests'
        })
      );
      expect(result.result.bottlenecks).toContainEqual(
        expect.objectContaining({
          type: 'excessive-polling'
        })
      );
    });
  });

  describe('Optimization Suggestions', () => {
    test('should suggest algorithm optimizations', async () => {
      await optimizer.initialize();

      const suboptimalCode = `
        function findDuplicates(arr) {
          const duplicates = [];
          for (let i = 0; i < arr.length; i++) {
            for (let j = i + 1; j < arr.length; j++) {
              if (arr[i] === arr[j] && !duplicates.includes(arr[i])) {
                duplicates.push(arr[i]);
              }
            }
          }
          return duplicates;
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(suboptimalCode);

      const result = await optimizer.execute('suggest-optimizations', {
        filePath: 'algorithms.js'
      });

      expect(result.success).toBe(true);
      expect(result.result.suggestions).toBeDefined();
      expect(result.result.suggestions).toContainEqual(
        expect.objectContaining({
          type: 'algorithm',
          current: 'O(n²)',
          suggested: 'O(n)',
          implementation: expect.stringContaining('Set')
        })
      );
    });

    test('should suggest caching strategies', async () => {
      await optimizer.initialize();

      const uncachedCode = `
        async function getUserData(userId) {
          const user = await db.query('SELECT * FROM users WHERE id = ?', userId);
          const permissions = await calculatePermissions(user);
          return { user, permissions };
        }

        function expensiveCalculation(input) {
          // Complex computation
          return result;
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(uncachedCode);

      const result = await optimizer.execute('suggest-optimizations', {
        filePath: 'uncached.js'
      });

      expect(result.success).toBe(true);
      expect(result.result.suggestions).toContainEqual(
        expect.objectContaining({
          type: 'caching',
          strategy: 'memoization'
        })
      );
    });

    test('should suggest lazy loading', async () => {
      await optimizer.initialize();

      const eagerCode = `
        import HeavyComponent from './HeavyComponent';
        import ChartLibrary from 'chart-library';
        import * as utils from './utils';

        function App() {
          const showChart = false;

          return (
            <div>
              {showChart && <ChartLibrary />}
            </div>
          );
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(eagerCode);

      const result = await optimizer.execute('suggest-optimizations', {
        filePath: 'app.js'
      });

      expect(result.success).toBe(true);
      expect(result.result.suggestions).toContainEqual(
        expect.objectContaining({
          type: 'lazy-loading',
          target: 'ChartLibrary'
        })
      );
    });

    test('should generate optimization report', async () => {
      await optimizer.initialize();

      mockFS.readdir.mockResolvedValue(['src', 'components']);
      mockFS.stat.mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false
      });

      const result = await optimizer.execute('generate-report', {
        directory: './',
        comprehensive: true
      });

      expect(result.success).toBe(true);
      expect(result.result.report).toBeDefined();
      expect(result.result.report.summary).toBeDefined();
      expect(result.result.report.score).toBeDefined();
      expect(result.result.report.topIssues).toBeDefined();
      expect(result.result.report.actionItems).toBeDefined();
    });
  });

  describe('Performance Metrics', () => {
    test('should calculate performance metrics', async () => {
      await optimizer.initialize();

      const metrics = {
        loadTime: 2500,
        firstContentfulPaint: 1200,
        timeToInteractive: 3500,
        bundleSize: 1500000,
        cacheHitRate: 0.75
      };

      const result = await optimizer.execute('calculate-metrics', {
        metrics
      });

      expect(result.success).toBe(true);
      expect(result.result.score).toBeDefined();
      expect(result.result.grade).toBeDefined();
      expect(result.result.areas).toBeDefined();
    });

    test('should track performance trends', async () => {
      await optimizer.initialize();

      // Simulate multiple performance measurements
      await optimizer.execute('track-performance', {
        metrics: { loadTime: 3000, bundleSize: 1600000 }
      });

      await optimizer.execute('track-performance', {
        metrics: { loadTime: 2800, bundleSize: 1550000 }
      });

      const state = optimizer.getState();
      expect(state.performanceTrends).toBeDefined();
      expect(state.performanceTrends.length).toBe(2);
      expect(state.improvement).toBeDefined();
    });
  });

  describe('Task Validation', () => {
    test('should only handle optimization tasks', async () => {
      await optimizer.initialize();

      expect(optimizer.canHandle('profile-performance')).toBe(true);
      expect(optimizer.canHandle('analyze-bundle')).toBe(true);
      expect(optimizer.canHandle('detect-bottlenecks')).toBe(true);
      expect(optimizer.canHandle('suggest-optimizations')).toBe(true);
      expect(optimizer.canHandle('generate-report')).toBe(true);
      expect(optimizer.canHandle('invalid-task')).toBe(false);
    });
  });

  describe('State Management', () => {
    test('should maintain optimization history', async () => {
      await optimizer.initialize();

      const testCode = 'function test() { return true; }';
      mockFS.readFile.mockResolvedValueOnce(testCode);

      await optimizer.execute('profile-performance', {
        filePath: 'test.js'
      });

      const state = optimizer.getState();
      expect(state.optimizationHistory).toBeDefined();
      expect(state.optimizationHistory.length).toBeGreaterThan(0);
    });

    test('should cache analysis results', async () => {
      await optimizer.initialize();

      const testCode = 'const x = 1;';
      mockFS.readFile.mockResolvedValueOnce(testCode);

      // First analysis
      await optimizer.execute('profile-performance', {
        filePath: 'cached.js',
        useCache: true
      });

      // Second analysis should use cache
      const result = await optimizer.execute('profile-performance', {
        filePath: 'cached.js',
        useCache: true
      });

      expect(result.result.cached).toBe(true);
    });
  });
});