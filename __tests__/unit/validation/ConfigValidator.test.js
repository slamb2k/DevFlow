/**
 * Tests for Configuration Validation System
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';

describe('ConfigValidator', () => {
  let ConfigValidator;
  let validator;

  beforeEach(async () => {
    const module = await import('../../../src/core/validation/ConfigValidator.js');
    ConfigValidator = module.ConfigValidator;
    validator = new ConfigValidator();
  });

  describe('Schema Validation', () => {
    test('should validate React project configuration', () => {
      const config = {
        projectType: 'react',
        framework: 'react',
        dependencies: ['react', 'react-dom'],
        scripts: {
          start: 'react-scripts start',
          build: 'react-scripts build',
          test: 'react-scripts test'
        }
      };

      const result = validator.validate(config, 'react');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate Node.js project configuration', () => {
      const config = {
        projectType: 'node',
        framework: 'express',
        dependencies: ['express'],
        scripts: {
          start: 'node index.js',
          dev: 'nodemon index.js'
        }
      };

      const result = validator.validate(config, 'node');
      expect(result.valid).toBe(true);
    });

    test('should detect missing required fields', () => {
      const config = {
        framework: 'react'
        // Missing projectType
      };

      const result = validator.validate(config, 'react');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('projectType');
    });

    test('should validate nested configuration objects', () => {
      const config = {
        projectType: 'react',
        framework: 'react',
        dependencies: ['react'],
        build: {
          outputDir: 'dist',
          sourceMap: true,
          optimization: {
            minify: true,
            splitChunks: true
          }
        }
      };

      const result = validator.validateDeep(config);
      expect(result.valid).toBe(true);
    });
  });

  describe('Sanitization', () => {
    test('should sanitize configuration values', () => {
      const config = {
        projectType: '  react  ',
        framework: 'REACT',
        port: '3000',
        debug: 'true'
      };

      const sanitized = validator.sanitize(config);
      expect(sanitized.projectType).toBe('react');
      expect(sanitized.framework).toBe('react');
      expect(sanitized.port).toBe(3000);
      expect(sanitized.debug).toBe(true);
    });

    test('should remove invalid fields', () => {
      const config = {
        projectType: 'react',
        invalidField: 'should be removed',
        _internal: 'should be removed'
      };

      const sanitized = validator.sanitize(config);
      expect(sanitized.invalidField).toBeUndefined();
      expect(sanitized._internal).toBeUndefined();
    });
  });

  describe('Normalization', () => {
    test('should normalize configuration structure', () => {
      const config = {
        type: 'react', // Should be normalized to projectType
        deps: ['react'] // Should be normalized to dependencies
      };

      const normalized = validator.normalize(config);
      expect(normalized.projectType).toBe('react');
      expect(normalized.dependencies).toEqual(['react']);
    });

    test('should apply default values', () => {
      const config = {
        projectType: 'node'
      };

      const normalized = validator.normalize(config);
      expect(normalized.scripts).toBeDefined();
      expect(normalized.dependencies).toEqual([]);
    });
  });

  describe('Diff and Merge', () => {
    test('should calculate configuration differences', () => {
      const oldConfig = {
        projectType: 'react',
        port: 3000,
        debug: false
      };

      const newConfig = {
        projectType: 'react',
        port: 3001,
        debug: true,
        newField: 'added'
      };

      const diff = validator.diff(oldConfig, newConfig);
      expect(diff.changed).toContain('port');
      expect(diff.changed).toContain('debug');
      expect(diff.added).toContain('newField');
    });

    test('should merge configurations with conflict resolution', () => {
      const base = { a: 1, b: 2, c: 3 };
      const update = { b: 20, c: 30, d: 4 };

      const merged = validator.merge(base, update, { strategy: 'overwrite' });
      expect(merged).toEqual({ a: 1, b: 20, c: 30, d: 4 });

      const preserved = validator.merge(base, update, { strategy: 'preserve' });
      expect(preserved).toEqual({ a: 1, b: 2, c: 3, d: 4 });
    });
  });

  describe('Backup and Rollback', () => {
    test('should create configuration backup', () => {
      const config = { version: 1, data: 'original' };
      const backupId = validator.backup(config);

      expect(backupId).toBeDefined();
      expect(validator.hasBackup(backupId)).toBe(true);
    });

    test('should rollback to previous configuration', () => {
      const original = { version: 1, data: 'original' };
      const backupId = validator.backup(original);

      // Make changes
      const modified = { version: 2, data: 'modified' };

      // Rollback
      const restored = validator.rollback(backupId);
      expect(restored).toEqual(original);
    });
  });

  describe('Migration', () => {
    test('should migrate configuration to new schema', () => {
      const oldConfig = {
        version: '1.0',
        oldField: 'value'
      };

      const migrated = validator.migrate(oldConfig, '2.0');
      expect(migrated.version).toBe('2.0');
      expect(migrated.migratedFrom).toBe('1.0');
    });

    test('should handle migration chain', () => {
      const config = { version: '1.0' };

      const migrations = [
        { from: '1.0', to: '1.1', transform: (c) => ({ ...c, version: '1.1', field1: true }) },
        { from: '1.1', to: '2.0', transform: (c) => ({ ...c, version: '2.0', field2: true }) }
      ];

      const migrated = validator.applyMigrations(config, migrations);
      expect(migrated.version).toBe('2.0');
      expect(migrated.field1).toBe(true);
      expect(migrated.field2).toBe(true);
    });
  });
});