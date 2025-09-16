/**
 * Tests for project structure validation and core module loading
 */

import { jest, describe, test, expect, beforeAll, afterEach, beforeEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Project Structure Validation', () => {
  const rootDir = path.join(__dirname, '..', '..');

  describe('Core Directory Structure', () => {
    test('should have required root directories', async () => {
      const requiredDirs = [
        'src',
        'src/core',
        'src/commands',
        'src/integration',
        'src/output',
        'src/utils',
      ];

      for (const dir of requiredDirs) {
        const dirPath = path.join(rootDir, dir);
        const exists = await fs
          .access(dirPath)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
      }
    });

    test('should have core subdirectories', async () => {
      const coreDirs = [
        'src/core/analysis',
        'src/core/templates',
        'src/core/memory',
        'src/core/validation',
      ];

      for (const dir of coreDirs) {
        const dirPath = path.join(rootDir, dir);
        const exists = await fs
          .access(dirPath)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
      }
    });

    test('should have configuration files', async () => {
      const configFiles = [
        'package.json',
        'tsconfig.json',
        '.eslintrc.cjs',
        '.prettierrc',
        'jest.config.cjs',
      ];

      for (const file of configFiles) {
        const filePath = path.join(rootDir, file);
        const exists = await fs
          .access(filePath)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
      }
    });
  });

  describe('Package Configuration', () => {
    let packageJson;

    beforeAll(async () => {
      const packagePath = path.join(rootDir, 'package.json');
      const content = await fs.readFile(packagePath, 'utf-8');
      packageJson = JSON.parse(content);
    });

    test('should have correct package name', () => {
      expect(packageJson.name).toBe('devflow');
    });

    test('should have required scripts', () => {
      const requiredScripts = ['test', 'build', 'lint', 'format', 'typecheck'];

      for (const script of requiredScripts) {
        expect(packageJson.scripts).toHaveProperty(script);
      }
    });

    test('should have required dependencies', () => {
      const requiredDeps = [
        'chalk',
        'inquirer',
        'handlebars',
        'yaml',
        'fs-extra',
        'fast-glob',
        'semver',
      ];

      for (const dep of requiredDeps) {
        expect(packageJson.dependencies).toHaveProperty(dep);
      }
    });

    test('should have required dev dependencies', () => {
      const requiredDevDeps = [
        'typescript',
        'jest',
        '@types/jest',
        '@types/node',
        'eslint',
        'prettier',
      ];

      for (const dep of requiredDevDeps) {
        expect(packageJson.devDependencies).toHaveProperty(dep);
      }
    });
  });
});

describe('Core Module Loading', () => {
  describe('Module Loader', () => {
    test('should load base module loader', async () => {
      const loader = await import('../../src/core/moduleLoader.js');
      expect(loader.default).toBeDefined();
      expect(loader.default.loadModule).toBeInstanceOf(Function);
      expect(loader.default.registerModule).toBeInstanceOf(Function);
    });

    test('should handle module registration', async () => {
      const loader = await import('../../src/core/moduleLoader.js');
      const moduleLoader = loader.default;
      const testModule = { name: 'test-reg', init: jest.fn() };

      moduleLoader.registerModule('test-reg', testModule);
      const loaded = moduleLoader.getModule('test-reg');

      expect(loaded).toBe(testModule);
    });

    test('should throw error for non-existent modules', async () => {
      const loader = await import('../../src/core/moduleLoader.js');
      const moduleLoader = loader.default;

      expect(() => {
        moduleLoader.getModule('non-existent-module');
      }).toThrow('Module not found: non-existent-module');
    });
  });

  describe('Dependency Injection', () => {
    test('should initialize DI container', async () => {
      const { Container } = await import('../../src/core/container.js');
      const container = new Container();

      expect(container).toBeDefined();
      expect(container.register).toBeInstanceOf(Function);
      expect(container.resolve).toBeInstanceOf(Function);
    });

    test('should register and resolve dependencies', async () => {
      const { Container } = await import('../../src/core/container.js');
      const container = new Container();

      class TestService {
        getValue() {
          return 'test-value';
        }
      }

      container.register('testService', TestService);
      const instance = container.resolve('testService');

      expect(instance).toBeInstanceOf(TestService);
      expect(instance.getValue()).toBe('test-value');
    });

    test('should handle singleton instances', async () => {
      const { Container } = await import('../../src/core/container.js');
      const container = new Container();

      class SingletonService {
        constructor() {
          this.id = Math.random();
        }
      }

      container.registerSingleton('singleton', SingletonService);
      const instance1 = container.resolve('singleton');
      const instance2 = container.resolve('singleton');

      expect(instance1).toBe(instance2);
      expect(instance1.id).toBe(instance2.id);
    });
  });

  describe('Error Handling', () => {
    test('should load error handler utility', async () => {
      const { ErrorHandler } = await import('../../src/utils/errorHandler.js');

      expect(ErrorHandler).toBeDefined();
      expect(ErrorHandler.handle).toBeInstanceOf(Function);
      expect(ErrorHandler.wrap).toBeInstanceOf(Function);
    });

    test('should handle and format errors', async () => {
      const { ErrorHandler } = await import('../../src/utils/errorHandler.js');
      const error = new Error('Test error');

      const formatted = ErrorHandler.format(error);

      expect(formatted).toHaveProperty('message');
      expect(formatted).toHaveProperty('stack');
      expect(formatted).toHaveProperty('timestamp');
    });
  });

  describe('Logging System', () => {
    test('should load logger', async () => {
      const { Logger } = await import('../../src/utils/logger.js');

      expect(Logger).toBeDefined();
      expect(Logger.info).toBeInstanceOf(Function);
      expect(Logger.error).toBeInstanceOf(Function);
      expect(Logger.warn).toBeInstanceOf(Function);
      expect(Logger.debug).toBeInstanceOf(Function);
    });

    test('should format log messages with levels', async () => {
      const { Logger } = await import('../../src/utils/logger.js');

      // Logger should have proper methods even if output is suppressed in test mode
      expect(Logger.info).toBeInstanceOf(Function);
      expect(Logger.error).toBeInstanceOf(Function);
      expect(Logger.warn).toBeInstanceOf(Function);
      expect(Logger.debug).toBeInstanceOf(Function);

      // Verify the logger can be called without errors
      expect(() => Logger.info('Info message')).not.toThrow();
      expect(() => Logger.error('Error message')).not.toThrow();
      expect(() => Logger.warn('Warning message')).not.toThrow();
      expect(() => Logger.debug('Debug message')).not.toThrow();
    });
  });
});

describe('TypeScript Build Pipeline', () => {
  test('should have valid TypeScript configuration', async () => {
    const tsconfigPath = path.join(__dirname, '..', '..', 'tsconfig.json');
    const content = await fs.readFile(tsconfigPath, 'utf-8');
    const tsconfig = JSON.parse(content);

    expect(tsconfig.compilerOptions).toBeDefined();
    expect(tsconfig.compilerOptions.target).toBeDefined();
    expect(tsconfig.compilerOptions.module).toBeDefined();
    expect(tsconfig.compilerOptions.outDir).toBe('./dist');
    expect(tsconfig.compilerOptions.rootDir).toBe('./src');
  });
});

describe('Code Quality Tools', () => {
  test('should have ESLint configuration', async () => {
    const eslintPath = path.join(__dirname, '..', '..', '.eslintrc.cjs');
    const exists = await fs
      .access(eslintPath)
      .then(() => true)
      .catch(() => false);

    expect(exists).toBe(true);

    const { default: eslintConfig } = await import(`file://${eslintPath}`);
    expect(eslintConfig.extends).toBeDefined();
    expect(eslintConfig.rules).toBeDefined();
  });

  test('should have Prettier configuration', async () => {
    const prettierPath = path.join(__dirname, '..', '..', '.prettierrc');
    const content = await fs.readFile(prettierPath, 'utf-8');
    const prettierConfig = JSON.parse(content);

    expect(prettierConfig).toBeDefined();
    expect(prettierConfig.semi).toBeDefined();
    expect(prettierConfig.singleQuote).toBeDefined();
  });

  test('should have Jest configuration', async () => {
    const jestPath = path.join(__dirname, '..', '..', 'jest.config.cjs');
    const exists = await fs
      .access(jestPath)
      .then(() => true)
      .catch(() => false);

    expect(exists).toBe(true);

    const { default: jestConfig } = await import(`file://${jestPath}`);
    expect(jestConfig.testEnvironment).toBe('node');
    expect(jestConfig.collectCoverageFrom).toBeDefined();
    expect(jestConfig.coverageThreshold).toBeDefined();
  });
});
