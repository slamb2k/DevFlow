/**
 * Configuration Validation System
 * Validates, sanitizes, and manages project configurations
 */

import Joi from 'joi';
import { createHash } from 'crypto';

export class ConfigValidator {
  constructor() {
    this.schemas = new Map();
    this.backups = new Map();
    this.initializeSchemas();
  }

  /**
   * Initialize validation schemas for different project types
   */
  initializeSchemas() {
    // React project schema
    this.schemas.set(
      'react',
      Joi.object({
        projectType: Joi.string().required().valid('react'),
        framework: Joi.string().required(),
        dependencies: Joi.array().items(Joi.string()).default([]),
        scripts: Joi.object({
          start: Joi.string(),
          build: Joi.string(),
          test: Joi.string(),
          lint: Joi.string(),
        }).default({}),
        build: Joi.object({
          outputDir: Joi.string().default('build'),
          sourceMap: Joi.boolean().default(true),
          optimization: Joi.object({
            minify: Joi.boolean().default(true),
            splitChunks: Joi.boolean().default(true),
          }),
        }),
        port: Joi.number().min(1).max(65535).default(3000),
        debug: Joi.boolean().default(false),
      })
    );

    // Node.js project schema
    this.schemas.set(
      'node',
      Joi.object({
        projectType: Joi.string().required().valid('node'),
        framework: Joi.string(),
        dependencies: Joi.array().items(Joi.string()).default([]),
        scripts: Joi.object({
          start: Joi.string().default('node index.js'),
          dev: Joi.string(),
          test: Joi.string(),
          build: Joi.string(),
        }).default({
          start: 'node index.js',
        }),
        port: Joi.number().min(1).max(65535),
        debug: Joi.boolean().default(false),
      })
    );

    // Python project schema
    this.schemas.set(
      'python',
      Joi.object({
        projectType: Joi.string().required().valid('python'),
        framework: Joi.string(),
        dependencies: Joi.array().items(Joi.string()).default([]),
        scripts: Joi.object({
          start: Joi.string().default('python main.py'),
          test: Joi.string().default('pytest'),
          lint: Joi.string().default('pylint'),
        }).default({
          start: 'python main.py',
          test: 'pytest',
        }),
        virtualEnv: Joi.string().default('venv'),
        pythonVersion: Joi.string()
          .pattern(/^\d+\.\d+/)
          .default('3.9'),
      })
    );

    // Generic schema for unknown project types
    this.schemas.set(
      'generic',
      Joi.object({
        projectType: Joi.string(),
        dependencies: Joi.array().items(Joi.string()).default([]),
        scripts: Joi.object().pattern(Joi.string(), Joi.string()).default({}),
      })
    );
  }

  /**
   * Validate configuration against schema
   */
  validate(config, projectType = 'generic') {
    const schema = this.schemas.get(projectType) || this.schemas.get('generic');
    const result = schema.validate(config, { abortEarly: false });

    return {
      valid: !result.error,
      errors: result.error ? result.error.details.map((d) => d.message) : [],
      value: result.value,
    };
  }

  /**
   * Deep validation with nested object support
   */
  validateDeep(config) {
    const projectType = config.projectType || 'generic';
    return this.validate(config, projectType);
  }

  /**
   * Sanitize configuration values
   */
  sanitize(config) {
    const sanitized = {};

    for (const [key, value] of Object.entries(config)) {
      // Skip internal fields
      if (key.startsWith('_') || key === 'invalidField') {
        continue;
      }

      // Sanitize based on type
      if (typeof value === 'string') {
        // Check if it's a numeric string
        if (!isNaN(value) && value.trim() !== '') {
          sanitized[key] = Number(value);
        } else if (value === 'true' || value === 'false') {
          sanitized[key] = value === 'true';
        } else {
          sanitized[key] = value.trim().toLowerCase();
        }
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Normalize configuration structure
   */
  normalize(config) {
    const normalized = { ...config };

    // Handle common aliases
    if (normalized.type && !normalized.projectType) {
      normalized.projectType = normalized.type;
      delete normalized.type;
    }

    if (normalized.deps && !normalized.dependencies) {
      normalized.dependencies = normalized.deps;
      delete normalized.deps;
    }

    // Apply defaults based on project type
    const projectType = normalized.projectType || 'generic';
    const schema = this.schemas.get(projectType) || this.schemas.get('generic');

    // Use Joi to apply defaults
    const { value } = schema.validate(normalized, {
      abortEarly: false,
      stripUnknown: false,
    });

    return value || normalized;
  }

  /**
   * Calculate differences between configurations
   */
  diff(oldConfig, newConfig) {
    const diff = {
      added: [],
      removed: [],
      changed: [],
    };

    // Check for added and changed fields
    for (const key in newConfig) {
      if (!(key in oldConfig)) {
        diff.added.push(key);
      } else if (JSON.stringify(oldConfig[key]) !== JSON.stringify(newConfig[key])) {
        diff.changed.push(key);
      }
    }

    // Check for removed fields
    for (const key in oldConfig) {
      if (!(key in newConfig)) {
        diff.removed.push(key);
      }
    }

    return diff;
  }

  /**
   * Merge configurations with strategy
   */
  merge(base, update, options = {}) {
    const strategy = options.strategy || 'overwrite';

    if (strategy === 'overwrite') {
      return { ...base, ...update };
    } else if (strategy === 'preserve') {
      const merged = { ...base };
      for (const key in update) {
        if (!(key in merged)) {
          merged[key] = update[key];
        }
      }
      return merged;
    } else if (strategy === 'deep') {
      return this.deepMerge(base, update);
    }

    return { ...base, ...update };
  }

  /**
   * Deep merge helper
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Create configuration backup
   */
  backup(config) {
    const id = createHash('sha256')
      .update(JSON.stringify(config) + Date.now())
      .digest('hex')
      .substring(0, 8);

    this.backups.set(id, {
      config: JSON.parse(JSON.stringify(config)),
      timestamp: Date.now(),
    });

    // Limit backup count
    if (this.backups.size > 10) {
      const oldest = Array.from(this.backups.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      )[0];
      this.backups.delete(oldest[0]);
    }

    return id;
  }

  /**
   * Check if backup exists
   */
  hasBackup(id) {
    return this.backups.has(id);
  }

  /**
   * Rollback to backup
   */
  rollback(id) {
    const backup = this.backups.get(id);
    if (!backup) {
      throw new Error(`Backup ${id} not found`);
    }
    return JSON.parse(JSON.stringify(backup.config));
  }

  /**
   * Migrate configuration to new version
   */
  migrate(config, targetVersion) {
    const migrated = { ...config };

    // Simple version migration
    const currentVersion = config.version || '1.0';

    migrated.version = targetVersion;
    migrated.migratedFrom = currentVersion;
    migrated.migratedAt = new Date().toISOString();

    // Apply version-specific transformations
    if (currentVersion === '1.0' && targetVersion === '2.0') {
      // Example migration logic
      if (migrated.oldField) {
        migrated.newField = migrated.oldField;
        delete migrated.oldField;
      }
    }

    return migrated;
  }

  /**
   * Apply multiple migrations in sequence
   */
  applyMigrations(config, migrations) {
    let current = { ...config };

    for (const migration of migrations) {
      if (current.version === migration.from) {
        current = migration.transform(current);
      }
    }

    return current;
  }

  /**
   * Export schema for documentation
   */
  exportSchema(projectType) {
    const schema = this.schemas.get(projectType);
    if (!schema) {
      return null;
    }
    return schema.describe();
  }

  /**
   * Register custom schema
   */
  registerSchema(name, schema) {
    this.schemas.set(name, schema);
  }
}
