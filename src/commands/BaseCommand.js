/**
 * Base Command Class
 * Foundation for all DevFlow commands
 */

export class BaseCommand {
  constructor(options = {}) {
    this.name = options.name || this.constructor.name;
    this.projectRoot = options.projectRoot || process.cwd();
  }

  /**
   * Get command argument schema
   * Override in subclasses to define required/optional args
   */
  getArgSchema() {
    return {
      required: [],
      optional: []
    };
  }

  /**
   * Get command help information
   * Override in subclasses to provide help text
   */
  getHelp() {
    return {
      description: 'Base command',
      usage: `${this.name} [options]`,
      options: {},
      examples: []
    };
  }

  /**
   * Validate arguments against schema
   */
  validateArgs(args, options = {}) {
    const schema = this.getArgSchema();

    // Check required arguments
    for (const required of schema.required) {
      if (!options[required]) {
        throw new Error(`Missing required argument: ${required}`);
      }
    }

    return true;
  }

  /**
   * Parse command line arguments
   */
  parseArgs(args = []) {
    const options = {};
    const positional = [];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        const nextArg = args[i + 1];

        if (nextArg && !nextArg.startsWith('--')) {
          options[key] = nextArg;
          i++;
        } else {
          options[key] = true;
        }
      } else if (arg.startsWith('-')) {
        const key = arg.slice(1);
        options[key] = true;
      } else {
        positional.push(arg);
      }
    }

    return { options, positional };
  }

  /**
   * Execute the command
   * Must be overridden in subclasses
   */
  async execute(args, context = {}) {
    throw new Error('Execute method must be implemented by subclass');
  }

  /**
   * Run the command with validation
   */
  async run(args = [], context = {}) {
    const { options, positional } = this.parseArgs(args);
    const mergedOptions = { ...context, ...options };

    this.validateArgs(positional, mergedOptions);

    return await this.execute(positional, mergedOptions);
  }

  /**
   * Format output for display
   */
  formatOutput(data, format = 'json') {
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else if (format === 'text') {
      return this.formatText(data);
    }
    return data;
  }

  /**
   * Format data as text
   * Override in subclasses for custom formatting
   */
  formatText(data) {
    if (typeof data === 'string') {
      return data;
    }
    return JSON.stringify(data, null, 2);
  }

  /**
   * Log messages with formatting
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }[level] || '•';

    console.log(`${prefix} ${message}`);
  }

  /**
   * Create a progress indicator
   */
  createProgress(label, total) {
    let current = 0;

    return {
      update: (value) => {
        current = value;
        const percentage = Math.round((current / total) * 100);
        process.stdout.write(`\r${label}: [${this.getProgressBar(percentage)}] ${percentage}%`);
      },
      complete: () => {
        console.log(`\n✅ ${label} complete!`);
      }
    };
  }

  /**
   * Get progress bar string
   */
  getProgressBar(percentage) {
    const width = 30;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }
}