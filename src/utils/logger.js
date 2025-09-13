/**
 * Logger Utility
 * Provides structured logging for DevFlow with rich formatting
 */

import chalk from 'chalk';
import winston from 'winston';
import path from 'path';
import fs from 'fs-extra';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
fs.ensureDirSync(logsDir);

// Custom log levels with colors
const logLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    verbose: 4
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'cyan',
    debug: 'gray',
    verbose: 'magenta'
  }
};

// Console format with colors
const consoleFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const colorize = {
    error: chalk.red,
    warn: chalk.yellow,
    info: chalk.cyan,
    debug: chalk.gray,
    verbose: chalk.magenta
  };

  const icon = {
    error: '❌',
    warn: '⚠️',
    info: 'ℹ️',
    debug: '🔍',
    verbose: '📝'
  };

  const color = colorize[level] || chalk.white;
  const prefix = `${icon[level] || '•'} ${color.bold(level.toUpperCase())}`;

  let output = `${prefix} ${message}`;

  // Add metadata if present
  if (Object.keys(meta).length > 0 && process.env.DEBUG) {
    output += chalk.gray(`\n  ${JSON.stringify(meta, null, 2)}`);
  }

  return output;
});

// File format (JSON)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Create Winston logger
const winstonLogger = winston.createLogger({
  levels: logLevels.levels,
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.metadata()
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
      silent: process.env.NODE_ENV === 'test'
    }),
    // File transport for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'devflow.log'),
      format: fileFormat
    })
  ]
});

// Add colors to winston
winston.addColors(logLevels.colors);

/**
 * Logger class with enhanced functionality
 */
class Logger {
  constructor() {
    this.winston = winstonLogger;
    this.timers = new Map();
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  info(message, meta = {}) {
    this.winston.info(message, meta);
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {object} meta - Additional metadata
   */
  error(message, meta = {}) {
    this.winston.error(message, meta);
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    this.winston.warn(message, meta);
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    this.winston.debug(message, meta);
  }

  /**
   * Log verbose message
   * @param {string} message - Verbose message
   * @param {object} meta - Additional metadata
   */
  verbose(message, meta = {}) {
    this.winston.verbose(message, meta);
  }

  /**
   * Log success message with green color
   * @param {string} message - Success message
   * @param {object} meta - Additional metadata
   */
  success(message, meta = {}) {
    if (process.env.NODE_ENV !== 'test') {
      console.log(chalk.green.bold('✅ SUCCESS'), chalk.green(message));
    }
    this.winston.info(`SUCCESS: ${message}`, meta);
  }

  /**
   * Start a timer for performance measurement
   * @param {string} label - Timer label
   */
  time(label) {
    this.timers.set(label, Date.now());
    this.debug(`Timer started: ${label}`);
  }

  /**
   * End a timer and log the duration
   * @param {string} label - Timer label
   */
  timeEnd(label) {
    const start = this.timers.get(label);
    if (!start) {
      this.warn(`Timer not found: ${label}`);
      return;
    }

    const duration = Date.now() - start;
    this.timers.delete(label);

    const message = `${label}: ${duration}ms`;
    this.info(message, { duration, label });

    return duration;
  }

  /**
   * Create a child logger with additional metadata
   * @param {object} defaultMeta - Default metadata for child logger
   * @returns {object} Child logger
   */
  child(defaultMeta) {
    return {
      info: (msg, meta = {}) => this.info(msg, { ...defaultMeta, ...meta }),
      error: (msg, meta = {}) => this.error(msg, { ...defaultMeta, ...meta }),
      warn: (msg, meta = {}) => this.warn(msg, { ...defaultMeta, ...meta }),
      debug: (msg, meta = {}) => this.debug(msg, { ...defaultMeta, ...meta }),
      verbose: (msg, meta = {}) => this.verbose(msg, { ...defaultMeta, ...meta }),
      success: (msg, meta = {}) => this.success(msg, { ...defaultMeta, ...meta })
    };
  }

  /**
   * Log a divider line
   * @param {string} char - Character to use for divider
   * @param {number} length - Length of divider
   */
  divider(char = '─', length = 50) {
    if (process.env.NODE_ENV !== 'test') {
      console.log(chalk.gray(char.repeat(length)));
    }
  }

  /**
   * Log a header with formatting
   * @param {string} title - Header title
   */
  header(title) {
    if (process.env.NODE_ENV !== 'test') {
      this.divider();
      console.log(chalk.bold.blue(title));
      this.divider();
    }
    this.info(`=== ${title} ===`);
  }

  /**
   * Log a table
   * @param {array} data - Table data
   * @param {object} options - Table options
   */
  table(data, options = {}) {
    if (process.env.NODE_ENV !== 'test') {
      console.table(data, options.columns);
    }
    this.info('Table data', { data, options });
  }

  /**
   * Create a progress logger
   * @param {string} label - Progress label
   * @param {number} total - Total items
   * @returns {object} Progress logger
   */
  progress(label, total) {
    let current = 0;

    return {
      update: (increment = 1) => {
        current += increment;
        const percentage = Math.round((current / total) * 100);
        this.info(`${label}: ${current}/${total} (${percentage}%)`, {
          label,
          current,
          total,
          percentage
        });
      },
      complete: () => {
        this.success(`${label}: Complete!`, { label, total });
      }
    };
  }

  /**
   * Set log level
   * @param {string} level - Log level
   */
  setLevel(level) {
    this.winston.level = level;
    this.info(`Log level set to: ${level}`);
  }

  /**
   * Get current log level
   * @returns {string} Current log level
   */
  getLevel() {
    return this.winston.level;
  }
}

// Export singleton instance
const logger = new Logger();

export {
  logger as Logger,
  logger
};

export const createLogger = (defaultMeta) => logger.child(defaultMeta);