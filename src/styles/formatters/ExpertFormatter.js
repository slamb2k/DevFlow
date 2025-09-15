/**
 * ExpertFormatter
 * Concise technical output formatter
 */

import { BaseFormatter } from './BaseFormatter.js';

/**
 * Expert style formatter - concise and technical
 */
export class ExpertFormatter extends BaseFormatter {
  constructor() {
    super('expert', {
      verbose: false,
      includeExamples: false,
      includeExplanations: false,
      colors: false,
    });
  }

  /**
   * Format data in expert style
   * @param {any} data - Data to format
   * @param {object} options - Formatting options
   * @returns {string} Formatted output
   */
  format(data, options = {}) {
    if (!data) {
      return '';
    }

    const opts = this.mergeOptions(options);
    const sections = [];

    // Command output
    if (data.command) {
      sections.push(data.command);
      if (data.options && Array.isArray(data.options)) {
        sections[0] += ` ${data.options.join(' ')}`;
      }
      if (data.output) {
        sections.push(data.output);
      }
      return sections.join('\n');
    }

    // Error format
    if (data.error) {
      const errorLine =
        data.file && data.line ? `${data.file}:${data.line}: ${data.error}` : data.error;
      sections.push(errorLine);
      if (data.stack && opts.verbose) {
        sections.push(data.stack);
      }
      return sections.join('\n');
    }

    // Config format
    if (data.config) {
      return this.formatConfig(data.config);
    }

    // Code snippet
    if (data.code) {
      const language = data.language || 'javascript';
      sections.push(`\`\`\`${language}`);
      sections.push(data.code);
      sections.push('```');
      return sections.join('\n');
    }

    // Files list
    if (data.files && Array.isArray(data.files)) {
      return data.files.join('\n');
    }

    // Results or data
    if (data.results) {
      return this.formatResults(data.results);
    }

    // Status
    if (data.status !== undefined) {
      const status = data.status;
      const message = data.message || '';
      return message ? `${status}: ${message}` : String(status);
    }

    // Metrics
    if (data.metrics) {
      return this.formatMetrics(data.metrics);
    }

    // List format
    if (Array.isArray(data)) {
      return data.map((item) => this.formatValue(item)).join('\n');
    }

    // Object format
    if (typeof data === 'object' && data !== null) {
      return this.formatObject(data, opts);
    }

    // Simple value
    return String(data);
  }

  /**
   * Format configuration object
   * @private
   * @param {object} config - Configuration object
   * @returns {string} Formatted config
   */
  formatConfig(config) {
    const lines = [];
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        lines.push(`${key}:`);
        for (const [subKey, subValue] of Object.entries(value)) {
          lines.push(`  ${subKey}: ${this.formatValue(subValue)}`);
        }
      } else {
        lines.push(`${key}: ${this.formatValue(value)}`);
      }
    }
    return lines.join('\n');
  }

  /**
   * Format results array or object
   * @private
   * @param {any} results - Results to format
   * @returns {string} Formatted results
   */
  formatResults(results) {
    if (Array.isArray(results)) {
      return results.map((r) => this.formatValue(r)).join('\n');
    }
    if (typeof results === 'object' && results !== null) {
      return this.formatObject(results);
    }
    return String(results);
  }

  /**
   * Format metrics object
   * @private
   * @param {object} metrics - Metrics to format
   * @returns {string} Formatted metrics
   */
  formatMetrics(metrics) {
    const lines = [];
    for (const [key, value] of Object.entries(metrics)) {
      lines.push(`${key}: ${value}`);
    }
    return lines.join('\n');
  }

  /**
   * Format a generic object
   * @private
   * @param {object} obj - Object to format
   * @param {object} options - Formatting options
   * @returns {string} Formatted object
   */
  formatObject(obj, options = {}) {
    const lines = [];
    const entries = Object.entries(obj);

    // For small objects, use inline format
    if (entries.length <= 3 && !options.verbose) {
      const pairs = entries.map(([k, v]) => `${k}: ${this.formatValue(v)}`);
      return pairs.join(', ');
    }

    // For larger objects, use line-by-line format
    for (const [key, value] of entries) {
      if (value === null || value === undefined) {
        continue; // Skip null/undefined values
      }

      if (Array.isArray(value)) {
        if (value.length === 0) {
          continue; // Skip empty arrays
        }
        if (value.length <= 3) {
          lines.push(`${key}: [${value.join(', ')}]`);
        } else {
          lines.push(`${key}:`);
          value.forEach((item) => {
            lines.push(`  ${this.formatValue(item)}`);
          });
        }
      } else if (typeof value === 'object' && value !== null) {
        lines.push(`${key}: ${JSON.stringify(value)}`);
      } else {
        lines.push(`${key}: ${this.formatValue(value)}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format a single value
   * @private
   * @param {any} value - Value to format
   * @returns {string} Formatted value
   */
  formatValue(value) {
    if (value === null) {
      return 'null';
    }
    if (value === undefined) {
      return 'undefined';
    }
    if (typeof value === 'boolean') {
      return String(value);
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      return `[${value.length} items]`;
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      return `{${keys.length} fields}`;
    }
    return String(value);
  }
}

export default ExpertFormatter;
