import { jest } from '@jest/globals';
import { SecurityAgent } from '../../../src/agents/SecurityAgent.js';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Mock child_process module
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, callback) => callback(null, { stdout: '', stderr: '' })),
}));

describe.skip('SecurityAgent', () => {
  let security;
  let mockFS;
  let mockExec;

  beforeEach(() => {
    security = new SecurityAgent();

    // Mock file system operations
    mockFS = {
      readFile: jest.spyOn(fs, 'readFile'),
      writeFile: jest.spyOn(fs, 'writeFile'),
      mkdir: jest.spyOn(fs, 'mkdir'),
      readdir: jest.spyOn(fs, 'readdir'),
      stat: jest.spyOn(fs, 'stat'),
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
      await security.initialize();

      expect(security.id).toBe('security');
      expect(security.name).toBe('SecurityAgent');
      expect(security.status).toBe('ready');
      expect(security.getCapabilities()).toContain('vulnerability-scanning');
      expect(security.getCapabilities()).toContain('sast-analysis');
      expect(security.getCapabilities()).toContain('dependency-audit');
      expect(security.getCapabilities()).toContain('secret-detection');
    });

    test('should load security rules on initialization', async () => {
      await security.initialize();

      const state = security.getState();
      expect(state.securityRules).toBeDefined();
      expect(state.vulnerabilityDatabase).toBeDefined();
    });
  });

  describe('Vulnerability Scanning', () => {
    test('should detect SQL injection vulnerabilities', async () => {
      await security.initialize();

      const vulnerableCode = `
        app.get('/user', (req, res) => {
          const userId = req.query.id;
          const query = "SELECT * FROM users WHERE id = " + userId;
          db.query(query, (err, results) => {
            res.json(results);
          });
        });
      `;

      mockFS.readFile.mockResolvedValueOnce(vulnerableCode);

      const result = await security.execute('scan-vulnerabilities', {
        filePath: 'api.js',
      });

      expect(result.success).toBe(true);
      expect(result.result.vulnerabilities).toBeDefined();
      expect(result.result.vulnerabilities).toContainEqual(
        expect.objectContaining({
          type: 'sql-injection',
          severity: 'high',
        })
      );
    });

    test('should detect XSS vulnerabilities', async () => {
      await security.initialize();

      const xssCode = `
        app.get('/search', (req, res) => {
          const searchTerm = req.query.q;
          res.send('<h1>Results for: ' + searchTerm + '</h1>');
        });

        function displayUserInput(input) {
          document.getElementById('output').innerHTML = input;
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(xssCode);

      const result = await security.execute('scan-vulnerabilities', {
        filePath: 'search.js',
      });

      expect(result.success).toBe(true);
      expect(result.result.vulnerabilities).toContainEqual(
        expect.objectContaining({
          type: 'xss',
          severity: 'high',
        })
      );
    });

    test('should detect path traversal vulnerabilities', async () => {
      await security.initialize();

      const pathTraversalCode = `
        app.get('/file', (req, res) => {
          const fileName = req.query.name;
          const filePath = path.join('./uploads/', fileName);
          res.sendFile(filePath);
        });
      `;

      mockFS.readFile.mockResolvedValueOnce(pathTraversalCode);

      const result = await security.execute('scan-vulnerabilities', {
        filePath: 'fileServer.js',
      });

      expect(result.success).toBe(true);
      expect(result.result.vulnerabilities).toContainEqual(
        expect.objectContaining({
          type: 'path-traversal',
          severity: 'high',
        })
      );
    });

    test('should detect command injection vulnerabilities', async () => {
      await security.initialize();

      const commandInjectionCode = `
        const { exec } = require('child_process');

        app.post('/ping', (req, res) => {
          const host = req.body.host;
          exec('ping -c 4 ' + host, (error, stdout) => {
            res.send(stdout);
          });
        });
      `;

      mockFS.readFile.mockResolvedValueOnce(commandInjectionCode);

      const result = await security.execute('scan-vulnerabilities', {
        filePath: 'network.js',
      });

      expect(result.success).toBe(true);
      expect(result.result.vulnerabilities).toContainEqual(
        expect.objectContaining({
          type: 'command-injection',
          severity: 'critical',
        })
      );
    });
  });

  describe('SAST Analysis', () => {
    test('should perform static application security testing', async () => {
      await security.initialize();

      const codeToAnalyze = `
        const crypto = require('crypto');

        function hashPassword(password) {
          return crypto.createHash('md5').update(password).digest('hex');
        }

        function generateToken() {
          return Math.random().toString(36);
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(codeToAnalyze);

      const result = await security.execute('sast-analysis', {
        filePath: 'auth.js',
      });

      expect(result.success).toBe(true);
      expect(result.result.issues).toBeDefined();
      expect(result.result.issues).toContainEqual(
        expect.objectContaining({
          type: 'weak-crypto',
          message: expect.stringContaining('MD5'),
        })
      );
      expect(result.result.issues).toContainEqual(
        expect.objectContaining({
          type: 'weak-random',
          message: expect.stringContaining('Math.random'),
        })
      );
    });

    test('should detect insecure configurations', async () => {
      await security.initialize();

      const configCode = `
        app.use(cors({
          origin: '*',
          credentials: true
        }));

        app.use(helmet({
          contentSecurityPolicy: false
        }));

        app.listen(3000, '0.0.0.0');
      `;

      mockFS.readFile.mockResolvedValueOnce(configCode);

      const result = await security.execute('sast-analysis', {
        filePath: 'server.js',
      });

      expect(result.success).toBe(true);
      expect(result.result.issues).toContainEqual(
        expect.objectContaining({
          type: 'insecure-cors',
        })
      );
      expect(result.result.issues).toContainEqual(
        expect.objectContaining({
          type: 'disabled-security-feature',
        })
      );
    });

    test('should integrate with ESLint security plugin', async () => {
      await security.initialize();

      const testCode = 'const eval = require("eval");';
      mockFS.readFile.mockResolvedValueOnce(testCode);

      // Mock ESLint execution
      mockExec.mockImplementation((cmd, callback) => {
        if (cmd.includes('eslint')) {
          const eslintOutput = JSON.stringify([
            {
              filePath: 'test.js',
              messages: [
                {
                  ruleId: 'security/detect-eval-with-expression',
                  severity: 2,
                  message: 'eval can be harmful',
                  line: 1,
                  column: 1,
                },
              ],
            },
          ]);
          callback(null, { stdout: eslintOutput, stderr: '' });
        }
      });

      const result = await security.execute('sast-analysis', {
        filePath: 'test.js',
        useESLint: true,
      });

      expect(result.success).toBe(true);
      expect(result.result.eslintIssues).toBeDefined();
    });
  });

  describe('Dependency Audit', () => {
    test('should audit npm dependencies', async () => {
      await security.initialize();

      const packageJson = JSON.stringify({
        dependencies: {
          express: '^4.17.1',
          lodash: '4.17.19',
          axios: '0.21.0',
        },
      });

      mockFS.readFile.mockResolvedValueOnce(packageJson);

      // Mock npm audit output
      mockExec.mockImplementation((cmd, callback) => {
        if (cmd.includes('npm audit')) {
          const auditOutput = JSON.stringify({
            vulnerabilities: {
              high: 1,
              moderate: 2,
              low: 1,
            },
            advisories: {
              1234: {
                module_name: 'lodash',
                severity: 'high',
                title: 'Prototype Pollution',
              },
            },
          });
          callback(null, { stdout: auditOutput, stderr: '' });
        }
      });

      const result = await security.execute('audit-dependencies', {
        directory: './',
      });

      expect(result.success).toBe(true);
      expect(result.result.summary).toBeDefined();
      expect(result.result.summary.high).toBeGreaterThan(0);
      expect(result.result.vulnerabilities).toBeDefined();
    });

    test('should check for outdated dependencies', async () => {
      await security.initialize();

      const packageJson = JSON.stringify({
        dependencies: {
          react: '^16.0.0',
          webpack: '^3.0.0',
        },
      });

      mockFS.readFile.mockResolvedValueOnce(packageJson);

      // Mock npm outdated
      mockExec.mockImplementation((cmd, callback) => {
        if (cmd.includes('npm outdated')) {
          const outdatedOutput = JSON.stringify([
            {
              name: 'react',
              current: '16.0.0',
              wanted: '16.14.0',
              latest: '18.2.0',
            },
          ]);
          callback(null, { stdout: outdatedOutput, stderr: '' });
        }
      });

      const result = await security.execute('audit-dependencies', {
        directory: './',
        checkOutdated: true,
      });

      expect(result.success).toBe(true);
      expect(result.result.outdated).toBeDefined();
      expect(result.result.outdated.length).toBeGreaterThan(0);
    });

    test('should detect known vulnerable versions', async () => {
      await security.initialize();

      const packageJson = JSON.stringify({
        dependencies: {
          minimist: '0.0.8',
          'serialize-javascript': '2.1.0',
        },
      });

      mockFS.readFile.mockResolvedValueOnce(packageJson);

      const result = await security.execute('audit-dependencies', {
        directory: './',
      });

      expect(result.success).toBe(true);
      expect(result.result.knownVulnerabilities).toBeDefined();
      expect(result.result.recommendations).toBeDefined();
    });
  });

  describe('Secret Detection', () => {
    test('should detect hardcoded API keys', async () => {
      await security.initialize();

      const codeWithSecrets = `
        const API_KEY = 'sk-1234567890abcdef1234567890abcdef';
        const AWS_ACCESS_KEY = 'AKIAIOSFODNN7EXAMPLE';
        const AWS_SECRET_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

        const config = {
          apiKey: 'AIzaSyDe2F4H5J6K7L8M9N0O1P2Q3R',
          password: 'admin123'
        };
      `;

      mockFS.readFile.mockResolvedValueOnce(codeWithSecrets);

      const result = await security.execute('detect-secrets', {
        filePath: 'config.js',
      });

      expect(result.success).toBe(true);
      expect(result.result.secrets).toBeDefined();
      expect(result.result.secrets.length).toBeGreaterThan(0);
      expect(result.result.secrets).toContainEqual(
        expect.objectContaining({
          type: 'api-key',
          severity: 'critical',
        })
      );
    });

    test('should detect private keys and certificates', async () => {
      await security.initialize();

      const privateKey = `
        -----BEGIN RSA PRIVATE KEY-----
        MIIEpAIBAAKCAQEA1234567890...
        -----END RSA PRIVATE KEY-----
      `;

      mockFS.readFile.mockResolvedValueOnce(privateKey);

      const result = await security.execute('detect-secrets', {
        filePath: 'key.pem',
      });

      expect(result.success).toBe(true);
      expect(result.result.secrets).toContainEqual(
        expect.objectContaining({
          type: 'private-key',
          severity: 'critical',
        })
      );
    });

    test('should detect database connection strings', async () => {
      await security.initialize();

      const configWithDB = `
        const dbUrl = 'mongodb://admin:password123@localhost:27017/mydb';
        const pgConnection = 'postgresql://user:pass@localhost/db';
        const mysql = 'mysql://root:toor@127.0.0.1:3306/database';
      `;

      mockFS.readFile.mockResolvedValueOnce(configWithDB);

      const result = await security.execute('detect-secrets', {
        filePath: 'database.js',
      });

      expect(result.success).toBe(true);
      expect(result.result.secrets).toContainEqual(
        expect.objectContaining({
          type: 'database-url',
          severity: 'high',
        })
      );
    });

    test('should scan entire project for secrets', async () => {
      await security.initialize();

      mockFS.readdir.mockResolvedValue(['file1.js', 'file2.js', '.env']);
      mockFS.stat.mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      });

      mockFS.readFile
        .mockResolvedValueOnce('const code = "safe";')
        .mockResolvedValueOnce('const token = "ghp_1234567890abcdef";')
        .mockResolvedValueOnce('API_KEY=secret123');

      const result = await security.execute('detect-secrets', {
        directory: './',
      });

      expect(result.success).toBe(true);
      expect(result.result.filesScanned).toBeGreaterThan(0);
      expect(result.result.totalSecrets).toBeGreaterThan(0);
    });
  });

  describe('Security Report Generation', () => {
    test('should generate comprehensive security report', async () => {
      await security.initialize();

      mockFS.readdir.mockResolvedValue(['src', 'tests']);
      mockFS.stat.mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
      });

      const result = await security.execute('generate-report', {
        directory: './',
        includeAll: true,
      });

      expect(result.success).toBe(true);
      expect(result.result.report).toBeDefined();
      expect(result.result.report.summary).toBeDefined();
      expect(result.result.report.vulnerabilities).toBeDefined();
      expect(result.result.report.recommendations).toBeDefined();
      expect(result.result.report.score).toBeDefined();
    });

    test('should calculate security score', async () => {
      await security.initialize();

      const metrics = {
        vulnerabilities: {
          critical: 0,
          high: 2,
          medium: 5,
          low: 10,
        },
        coverage: {
          sast: true,
          dependencies: true,
          secrets: false,
        },
      };

      const result = await security.execute('calculate-score', {
        metrics,
      });

      expect(result.success).toBe(true);
      expect(result.result.score).toBeDefined();
      expect(result.result.score).toBeGreaterThanOrEqual(0);
      expect(result.result.score).toBeLessThanOrEqual(100);
      expect(result.result.grade).toBeDefined();
    });
  });

  describe('Task Validation', () => {
    test('should only handle security tasks', async () => {
      await security.initialize();

      expect(security.canHandle('scan-vulnerabilities')).toBe(true);
      expect(security.canHandle('sast-analysis')).toBe(true);
      expect(security.canHandle('audit-dependencies')).toBe(true);
      expect(security.canHandle('detect-secrets')).toBe(true);
      expect(security.canHandle('generate-report')).toBe(true);
      expect(security.canHandle('invalid-task')).toBe(false);
    });
  });

  describe('State Management', () => {
    test('should maintain scan history', async () => {
      await security.initialize();

      const testCode = 'const password = "123456";';
      mockFS.readFile.mockResolvedValueOnce(testCode);

      await security.execute('detect-secrets', {
        filePath: 'test.js',
      });

      const state = security.getState();
      expect(state.scanHistory).toBeDefined();
      expect(state.scanHistory.length).toBeGreaterThan(0);
      expect(state.scanHistory[0]).toMatchObject({
        type: 'detect-secrets',
        file: 'test.js',
      });
    });

    test('should track vulnerability trends', async () => {
      await security.initialize();

      // Perform multiple scans
      const vulnerableCode = 'eval(userInput);';
      mockFS.readFile.mockResolvedValue(vulnerableCode);

      await security.execute('scan-vulnerabilities', { filePath: 'v1.js' });
      await security.execute('scan-vulnerabilities', { filePath: 'v2.js' });

      const state = security.getState();
      expect(state.vulnerabilityTrends).toBeDefined();
      expect(state.vulnerabilityTrends.length).toBeGreaterThan(0);
    });
  });
});
