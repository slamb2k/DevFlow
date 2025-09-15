import { jest } from '@jest/globals';
import { AnalyzerAgent } from '../../../src/agents/AnalyzerAgent.js';
import fs from 'fs/promises';
import path from 'path';

describe('AnalyzerAgent', () => {
  let analyzer;
  let mockFS;

  beforeEach(() => {
    analyzer = new AnalyzerAgent();

    // Mock file system operations
    mockFS = {
      readFile: jest.spyOn(fs, 'readFile'),
      writeFile: jest.spyOn(fs, 'writeFile'),
      mkdir: jest.spyOn(fs, 'mkdir'),
      readdir: jest.spyOn(fs, 'readdir'),
      stat: jest.spyOn(fs, 'stat'),
    };

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
      await analyzer.initialize();

      expect(analyzer.id).toBe('analyzer');
      expect(analyzer.name).toBe('AnalyzerAgent');
      expect(analyzer.status).toBe('ready');
      expect(analyzer.getCapabilities()).toContain('ast-parsing');
      expect(analyzer.getCapabilities()).toContain('complexity-analysis');
      expect(analyzer.getCapabilities()).toContain('pattern-detection');
      expect(analyzer.getCapabilities()).toContain('dependency-analysis');
    });

    test('should emit ready event after initialization', async () => {
      const readyHandler = jest.fn();
      analyzer.on('ready', readyHandler);

      await analyzer.initialize();

      expect(readyHandler).toHaveBeenCalledWith({ agent: 'analyzer' });
    });
  });

  describe('AST Parsing', () => {
    test('should parse JavaScript file and generate AST', async () => {
      await analyzer.initialize();

      const testCode = `
        function calculateTotal(items) {
          return items.reduce((sum, item) => sum + item.price, 0);
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(testCode);

      const result = await analyzer.execute('parse-ast', {
        filePath: 'test.js',
      });

      expect(result.success).toBe(true);
      expect(result.result.ast).toBeDefined();
      expect(result.result.ast.type).toBe('Program');
      expect(result.result.functions).toHaveLength(1);
      expect(result.result.functions[0]).toBe('calculateTotal');
    });

    test('should handle TypeScript files', async () => {
      await analyzer.initialize();

      const testCode = `
        interface User {
          id: number;
          name: string;
        }

        function getUser(id: number): User {
          return { id, name: 'Test' };
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(testCode);

      const result = await analyzer.execute('parse-ast', {
        filePath: 'test.ts',
      });

      expect(result.success).toBe(true);
      expect(result.result.ast).toBeDefined();
      expect(result.result.interfaces).toHaveLength(1);
      expect(result.result.interfaces[0]).toBe('User');
    });

    test('should handle parsing errors gracefully', async () => {
      await analyzer.initialize();

      const invalidCode = 'function { invalid }';
      mockFS.readFile.mockResolvedValueOnce(invalidCode);

      const result = await analyzer.execute('parse-ast', {
        filePath: 'invalid.js',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse');
    });
  });

  describe('Complexity Analysis', () => {
    test('should calculate cyclomatic complexity', async () => {
      await analyzer.initialize();

      const complexCode = `
        function processData(data) {
          if (data.type === 'A') {
            if (data.value > 100) {
              return 'high';
            } else {
              return 'low';
            }
          } else if (data.type === 'B') {
            for (let i = 0; i < data.items.length; i++) {
              if (data.items[i].active) {
                processItem(data.items[i]);
              }
            }
          }
          return 'default';
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(complexCode);

      const result = await analyzer.execute('analyze-complexity', {
        filePath: 'complex.js',
      });

      expect(result.success).toBe(true);
      expect(result.result.complexity).toBeDefined();
      expect(result.result.complexity.cyclomatic).toBeGreaterThan(1);
      expect(result.result.complexity.functions).toBeDefined();
      expect(result.result.complexity.functions).toHaveProperty('processData');
    });

    test('should analyze code maintainability metrics', async () => {
      await analyzer.initialize();

      const testCode = `
        // Calculate user score
        function calculateScore(user) {
          const base = user.level * 10;
          const bonus = user.achievements.length * 5;
          return base + bonus;
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(testCode);

      const result = await analyzer.execute('analyze-complexity', {
        filePath: 'metrics.js',
      });

      expect(result.success).toBe(true);
      expect(result.result.metrics).toBeDefined();
      expect(result.result.metrics.linesOfCode).toBeGreaterThan(0);
      expect(result.result.metrics.commentLines).toBeGreaterThan(0);
      expect(result.result.metrics.maintainabilityIndex).toBeDefined();
    });

    test('should identify complex functions needing refactoring', async () => {
      await analyzer.initialize();

      const complexCode = `
        function complexFunction(a, b, c, d, e) {
          if (a && b) {
            if (c || d) {
              while (e > 0) {
                if (e % 2 === 0) {
                  doSomething();
                } else if (e % 3 === 0) {
                  doSomethingElse();
                } else {
                  doDefault();
                }
                e--;
              }
            }
          }
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(complexCode);

      const result = await analyzer.execute('analyze-complexity', {
        filePath: 'refactor.js',
      });

      expect(result.success).toBe(true);
      expect(result.result.recommendations).toBeDefined();
      expect(result.result.recommendations).toContain('refactor');
    });
  });

  describe('Pattern Detection', () => {
    test('should detect design patterns', async () => {
      await analyzer.initialize();

      const singletonCode = `
        class DatabaseConnection {
          constructor() {
            if (DatabaseConnection.instance) {
              return DatabaseConnection.instance;
            }
            this.connection = this.createConnection();
            DatabaseConnection.instance = this;
          }

          createConnection() {
            return { connected: true };
          }
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(singletonCode);

      const result = await analyzer.execute('detect-patterns', {
        filePath: 'singleton.js',
      });

      expect(result.success).toBe(true);
      expect(result.result.patterns).toBeDefined();
      expect(result.result.patterns).toContain('singleton');
    });

    test('should detect anti-patterns', async () => {
      await analyzer.initialize();

      const antiPatternCode = `
        function getData() {
          try {
            return fetchData();
          } catch (e) {
            // Swallow error
          }
        }

        function processItems(items) {
          for (var i = 0; i < items.length; i++) {
            setTimeout(function() {
              console.log(items[i]); // Variable capture issue
            }, 100);
          }
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(antiPatternCode);

      const result = await analyzer.execute('detect-patterns', {
        filePath: 'antipattern.js',
      });

      expect(result.success).toBe(true);
      expect(result.result.antiPatterns).toBeDefined();
      expect(result.result.antiPatterns.length).toBeGreaterThan(0);
    });

    test('should detect code smells', async () => {
      await analyzer.initialize();

      const smellCode = `
        function processUserDataAndSendEmailAndUpdateDatabaseAndLogActivity(
          user, email, database, logger
        ) {
          // Long method doing too many things
          const userData = validateUser(user);
          const emailContent = formatEmail(email);
          sendEmail(emailContent);
          database.update(userData);
          logger.log('Activity');
          return true;
        }

        class God {
          constructor() {
            this.database = new Database();
            this.emailer = new Emailer();
            this.logger = new Logger();
            this.validator = new Validator();
            this.formatter = new Formatter();
            // God object with too many responsibilities
          }
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(smellCode);

      const result = await analyzer.execute('detect-patterns', {
        filePath: 'smells.js',
      });

      expect(result.success).toBe(true);
      expect(result.result.codeSmells).toBeDefined();
      expect(result.result.codeSmells).toContainEqual(
        expect.objectContaining({ type: 'long-method' })
      );
      expect(result.result.codeSmells).toContainEqual(
        expect.objectContaining({ type: 'god-object' })
      );
    });
  });

  describe('Dependency Analysis', () => {
    test('should analyze module dependencies', async () => {
      await analyzer.initialize();

      const moduleCode = `
        import React from 'react';
        import { useState, useEffect } from 'react';
        import axios from 'axios';
        import './styles.css';
        const utils = require('./utils');

        export function Component() {
          return <div>Test</div>;
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(moduleCode);

      const result = await analyzer.execute('analyze-dependencies', {
        filePath: 'component.js',
      });

      expect(result.success).toBe(true);
      expect(result.result.dependencies).toBeDefined();
      expect(result.result.dependencies.imports).toContain('react');
      expect(result.result.dependencies.imports).toContain('axios');
      expect(result.result.dependencies.requires).toContain('./utils');
      expect(result.result.dependencies.exports).toContain('Component');
    });

    test('should detect circular dependencies', async () => {
      await analyzer.initialize();

      // Mock multiple file reads for circular dependency check
      mockFS.readFile.mockResolvedValueOnce(`
          import { b } from './b.js';
          export const a = () => b();
        `).mockResolvedValueOnce(`
          import { a } from './a.js';
          export const b = () => a();
        `);

      mockFS.readdir.mockResolvedValue(['a.js', 'b.js']);
      mockFS.stat.mockResolvedValue({ isFile: () => true });

      const result = await analyzer.execute('analyze-dependencies', {
        directory: './src',
      });

      expect(result.success).toBe(true);
      expect(result.result.circularDependencies).toBeDefined();
      expect(result.result.circularDependencies.length).toBeGreaterThan(0);
    });

    test('should analyze package.json dependencies', async () => {
      await analyzer.initialize();

      const packageJson = JSON.stringify({
        dependencies: {
          react: '^18.0.0',
          axios: '^1.0.0',
        },
        devDependencies: {
          jest: '^29.0.0',
          eslint: '^8.0.0',
        },
      });

      mockFS.readFile.mockResolvedValueOnce(packageJson);

      const result = await analyzer.execute('analyze-dependencies', {
        filePath: 'package.json',
      });

      expect(result.success).toBe(true);
      expect(result.result.production).toHaveLength(2);
      expect(result.result.development).toHaveLength(2);
      expect(result.result.total).toBe(4);
    });
  });

  describe('Project Analysis', () => {
    test('should perform comprehensive project analysis', async () => {
      await analyzer.initialize();

      mockFS.readdir.mockResolvedValue([
        'index.js',
        'utils.js',
        'component.jsx',
        'styles.css',
        'README.md',
      ]);

      mockFS.stat.mockImplementation((filePath) => ({
        isFile: () => !filePath.includes('node_modules'),
        isDirectory: () => filePath.includes('node_modules'),
        size: 1000,
      }));

      mockFS.readFile.mockResolvedValue('const test = "code";');

      const result = await analyzer.execute('analyze-project', {
        directory: './src',
      });

      expect(result.success).toBe(true);
      expect(result.result.summary).toBeDefined();
      expect(result.result.summary.totalFiles).toBeGreaterThan(0);
      expect(result.result.summary.languages).toBeDefined();
      expect(result.result.codeQuality).toBeDefined();
    });
  });

  describe('Task Validation', () => {
    test('should only handle analysis tasks', async () => {
      await analyzer.initialize();

      expect(analyzer.canHandle('parse-ast')).toBe(true);
      expect(analyzer.canHandle('analyze-complexity')).toBe(true);
      expect(analyzer.canHandle('detect-patterns')).toBe(true);
      expect(analyzer.canHandle('analyze-dependencies')).toBe(true);
      expect(analyzer.canHandle('analyze-project')).toBe(true);
      expect(analyzer.canHandle('invalid-task')).toBe(false);
    });

    test('should reject invalid tasks', async () => {
      await analyzer.initialize();

      const result = await analyzer.execute('invalid-task', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot handle task');
    });
  });

  describe('State Management', () => {
    test('should persist analysis results in state', async () => {
      await analyzer.initialize();

      const testCode = 'function test() { return true; }';
      mockFS.readFile.mockResolvedValueOnce(testCode);

      await analyzer.execute('parse-ast', {
        filePath: 'test.js',
      });

      const state = analyzer.getState();
      expect(state.lastAnalysis).toBeDefined();
      expect(state.analysisHistory).toBeDefined();
      expect(state.analysisHistory.length).toBeGreaterThan(0);
    });

    test('should maintain analysis cache', async () => {
      await analyzer.initialize();

      const testCode = 'const x = 1;';
      mockFS.readFile.mockResolvedValueOnce(testCode);

      // First analysis
      await analyzer.execute('parse-ast', {
        filePath: 'cached.js',
        useCache: true,
      });

      // Second analysis should use cache
      const result = await analyzer.execute('parse-ast', {
        filePath: 'cached.js',
        useCache: true,
      });

      expect(result.result.cached).toBe(true);
    });
  });
});
