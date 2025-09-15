/**
 * Error Handler Utility
 * Provides centralized error handling for DevFlow
 */

import chalk from 'chalk';
import { Logger } from './logger.js';

class ErrorHandler {
  constructor() {
    this.errorCount = 0;
    this.errorLog = [];
  }

  /**
   * Handle an error with appropriate logging and formatting
   * @param {Error} error - The error to handle
   * @param {object} context - Additional context information
   * @returns {object} Formatted error information
   */
  handle(error, context = {}) {
    this.errorCount++;

    const errorInfo = this.format(error, context);
    this.errorLog.push(errorInfo);

    // Log the error
    Logger.error(errorInfo.message, {
      ...errorInfo,
      ...context,
    });

    // Display user-friendly error if in CLI mode
    if (process.env.NODE_ENV !== 'test') {
      this.display(errorInfo);
    }

    return errorInfo;
  }

  /**
   * Format an error for consistent structure
   * @param {Error} error - The error to format
   * @param {object} context - Additional context
   * @returns {object} Formatted error
   */
  format(error, context = {}) {
    const formatted = {
      message: error.message || 'An unknown error occurred',
      type: error.constructor.name,
      code: error.code || 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString(),
      stack: error.stack,
      context,
    };

    // Add any custom error properties
    if (error.details) {
      formatted.details = error.details;
    }

    if (error.suggestion) {
      formatted.suggestion = error.suggestion;
    }

    return formatted;
  }

  /**
   * Display error to the user
   * @param {object} errorInfo - Formatted error information
   */
  display(errorInfo) {
    console.error(`\n${chalk.red.bold('❌ Error:')}`, chalk.red(errorInfo.message));

    if (errorInfo.suggestion) {
      console.error(chalk.yellow('💡 Suggestion:'), errorInfo.suggestion);
    }

    if (errorInfo.details && process.env.DEBUG) {
      console.error(chalk.gray('Details:'), errorInfo.details);
    }

    if (process.env.VERBOSE && errorInfo.stack) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(chalk.gray(errorInfo.stack));
    }
  }

  /**
   * Wrap a function with error handling
   * @param {Function} fn - Function to wrap
   * @param {object} context - Error context
   * @returns {Function} Wrapped function
   */
  wrap(fn, context = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handle(error, {
          ...context,
          function: fn.name || 'anonymous',
          arguments: args,
        });
        throw error;
      }
    };
  }

  /**
   * Create a custom error class
   * @param {string} name - Error class name
   * @param {string} defaultMessage - Default error message
   * @param {string} code - Error code
   * @returns {Function} Error class constructor
   */
  static createErrorClass(name, defaultMessage, code) {
    return class extends Error {
      constructor(message = defaultMessage, details = null) {
        super(message);
        this.name = name;
        this.code = code;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
      }
    };
  }

  /**
   * Check if an error is of a specific type
   * @param {Error} error - Error to check
   * @param {string} code - Error code to match
   * @returns {boolean}
   */
  static isErrorType(error, code) {
    return error && error.code === code;
  }

  /**
   * Get error statistics
   * @returns {object} Error statistics
   */
  getStats() {
    const stats = {
      totalErrors: this.errorCount,
      errorsByType: {},
      recentErrors: this.errorLog.slice(-10),
    };

    for (const error of this.errorLog) {
      stats.errorsByType[error.type] = (stats.errorsByType[error.type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Clear error log
   */
  clearLog() {
    this.errorLog = [];
    this.errorCount = 0;
  }
}

// Custom error classes
const ValidationError = ErrorHandler.createErrorClass(
  'ValidationError',
  'Validation failed',
  'VALIDATION_ERROR'
);

const ConfigurationError = ErrorHandler.createErrorClass(
  'ConfigurationError',
  'Configuration error',
  'CONFIG_ERROR'
);

const DependencyError = ErrorHandler.createErrorClass(
  'DependencyError',
  'Dependency not found',
  'DEPENDENCY_ERROR'
);

const FileSystemError = ErrorHandler.createErrorClass(
  'FileSystemError',
  'File system operation failed',
  'FS_ERROR'
);

const NetworkError = ErrorHandler.createErrorClass(
  'NetworkError',
  'Network operation failed',
  'NETWORK_ERROR'
);

const CommandError = ErrorHandler.createErrorClass(
  'CommandError',
  'Command execution failed',
  'COMMAND_ERROR'
);

// Export singleton instance and error classes
const errorHandler = new ErrorHandler();

export {
  errorHandler as ErrorHandler,
  ValidationError,
  ConfigurationError,
  DependencyError,
  FileSystemError,
  NetworkError,
  CommandError,
};
