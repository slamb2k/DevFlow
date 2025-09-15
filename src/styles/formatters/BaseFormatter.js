/**
 * BaseFormatter
 * Base class for all output style formatters
 */

/**
 * Abstract base class for output formatters
 */
export class BaseFormatter {
  /**
   * Create a formatter
   * @param {string} name - Formatter name
   * @param {object} options - Default options
   */
  constructor(name, options = {}) {
    if (!name) {
      throw new Error('Formatter name is required');
    }

    this.name = name;
    this.options = options;
    this.isAsyncFormatter = false;
    this.template = null;
  }

  /**
   * Format data (to be overridden by subclasses)
   * @param {any} data - Data to format
   * @param {object} options - Formatting options
   * @returns {string} Formatted output
   */
  format(data, _options = {}) {
    // Default implementation - JSON stringify
    if (data === null || data === undefined) {
      return '';
    }

    if (typeof data === 'string') {
      return data;
    }

    try {
      return JSON.stringify(data, null, 2);
    } catch (error) {
      // Handle circular references
      return JSON.stringify(data, this.getCircularReplacer(), 2);
    }
  }

  /**
   * Validate formatter options
   * @param {object} options - Options to validate
   * @returns {object} Validation result
   */
  validateOptions(_options) {
    return {
      valid: true,
      errors: [],
    };
  }

  /**
   * Merge options with defaults
   * @param {object} options - Options to merge
   * @returns {object} Merged options
   */
  mergeOptions(options) {
    return {
      ...this.options,
      ...options,
    };
  }

  /**
   * Render a template with data
   * @param {object} data - Template data
   * @returns {string} Rendered template
   */
  renderTemplate(data) {
    if (!this.template) {
      return '';
    }

    let result = this.template;
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }

  /**
   * Helper to handle circular references
   * @private
   * @returns {Function} Replacer function
   */
  getCircularReplacer() {
    const seen = new WeakSet();
    return (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      return value;
    };
  }

  /**
   * Apply color to text (if colors enabled)
   * @protected
   * @param {string} text - Text to color
   * @param {string} color - Color name
   * @param {object} options - Formatting options
   * @returns {string} Colored text
   */
  applyColor(text, color, options = {}) {
    if (!options.colors) {
      return text;
    }

    const colors = {
      reset: '\x1b[0m',
      bold: '\x1b[1m',
      dim: '\x1b[2m',
      underline: '\x1b[4m',

      // Text colors
      black: '\x1b[30m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m',
      gray: '\x1b[90m',

      // Background colors
      bgRed: '\x1b[41m',
      bgGreen: '\x1b[42m',
      bgYellow: '\x1b[43m',
      bgBlue: '\x1b[44m',
    };

    const colorCode = colors[color] || '';
    const resetCode = colors.reset;

    return colorCode ? `${colorCode}${text}${resetCode}` : text;
  }

  /**
   * Create a box around text
   * @protected
   * @param {string} text - Text to box
   * @param {object} options - Box options
   * @returns {string} Boxed text
   */
  createBox(text, options = {}) {
    const lines = text.split('\n');
    const maxLength = Math.max(...lines.map((l) => l.length));
    const width = options.width || maxLength + 4;

    const top = `┌${'─'.repeat(width - 2)}┐`;
    const bottom = `└${'─'.repeat(width - 2)}┘`;

    const boxedLines = lines.map((line) => {
      const padding = width - line.length - 4;
      const rightPad = ' '.repeat(Math.max(0, padding));
      return `│ ${line}${rightPad} │`;
    });

    return [top, ...boxedLines, bottom].join('\n');
  }

  /**
   * Create a simple table
   * @protected
   * @param {string[]} headers - Table headers
   * @param {Array<Array>} rows - Table rows
   * @returns {string} Formatted table
   */
  createTable(headers, rows) {
    if (!headers || !rows) {
      return '';
    }

    // Calculate column widths
    const widths = headers.map((h, i) => {
      const headerWidth = h.length;
      const maxRowWidth = Math.max(...rows.map((r) => String(r[i] || '').length));
      return Math.max(headerWidth, maxRowWidth);
    });

    // Create separator
    const separator = `├${widths.map((w) => '─'.repeat(w + 2)).join('┼')}┤`;
    const top = `┌${widths.map((w) => '─'.repeat(w + 2)).join('┬')}┐`;
    const bottom = `└${widths.map((w) => '─'.repeat(w + 2)).join('┴')}┘`;

    // Format header
    const headerRow = `│${headers.map((h, i) => ` ${h.padEnd(widths[i])} `).join('│')}│`;

    // Format rows
    const dataRows = rows.map(
      (row) => `│${row.map((cell, i) => ` ${String(cell || '').padEnd(widths[i])} `).join('│')}│`
    );

    return [top, headerRow, separator, ...dataRows, bottom].join('\n');
  }

  /**
   * Truncate text to specified length
   * @protected
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  truncate(text, maxLength) {
    if (!text || text.length <= maxLength) {
      return text;
    }
    return `${text.substring(0, maxLength - 3)}...`;
  }

  /**
   * Indent text
   * @protected
   * @param {string} text - Text to indent
   * @param {number} spaces - Number of spaces
   * @returns {string} Indented text
   */
  indent(text, spaces = 2) {
    const indentation = ' '.repeat(spaces);
    return text
      .split('\n')
      .map((line) => indentation + line)
      .join('\n');
  }
}

export default BaseFormatter;
