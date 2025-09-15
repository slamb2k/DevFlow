/**
 * Tests for Project Memory System
 * Handles persistent state management in .devflow/ directory
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ProjectMemory', () => {
  let ProjectMemory;
  let testDir;
  let memory;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `devflow-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Import ProjectMemory (will be implemented)
    const module = await import('../../../src/core/memory/ProjectMemory.js');
    ProjectMemory = module.ProjectMemory;

    // Create instance with test directory
    memory = new ProjectMemory(testDir);
  });

  afterEach(async () => {
    // Cleanup test directory
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  describe('Initialization', () => {
    test('should create .devflow directory if it does not exist', async () => {
      await memory.init();

      const devflowPath = path.join(testDir, '.devflow');
      const exists = await fs
        .access(devflowPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);
    });

    test('should create default config.json if not present', async () => {
      await memory.init();

      const configPath = path.join(testDir, '.devflow', 'config.json');
      const exists = await fs
        .access(configPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);

      const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      expect(config).toHaveProperty('version');
      expect(config).toHaveProperty('projectName');
      expect(config).toHaveProperty('createdAt');
    });

    test('should preserve existing configuration', async () => {
      const devflowPath = path.join(testDir, '.devflow');
      await fs.mkdir(devflowPath, { recursive: true });

      const existingConfig = {
        version: '1.0.0',
        projectName: 'test-project',
        customField: 'preserved',
      };

      await fs.writeFile(
        path.join(devflowPath, 'config.json'),
        JSON.stringify(existingConfig, null, 2)
      );

      await memory.init();

      const config = await memory.getConfig();
      expect(config.customField).toBe('preserved');
      expect(config.projectName).toBe('test-project');
    });
  });

  describe('State Management', () => {
    beforeEach(async () => {
      await memory.init();
    });

    test('should save and retrieve state', async () => {
      const state = {
        currentPhase: 'foundation',
        completedTasks: ['task-1'],
        timestamp: new Date().toISOString(),
      };

      await memory.setState(state);
      const retrieved = await memory.getState();

      expect(retrieved).toEqual(state);
    });

    test('should merge state updates', async () => {
      const initialState = {
        phase: 'one',
        tasks: ['task-1'],
        metadata: { version: '1.0' },
      };

      await memory.setState(initialState);

      const update = {
        tasks: ['task-1', 'task-2'],
        metadata: { version: '1.1', author: 'test' },
      };

      await memory.updateState(update);

      const state = await memory.getState();
      expect(state.phase).toBe('one');
      expect(state.tasks).toEqual(['task-1', 'task-2']);
      expect(state.metadata).toEqual({ version: '1.1', author: 'test' });
    });

    test('should handle concurrent state updates safely', async () => {
      const updates = [];

      // Simulate concurrent updates
      for (let i = 0; i < 10; i++) {
        updates.push(memory.updateState({ counter: i, [`field${i}`]: true }));
      }

      await Promise.all(updates);

      const state = await memory.getState();
      expect(typeof state.counter).toBe('number');
      expect(Object.keys(state).filter((k) => k.startsWith('field')).length).toBeGreaterThan(0);
    });
  });

  describe('Template Management', () => {
    beforeEach(async () => {
      await memory.init();
    });

    test('should save and retrieve templates', async () => {
      const template = {
        name: 'react-component',
        content: 'export const Component = () => {}',
        metadata: { framework: 'react' },
      };

      await memory.saveTemplate('react-component', template);
      const retrieved = await memory.getTemplate('react-component');

      expect(retrieved).toEqual(template);
    });

    test('should list all templates', async () => {
      await memory.saveTemplate('template1', { name: 'template1' });
      await memory.saveTemplate('template2', { name: 'template2' });
      await memory.saveTemplate('template3', { name: 'template3' });

      const templates = await memory.listTemplates();

      expect(templates).toHaveLength(3);
      expect(templates).toContain('template1');
      expect(templates).toContain('template2');
      expect(templates).toContain('template3');
    });

    test('should delete templates', async () => {
      await memory.saveTemplate('to-delete', { name: 'test' });

      let templates = await memory.listTemplates();
      expect(templates).toContain('to-delete');

      await memory.deleteTemplate('to-delete');

      templates = await memory.listTemplates();
      expect(templates).not.toContain('to-delete');
    });
  });

  describe('Backup and Recovery', () => {
    beforeEach(async () => {
      await memory.init();
    });

    test('should create backup of current state', async () => {
      const state = { important: 'data', timestamp: Date.now() };
      await memory.setState(state);

      const backupId = await memory.createBackup();

      expect(backupId).toBeDefined();
      expect(typeof backupId).toBe('string');

      const backups = await memory.listBackups();
      expect(backups).toContain(backupId);
    });

    test('should restore from backup', async () => {
      const originalState = { version: 1, data: 'original' };
      await memory.setState(originalState);

      const backupId = await memory.createBackup();

      // Modify state
      await memory.setState({ version: 2, data: 'modified' });

      // Restore from backup
      await memory.restoreBackup(backupId);

      const restoredState = await memory.getState();
      expect(restoredState).toEqual(originalState);
    });

    test('should limit number of backups', async () => {
      // Create more backups than the limit
      for (let i = 0; i < 12; i++) {
        await memory.setState({ iteration: i });
        await memory.createBackup();
      }

      const backups = await memory.listBackups();
      expect(backups.length).toBeLessThanOrEqual(10); // Default max backups
    });
  });

  describe('Migration', () => {
    test('should migrate from old schema to new schema', async () => {
      // Create old format data
      const devflowPath = path.join(testDir, '.devflow');
      await fs.mkdir(devflowPath, { recursive: true });

      const oldData = {
        projectName: 'legacy-project',
        tasks: ['task1', 'task2'],
        // Missing version field
      };

      await fs.writeFile(path.join(devflowPath, 'config.json'), JSON.stringify(oldData));

      await memory.init();

      const config = await memory.getConfig();
      expect(config.version).toBeDefined(); // Should have added version
      expect(config.projectName).toBe('legacy-project'); // Should preserve data
      expect(config.migrated).toBe(true); // Should mark as migrated
    });
  });

  describe('File Watching', () => {
    beforeEach(async () => {
      await memory.init();
    });

    test('should detect external changes to config', async () => {
      const watcher = memory.watch();

      let changeDetected = false;
      watcher.on('change', (file) => {
        if (file === 'config.json') {
          changeDetected = true;
        }
      });

      // Simulate external change
      const configPath = path.join(testDir, '.devflow', 'config.json');
      const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      config.externalChange = true;
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      // Wait for change detection
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(changeDetected).toBe(true);

      watcher.close();
    });

    test('should reload state on external changes', async () => {
      await memory.setState({ value: 'initial' });

      const watcher = memory.watch({ autoReload: true });

      // Simulate external change
      const statePath = path.join(testDir, '.devflow', 'state.json');
      await fs.writeFile(statePath, JSON.stringify({ value: 'external' }, null, 2));

      // Wait for reload
      await new Promise((resolve) => setTimeout(resolve, 100));

      const state = await memory.getState();
      expect(state.value).toBe('external');

      watcher.close();
    });
  });

  describe('Cleanup and Optimization', () => {
    beforeEach(async () => {
      await memory.init();
    });

    test('should clean up old backups', async () => {
      // Create old backups
      const backupsDir = path.join(testDir, '.devflow', 'backups');
      await fs.mkdir(backupsDir, { recursive: true });

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31); // 31 days old

      await fs.writeFile(
        path.join(backupsDir, `backup-${oldDate.getTime()}.json`),
        JSON.stringify({})
      );

      await memory.cleanup({ maxAge: 30 }); // 30 days max

      const backups = await memory.listBackups();
      expect(backups.length).toBe(0);
    });

    test('should optimize storage by removing duplicates', async () => {
      // Save identical templates with different names
      const template = { content: 'identical', hash: 'abc123' };

      await memory.saveTemplate('template1', template);
      await memory.saveTemplate('template2', template);
      await memory.saveTemplate('template3', template);

      const sizeBefore = await memory.getStorageSize();

      await memory.optimize();

      const sizeAfter = await memory.getStorageSize();
      expect(sizeAfter).toBeLessThanOrEqual(sizeBefore);
    });
  });

  describe('Error Handling', () => {
    test('should handle corrupted JSON gracefully', async () => {
      const devflowPath = path.join(testDir, '.devflow');
      await fs.mkdir(devflowPath, { recursive: true });

      // Write corrupted JSON
      await fs.writeFile(path.join(devflowPath, 'state.json'), '{ invalid json }');

      await memory.init();

      // Should recover with default state
      const state = await memory.getState();
      expect(state).toBeDefined();
      expect(state.recovered).toBe(true);
    });

    test('should handle permission errors', async () => {
      // Skip on Windows where chmod doesn't work the same
      if (process.platform === 'win32') {
        return;
      }

      await memory.init();

      const devflowPath = path.join(testDir, '.devflow');
      await fs.chmod(devflowPath, 0o444); // Read-only

      await expect(memory.setState({ test: 'data' })).rejects.toThrow();

      // Restore permissions for cleanup
      await fs.chmod(devflowPath, 0o755);
    });
  });
});
