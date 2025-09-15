/**
 * Tests for Core Slash Commands System
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';

describe('Command System', () => {
  let CommandRegistry, BaseCommand;
  let registry;

  beforeEach(async () => {
    const commandModule = await import('../../../src/commands/CommandRegistry.js');
    const baseModule = await import('../../../src/commands/BaseCommand.js');

    CommandRegistry = commandModule.CommandRegistry;
    BaseCommand = baseModule.BaseCommand;

    registry = new CommandRegistry();
  });

  describe('Command Registration', () => {
    test('should register and retrieve commands', () => {
      class TestCommand extends BaseCommand {
        execute(args) {
          return { success: true, args };
        }
      }

      registry.register('test', TestCommand);
      const Command = registry.get('test');

      expect(Command).toBe(TestCommand);
    });

    test('should list all registered commands', () => {
      registry.register('cmd1', class extends BaseCommand {});
      registry.register('cmd2', class extends BaseCommand {});
      registry.register('cmd3', class extends BaseCommand {});

      const commands = registry.list();
      expect(commands).toContain('cmd1');
      expect(commands).toContain('cmd2');
      expect(commands).toContain('cmd3');
    });

    test('should validate command names', () => {
      expect(() => {
        registry.register('invalid name', class extends BaseCommand {});
      }).toThrow();

      expect(() => {
        registry.register('valid-name', class extends BaseCommand {});
      }).not.toThrow();
    });
  });

  describe('Command Execution', () => {
    test('should parse and execute commands', async () => {
      class EchoCommand extends BaseCommand {
        async execute(args) {
          return { message: args.join(' ') };
        }
      }

      registry.register('echo', EchoCommand);
      const result = await registry.execute('echo', ['hello', 'world']);

      expect(result.message).toBe('hello world');
    });

    test('should validate arguments', async () => {
      class StrictCommand extends BaseCommand {
        getArgSchema() {
          return {
            required: ['name'],
            optional: ['age'],
          };
        }

        async execute(args, options) {
          return { name: options.name, age: options.age };
        }
      }

      registry.register('strict', StrictCommand);

      await expect(registry.execute('strict', [])).rejects.toThrow();

      const result = await registry.execute('strict', ['--name', 'John']);
      expect(result.name).toBe('John');
    });

    test('should handle command help', async () => {
      class HelpfulCommand extends BaseCommand {
        getHelp() {
          return {
            description: 'A helpful command',
            usage: 'helpful [options]',
            options: {
              '--flag': 'A flag option',
            },
          };
        }

        async execute() {
          return { success: true };
        }
      }

      registry.register('helpful', HelpfulCommand);
      const help = registry.getHelp('helpful');

      expect(help.description).toBe('A helpful command');
      expect(help.usage).toBe('helpful [options]');
    });
  });

  describe('DevFlow Commands', () => {
    let InitCommand, AnalyzeCommand, RoadmapCommand, OptimizeCommand;

    beforeEach(async () => {
      const initModule = await import('../../../src/commands/devflow-init.js');
      const analyzeModule = await import('../../../src/commands/devflow-analyze.js');
      const roadmapModule = await import('../../../src/commands/devflow-roadmap.js');
      const optimizeModule = await import('../../../src/commands/devflow-optimize.js');

      InitCommand = initModule.InitCommand;
      AnalyzeCommand = analyzeModule.AnalyzeCommand;
      RoadmapCommand = roadmapModule.RoadmapCommand;
      OptimizeCommand = optimizeModule.OptimizeCommand;
    });

    test('devflow-init should initialize project', async () => {
      const command = new InitCommand();
      const testDir = `/tmp/test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const result = await command.execute([], { projectRoot: testDir });

      expect(result.success).toBe(true);
      expect(result.message).toContain('initialized');
    });

    test('devflow-analyze should analyze project structure', async () => {
      const command = new AnalyzeCommand();
      const result = await command.execute([], { projectRoot: '/tmp/test' });

      expect(result).toHaveProperty('framework');
      expect(result).toHaveProperty('dependencies');
      expect(result).toHaveProperty('structure');
    });

    test('devflow-roadmap should generate roadmap', async () => {
      const command = new RoadmapCommand();
      const result = await command.execute([], {
        projectRoot: '/tmp/test',
        framework: 'react',
      });

      expect(result).toHaveProperty('phases');
      expect(result.phases.length).toBeGreaterThan(0);
    });

    test('devflow-optimize should suggest optimizations', async () => {
      const command = new OptimizeCommand();
      const result = await command.execute([], {
        projectRoot: '/tmp/test',
        analysis: { framework: 'node' },
      });

      expect(result).toHaveProperty('suggestions');
      expect(Array.isArray(result.suggestions)).toBe(true);
    });
  });

  describe('Command Pipeline', () => {
    test('should support command chaining', async () => {
      class Step1Command extends BaseCommand {
        async execute(args, context) {
          return { ...context, step1: true };
        }
      }

      class Step2Command extends BaseCommand {
        async execute(args, context) {
          return { ...context, step2: true };
        }
      }

      registry.register('step1', Step1Command);
      registry.register('step2', Step2Command);

      const result = await registry.pipeline([
        { command: 'step1', args: [] },
        { command: 'step2', args: [] },
      ]);

      expect(result.step1).toBe(true);
      expect(result.step2).toBe(true);
    });
  });
});
