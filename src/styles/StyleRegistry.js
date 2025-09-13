/**
 * StyleRegistry
 * Manages output style formatters and selection logic
 */

import EventEmitter from 'events';
import { BaseFormatter } from './formatters/BaseFormatter.js';

/**
 * Registry for managing output style formatters
 */
export class StyleRegistry extends EventEmitter {
  constructor() {
    super();
    this.styles = new Map();
    this.defaultStyle = null;
    this.contextMappings = [];
  }

  /**
   * Register a style formatter
   * @param {string} name - Style name
   * @param {BaseFormatter} formatter - Formatter instance
   */
  register(name, formatter) {
    if (!name || typeof name !== 'string') {
      throw new Error('Style name must be a non-empty string');
    }

    if (this.styles.has(name)) {
      throw new Error(`Style "${name}" is already registered`);
    }

    if (!(formatter instanceof BaseFormatter)) {
      throw new Error('Formatter must extend BaseFormatter class');
    }

    this.styles.set(name, formatter);
    this.emit('style:registered', name);
  }

  /**
   * Unregister a style
   * @param {string} name - Style name
   * @returns {boolean} Success status
   */
  unregister(name) {
    if (!this.styles.has(name)) {
      return false;
    }

    this.styles.delete(name);

    if (this.defaultStyle === name) {
      this.defaultStyle = null;
    }

    // Remove context mappings for this style
    this.contextMappings = this.contextMappings.filter(
      mapping => mapping.style !== name
    );

    this.emit('style:unregistered', name);
    return true;
  }

  /**
   * Check if a style is registered
   * @param {string} name - Style name
   * @returns {boolean}
   */
  has(name) {
    return this.styles.has(name);
  }

  /**
   * Get a formatter by name
   * @param {string} name - Style name
   * @returns {BaseFormatter}
   */
  get(name) {
    return this.styles.get(name);
  }

  /**
   * List all registered styles
   * @returns {string[]}
   */
  list() {
    return Array.from(this.styles.keys());
  }

  /**
   * Set the default style
   * @param {string} name - Style name
   */
  setDefault(name) {
    if (!this.styles.has(name)) {
      throw new Error(`Style "${name}" is not registered`);
    }
    this.defaultStyle = name;
  }

  /**
   * Get the default style
   * @returns {string|null}
   */
  getDefault() {
    return this.defaultStyle;
  }

  /**
   * Map a context to a style
   * @param {object} context - Context criteria
   * @param {string} styleName - Style to use for this context
   */
  mapContext(context, styleName) {
    if (!this.styles.has(styleName)) {
      throw new Error(`Style "${styleName}" is not registered`);
    }

    this.contextMappings.push({
      context,
      style: styleName
    });
  }

  /**
   * Select a style based on context
   * @param {object} context - Current context
   * @returns {string} Selected style name
   */
  selectStyle(context = {}) {
    // Explicit style preference takes priority
    if (context.style && this.styles.has(context.style)) {
      return context.style;
    }

    // Check context mappings
    for (const mapping of this.contextMappings) {
      if (this.matchesContext(context, mapping.context)) {
        return mapping.style;
      }
    }

    // Fall back to default
    if (this.defaultStyle) {
      return this.defaultStyle;
    }

    // Return first registered style as last resort
    const firstStyle = this.list()[0];
    if (firstStyle) {
      return firstStyle;
    }

    throw new Error('No styles registered');
  }

  /**
   * Check if context matches criteria
   * @private
   * @param {object} context - Current context
   * @param {object} criteria - Criteria to match
   * @returns {boolean}
   */
  matchesContext(context, criteria) {
    for (const [key, value] of Object.entries(criteria)) {
      if (context[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Format data using selected style
   * @param {any} data - Data to format
   * @param {object} options - Formatting options
   * @returns {string} Formatted output
   */
  format(data, options = {}) {
    const styleName = options.style || this.selectStyle(options);

    if (!this.styles.has(styleName)) {
      const error = new Error(`Style "${styleName}" is not registered`);
      this.emit('format:error', { style: styleName, error });
      throw error;
    }

    this.emit('format:start', { style: styleName, data });

    const formatter = this.styles.get(styleName);

    // Remove style from options before passing to formatter
    const formatterOptions = { ...options };
    delete formatterOptions.style;

    try {
      const result = formatter.format(data, formatterOptions);
      this.emit('format:complete', { style: styleName, result });
      return result;
    } catch (error) {
      this.emit('format:error', { style: styleName, error });
      throw error;
    }
  }

  /**
   * Format data asynchronously
   * @param {any} data - Data to format
   * @param {object} options - Formatting options
   * @returns {Promise<string>} Formatted output
   */
  async formatAsync(data, options = {}) {
    const styleName = options.style || this.selectStyle(options);

    if (!this.styles.has(styleName)) {
      const error = new Error(`Style "${styleName}" is not registered`);
      this.emit('format:error', { style: styleName, error });
      throw error;
    }

    this.emit('format:start', { style: styleName, data });

    const formatter = this.styles.get(styleName);

    // Remove style from options before passing to formatter
    const formatterOptions = { ...options };
    delete formatterOptions.style;

    try {
      const result = await formatter.format(data, formatterOptions);
      this.emit('format:complete', { style: styleName, result });
      return result;
    } catch (error) {
      this.emit('format:error', { style: styleName, error });
      throw error;
    }
  }

  /**
   * Export configuration
   * @returns {object} Registry configuration
   */
  exportConfig() {
    return {
      defaultStyle: this.defaultStyle,
      registeredStyles: this.list(),
      contextMappings: this.contextMappings.map(m => ({ ...m }))
    };
  }

  /**
   * Import configuration
   * @param {object} config - Configuration to import
   */
  importConfig(config) {
    if (config.defaultStyle && this.styles.has(config.defaultStyle)) {
      this.defaultStyle = config.defaultStyle;
    }

    if (config.contextMappings) {
      for (const mapping of config.contextMappings) {
        if (this.styles.has(mapping.style)) {
          this.contextMappings.push({
            context: { ...mapping.context },
            style: mapping.style
          });
        }
      }
    }
  }

  /**
   * Clear all registrations
   */
  clear() {
    this.styles.clear();
    this.defaultStyle = null;
    this.contextMappings = [];
    this.emit('registry:cleared');
  }
}

export default StyleRegistry;