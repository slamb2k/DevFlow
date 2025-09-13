/**
 * Command Registry
 * Manages command registration and execution
 */

import { BaseCommand } from './BaseCommand.js';

export class CommandRegistry {
  constructor() {
    this.commands = new Map();
    this.aliases = new Map();
  }

  /**
   * Register a command
   */
  register(name, CommandClass, options = {}) {
    // Validate command name
    if (!name || !/^[a-z0-9-]+$/.test(name)) {
      throw new Error(`Invalid command name: ${name}`);
    }

    // Validate command class
    if (!CommandClass || !(CommandClass.prototype instanceof BaseCommand)) {
      throw new Error('Command must extend BaseCommand');
    }

    this.commands.set(name, CommandClass);

    // Register aliases
    if (options.aliases) {
      for (const alias of options.aliases) {
        this.aliases.set(alias, name);
      }
    }

    return this;
  }

  /**
   * Get a command class
   */
  get(name) {
    // Check for alias
    const commandName = this.aliases.get(name) || name;
    return this.commands.get(commandName);
  }

  /**
   * Check if command exists
   */
  has(name) {
    return this.commands.has(name) || this.aliases.has(name);
  }

  /**
   * List all registered commands
   */
  list() {
    return Array.from(this.commands.keys());
  }

  /**
   * Execute a command
   */
  async execute(name, args = [], context = {}) {
    const CommandClass = this.get(name);

    if (!CommandClass) {
      throw new Error(`Command not found: ${name}`);
    }

    const command = new CommandClass({ name, projectRoot: context.projectRoot });
    return await command.run(args, context);
  }

  /**
   * Get command help
   */
  getHelp(name) {
    const CommandClass = this.get(name);

    if (!CommandClass) {
      throw new Error(`Command not found: ${name}`);
    }

    const command = new CommandClass({ name });
    return command.getHelp();
  }

  /**
   * Get help for all commands
   */
  getAllHelp() {
    const help = {};

    for (const [name, CommandClass] of this.commands) {
      const command = new CommandClass({ name });
      help[name] = command.getHelp();
    }

    return help;
  }

  /**
   * Execute a pipeline of commands
   */
  async pipeline(steps, initialContext = {}) {
    let context = { ...initialContext };

    for (const step of steps) {
      const { command, args = [] } = step;
      context = await this.execute(command, args, context);
    }

    return context;
  }

  /**
   * Parse command string
   */
  parse(commandString) {
    const parts = commandString.trim().split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    return { command, args };
  }

  /**
   * Execute command from string
   */
  async executeString(commandString, context = {}) {
    const { command, args } = this.parse(commandString);
    return await this.execute(command, args, context);
  }

  /**
   * Create command dispatcher for slash commands
   */
  createDispatcher() {
    return async (input, context = {}) => {
      // Handle slash commands
      if (input.startsWith('/')) {
        const commandString = input.slice(1);
        return await this.executeString(commandString, context);
      }

      throw new Error('Invalid command format. Commands must start with /');
    };
  }

  /**
   * Load built-in commands
   */
  async loadBuiltinCommands() {
    const { InitCommand } = await import('./devflow-init.js');
    const { AnalyzeCommand } = await import('./devflow-analyze.js');
    const { RoadmapCommand } = await import('./devflow-roadmap.js');
    const { OptimizeCommand } = await import('./devflow-optimize.js');

    this.register('devflow-init', InitCommand, { aliases: ['init'] });
    this.register('devflow-analyze', AnalyzeCommand, { aliases: ['analyze'] });
    this.register('devflow-roadmap', RoadmapCommand, { aliases: ['roadmap'] });
    this.register('devflow-optimize', OptimizeCommand, { aliases: ['optimize'] });

    return this;
  }
}