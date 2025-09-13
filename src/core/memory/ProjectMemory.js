/**
 * Project Memory System
 * Manages persistent state storage in .devflow/ directory
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { watch } from 'fs';

export class ProjectMemory extends EventEmitter {
  constructor(projectRoot = process.cwd()) {
    super();
    this.projectRoot = projectRoot;
    this.devflowPath = path.join(projectRoot, '.devflow');
    this.configPath = path.join(this.devflowPath, 'config.json');
    this.statePath = path.join(this.devflowPath, 'state.json');
    this.templatesPath = path.join(this.devflowPath, 'templates.json');
    this.backupsPath = path.join(this.devflowPath, 'backups');
    this.lockFile = path.join(this.devflowPath, '.lock');
    this.watcher = null;
    this.cache = new Map();
  }

  /**
   * Initialize the project memory system
   */
  async init() {
    // Create .devflow directory
    await fs.mkdir(this.devflowPath, { recursive: true });
    await fs.mkdir(this.backupsPath, { recursive: true });

    // Initialize config if not exists
    if (!(await this.fileExists(this.configPath))) {
      await this.initConfig();
    } else {
      // Check for migration needs
      await this.migrateIfNeeded();
    }

    // Initialize state if not exists
    if (!(await this.fileExists(this.statePath))) {
      await this.writeJson(this.statePath, {
        initialized: true,
        createdAt: new Date().toISOString()
      });
    }

    // Initialize templates if not exists
    if (!(await this.fileExists(this.templatesPath))) {
      await this.writeJson(this.templatesPath, {});
    }

    // Validate and repair if needed
    await this.validateAndRepair();
  }

  /**
   * Initialize default configuration
   */
  async initConfig() {
    const defaultConfig = {
      version: '1.0.0',
      projectName: path.basename(this.projectRoot),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: {
        maxBackups: 10,
        autoBackup: true,
        watchEnabled: false
      }
    };

    await this.writeJson(this.configPath, defaultConfig);
    return defaultConfig;
  }

  /**
   * Get configuration
   */
  async getConfig() {
    if (this.cache.has('config')) {
      return this.cache.get('config');
    }

    const config = await this.readJson(this.configPath);
    this.cache.set('config', config);
    return config;
  }

  /**
   * Update configuration
   */
  async updateConfig(updates) {
    const config = await this.getConfig();
    const updated = this.deepMerge(config, updates);
    updated.updatedAt = new Date().toISOString();

    await this.writeJson(this.configPath, updated);
    this.cache.set('config', updated);
    return updated;
  }

  /**
   * Get current state
   */
  async getState() {
    if (this.cache.has('state')) {
      return this.cache.get('state');
    }

    const state = await this.readJson(this.statePath);
    this.cache.set('state', state);
    return state;
  }

  /**
   * Set complete state
   */
  async setState(state) {
    await this.writeJson(this.statePath, state);
    this.cache.set('state', state);
    this.emit('stateChanged', state);
    return state;
  }

  /**
   * Update state partially
   */
  async updateState(updates) {
    await this.acquireLock();
    try {
      const state = await this.getState();
      const updated = this.deepMerge(state, updates);
      return await this.setState(updated);
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Save a template
   */
  async saveTemplate(name, template) {
    const templates = await this.readJson(this.templatesPath);
    templates[name] = template;
    await this.writeJson(this.templatesPath, templates);
    this.cache.delete('templates');
    return template;
  }

  /**
   * Get a template
   */
  async getTemplate(name) {
    const templates = await this.readJson(this.templatesPath);
    return templates[name];
  }

  /**
   * List all templates
   */
  async listTemplates() {
    const templates = await this.readJson(this.templatesPath);
    return Object.keys(templates);
  }

  /**
   * Delete a template
   */
  async deleteTemplate(name) {
    const templates = await this.readJson(this.templatesPath);
    delete templates[name];
    await this.writeJson(this.templatesPath, templates);
    this.cache.delete('templates');
  }

  /**
   * Create a backup
   */
  async createBackup(label = '') {
    const timestamp = Date.now();
    const backupId = `backup-${timestamp}${label ? `-${label}` : ''}`;
    const backupPath = path.join(this.backupsPath, `${backupId}.json`);

    const backup = {
      id: backupId,
      timestamp,
      label,
      config: await this.getConfig(),
      state: await this.getState(),
      templates: await this.readJson(this.templatesPath)
    };

    await this.writeJson(backupPath, backup);

    // Cleanup old backups
    await this.cleanupBackups();

    return backupId;
  }

  /**
   * Restore from backup
   */
  async restoreBackup(backupId) {
    const backupPath = path.join(this.backupsPath, `${backupId}.json`);
    const backup = await this.readJson(backupPath);

    await this.writeJson(this.configPath, backup.config);
    await this.writeJson(this.statePath, backup.state);
    await this.writeJson(this.templatesPath, backup.templates);

    // Clear cache
    this.cache.clear();

    this.emit('restored', backupId);
    return backup;
  }

  /**
   * List available backups
   */
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupsPath);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''))
        .sort()
        .reverse();
    } catch (error) {
      return [];
    }
  }

  /**
   * Cleanup old backups
   */
  async cleanupBackups() {
    const config = await this.getConfig();
    const maxBackups = config.settings?.maxBackups || 10;
    const backups = await this.listBackups();

    if (backups.length > maxBackups) {
      const toDelete = backups.slice(maxBackups);
      for (const backupId of toDelete) {
        const backupPath = path.join(this.backupsPath, `${backupId}.json`);
        await fs.unlink(backupPath).catch(() => {});
      }
    }
  }

  /**
   * Watch for external changes
   */
  watch(options = {}) {
    if (this.watcher) {
      this.watcher.close();
    }

    const emitter = new EventEmitter();

    this.watcher = watch(this.devflowPath, { recursive: true }, async (eventType, filename) => {
      if (!filename || filename.includes('.lock')) return;

      emitter.emit('change', filename);

      if (options.autoReload) {
        // Clear cache to force reload
        this.cache.clear();
        this.emit('reloaded', filename);
      }
    });

    emitter.close = () => {
      if (this.watcher) {
        this.watcher.close();
        this.watcher = null;
      }
    };

    return emitter;
  }

  /**
   * Cleanup old data
   */
  async cleanup(options = {}) {
    const maxAge = options.maxAge || 30; // days
    const cutoff = Date.now() - (maxAge * 24 * 60 * 60 * 1000);

    const backups = await this.listBackups();
    for (const backupId of backups) {
      const match = backupId.match(/backup-(\d+)/);
      if (match && parseInt(match[1]) < cutoff) {
        const backupPath = path.join(this.backupsPath, `${backupId}.json`);
        await fs.unlink(backupPath).catch(() => {});
      }
    }
  }

  /**
   * Optimize storage
   */
  async optimize() {
    // Remove duplicate templates by content hash
    const templates = await this.readJson(this.templatesPath);
    const seen = new Map();
    const optimized = {};

    for (const [name, template] of Object.entries(templates)) {
      const hash = this.hash(JSON.stringify(template));
      if (!seen.has(hash)) {
        seen.set(hash, name);
        optimized[name] = template;
      }
    }

    await this.writeJson(this.templatesPath, optimized);
    this.cache.delete('templates');

    return {
      before: Object.keys(templates).length,
      after: Object.keys(optimized).length,
      removed: Object.keys(templates).length - Object.keys(optimized).length
    };
  }

  /**
   * Get storage size
   */
  async getStorageSize() {
    const stats = await fs.stat(this.devflowPath);
    return stats.size;
  }

  /**
   * Migrate old schema
   */
  async migrateIfNeeded() {
    const config = await this.readJson(this.configPath);

    // Check if migration is needed
    if (!config.version) {
      config.version = '1.0.0';
      config.migrated = true;
      config.migratedAt = new Date().toISOString();

      // Add missing fields
      if (!config.createdAt) {
        config.createdAt = new Date().toISOString();
      }
      if (!config.settings) {
        config.settings = {
          maxBackups: 10,
          autoBackup: true,
          watchEnabled: false
        };
      }

      await this.writeJson(this.configPath, config);
      this.emit('migrated', config);
    }
  }

  /**
   * Validate and repair data integrity
   */
  async validateAndRepair() {
    try {
      // Validate config
      const config = await this.readJson(this.configPath);
      if (!config || typeof config !== 'object') {
        await this.initConfig();
      }

      // Validate state
      const state = await this.readJson(this.statePath);
      if (!state || typeof state !== 'object') {
        await this.writeJson(this.statePath, {
          recovered: true,
          recoveredAt: new Date().toISOString()
        });
      }
    } catch (error) {
      // Reinitialize if validation fails
      await this.initConfig();
      await this.writeJson(this.statePath, {
        recovered: true,
        error: error.message,
        recoveredAt: new Date().toISOString()
      });
    }
  }

  // Utility methods

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readJson(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {};
      }
      // Handle corrupted JSON
      return {
        recovered: true,
        error: error.message,
        recoveredAt: new Date().toISOString()
      };
    }
  }

  async writeJson(filePath, data) {
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
  }

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

  hash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async acquireLock() {
    const maxAttempts = 10;
    const delay = 100;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        await fs.writeFile(this.lockFile, process.pid.toString(), { flag: 'wx' });
        return;
      } catch (error) {
        if (error.code === 'EEXIST' && i < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  }

  async releaseLock() {
    try {
      await fs.unlink(this.lockFile);
    } catch {
      // Lock might already be released
    }
  }
}