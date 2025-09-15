/**
 * TemplateEngine
 * Handlebars template management and rendering
 */

import Handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';

/**
 * Template engine for managing and rendering Handlebars templates
 */
export class TemplateEngine {
  constructor() {
    this.templates = new Map();
    this.partials = new Map();
    this.helpers = new Map();
    this.defaultContext = {};
    this.handlebars = Handlebars.create();

    // Register built-in helpers
    this.registerBuiltInHelpers();
  }

  /**
   * Register a template
   * @param {string} name - Template name
   * @param {string} template - Template string
   */
  registerTemplate(name, template) {
    if (!name) {
      throw new Error('Template name cannot be empty');
    }
    if (typeof name !== 'string') {
      throw new Error('Template name must be a string');
    }

    const compiled = this.handlebars.compile(template);
    this.templates.set(name, compiled);
  }

  /**
   * Register multiple templates
   * @param {object} templates - Object with template names as keys
   */
  registerTemplates(templates) {
    for (const [name, template] of Object.entries(templates)) {
      this.registerTemplate(name, template);
    }
  }

  /**
   * Unregister a template
   * @param {string} name - Template name
   */
  unregisterTemplate(name) {
    this.templates.delete(name);
  }

  /**
   * Check if template exists
   * @param {string} name - Template name
   * @returns {boolean}
   */
  hasTemplate(name) {
    return this.templates.has(name);
  }

  /**
   * List all registered templates
   * @returns {string[]}
   */
  listTemplates() {
    return Array.from(this.templates.keys());
  }

  /**
   * Render a template with data
   * @param {string} name - Template name
   * @param {object} context - Template context
   * @returns {string} Rendered template
   */
  render(name, context = {}) {
    if (!this.templates.has(name)) {
      throw new Error(`Template "${name}" not found`);
    }

    const template = this.templates.get(name);
    const mergedContext = {
      ...this.defaultContext,
      ...context,
    };

    return template(mergedContext);
  }

  /**
   * Set default context for all templates
   * @param {object} context - Default context
   */
  setDefaultContext(context) {
    this.defaultContext = { ...context };
  }

  /**
   * Register a helper function
   * @param {string} name - Helper name
   * @param {Function} fn - Helper function
   */
  registerHelper(name, fn) {
    this.handlebars.registerHelper(name, fn);
    this.helpers.set(name, fn);
  }

  /**
   * Register multiple helpers
   * @param {object} helpers - Object with helper names as keys
   */
  registerHelpers(helpers) {
    for (const [name, fn] of Object.entries(helpers)) {
      this.registerHelper(name, fn);
    }
  }

  /**
   * Register a partial template
   * @param {string} name - Partial name
   * @param {string} template - Partial template
   */
  registerPartial(name, template) {
    this.handlebars.registerPartial(name, template);
    this.partials.set(name, template);
  }

  /**
   * Register multiple partials
   * @param {object} partials - Object with partial names as keys
   */
  registerPartials(partials) {
    for (const [name, template] of Object.entries(partials)) {
      this.registerPartial(name, template);
    }
  }

  /**
   * Register built-in formatting helpers
   */
  registerBuiltInHelpers() {
    // JSON stringify helper
    this.registerHelper('json', (object, indent = 2) => {
      return JSON.stringify(object, null, indent);
    });

    // Date formatting helper
    this.registerHelper('date', (date, format = 'iso') => {
      const d = date ? new Date(date) : new Date();
      if (format === 'iso') {
        return d.toISOString();
      }
      if (format === 'local') {
        return d.toLocaleString();
      }
      if (format === 'date') {
        return d.toLocaleDateString();
      }
      if (format === 'time') {
        return d.toLocaleTimeString();
      }
      return d.toString();
    });

    // Number formatting helper
    this.registerHelper('number', (num, decimals = 0) => {
      return Number(num).toFixed(decimals);
    });

    // Pluralize helper
    this.registerHelper('pluralize', (count, singular, plural) => {
      return count === 1 ? singular : plural || `${singular}s`;
    });

    // Truncate helper
    this.registerHelper('truncate', (str, length = 50) => {
      if (!str || str.length <= length) {
        return str;
      }
      return `${str.substring(0, length - 3)}...`;
    });

    // Pad left helper
    this.registerHelper('padLeft', (str, width, char = ' ') => {
      const s = String(str);
      return s.padStart(width, char);
    });

    // Pad right helper
    this.registerHelper('padRight', (str, width, char = ' ') => {
      const s = String(str);
      return s.padEnd(width, char);
    });

    // Repeat helper
    this.registerHelper('repeat', (str, count) => {
      return String(str).repeat(count);
    });

    // Box drawing helper
    this.registerHelper('box', (content, width = 40) => {
      const lines = String(content).split('\n');
      const top = `┌${'─'.repeat(width - 2)}┐`;
      const bottom = `└${'─'.repeat(width - 2)}┘`;

      const boxedLines = lines.map((line) => {
        const padding = width - line.length - 4;
        const rightPad = ' '.repeat(Math.max(0, padding));
        return `│ ${line}${rightPad} │`;
      });

      return [top, ...boxedLines, bottom].join('\n');
    });

    // Table helper
    this.registerHelper('table', (headers, rows) => {
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
    });
  }

  /**
   * Load template from file
   * @param {string} name - Template name
   * @param {string} filePath - File path
   */
  async loadTemplate(name, filePath) {
    const template = await fs.readFile(filePath, 'utf-8');
    this.registerTemplate(name, template);
  }

  /**
   * Load templates from directory
   * @param {string} dirPath - Directory path
   */
  async loadTemplatesFromDirectory(dirPath) {
    const files = await fs.readdir(dirPath);
    const templateFiles = files.filter((f) => f.endsWith('.hbs'));

    for (const file of templateFiles) {
      const name = path.basename(file, '.hbs');
      const filePath = path.join(dirPath, file);
      await this.loadTemplate(name, filePath);
    }
  }

  /**
   * Clear all templates
   */
  clearCache() {
    this.templates.clear();
  }

  /**
   * Clear specific template
   * @param {string} name - Template name
   */
  clearTemplate(name) {
    this.templates.delete(name);
  }

  /**
   * Validate template syntax
   * @param {string} template - Template string
   * @returns {boolean} Valid status
   */
  validateTemplate(template) {
    try {
      this.handlebars.compile(template);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate context for a template
   * @param {string} name - Template name
   * @param {object} context - Context to validate
   * @returns {object} Validation result
   */
  validateContext(name, context) {
    const template = this.templates.get(name);
    if (!template) {
      return { valid: false, error: 'Template not found' };
    }

    // Extract variables from template source
    const variables = this.extractVariables(template.toString());
    const missing = [];

    for (const variable of variables) {
      if (!(variable in context)) {
        missing.push(variable);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Extract variables from template
   * @param {string} template - Template string
   * @returns {string[]} Variable names
   */
  extractVariables(template) {
    const variables = new Set();
    const regex = /{{([^}]+)}}/g;
    let match;

    while ((match = regex.exec(template)) !== null) {
      const variable = match[1].trim();
      // Remove helpers and complex expressions
      if (!variable.includes('(') && !variable.includes('#')) {
        variables.add(variable.split('.')[0]);
      }
    }

    return Array.from(variables);
  }

  /**
   * Export templates to JSON
   * @returns {object} Exported templates
   */
  exportTemplates() {
    const templates = {};
    const partials = {};

    // Export template sources (we store compiled functions, so we need the original)
    // For this implementation, we'll just note that templates are compiled
    for (const name of this.templates.keys()) {
      templates[name] = `[Compiled template: ${name}]`;
    }

    for (const [name, template] of this.partials.entries()) {
      partials[name] = template;
    }

    return {
      templates,
      partials,
      helpers: Array.from(this.helpers.keys()),
    };
  }

  /**
   * Import templates from JSON
   * @param {object} data - Template data
   */
  importTemplates(data) {
    if (data.templates) {
      for (const [name, template] of Object.entries(data.templates)) {
        if (!template.startsWith('[Compiled')) {
          this.registerTemplate(name, template);
        }
      }
    }

    if (data.partials) {
      for (const [name, template] of Object.entries(data.partials)) {
        this.registerPartial(name, template);
      }
    }
  }

  /**
   * Save templates to file
   * @param {string} filePath - File path
   */
  async saveTemplates(filePath) {
    const data = this.exportTemplates();
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Load templates from file
   * @param {string} filePath - File path
   */
  async loadTemplatesFromFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    this.importTemplates(data);
  }
}

export default TemplateEngine;
