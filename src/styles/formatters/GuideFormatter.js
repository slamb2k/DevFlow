/**
 * GuideFormatter
 * Step-by-step educational output formatter
 */

import { BaseFormatter } from './BaseFormatter.js';

/**
 * Guide style formatter - patient and educational
 */
export class GuideFormatter extends BaseFormatter {
  constructor() {
    super('guide', {
      verbose: true,
      includeExamples: true,
      includeExplanations: true,
      colors: true
    });
  }

  /**
   * Format data in guide style
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

    // Add header with icon
    sections.push(this.applyColor('📖 Guide: ', 'cyan', opts));

    // Title
    if (data.title) {
      sections.push(this.applyColor(data.title, 'bold', opts));
      sections.push('');
    }

    // Description
    if (data.description) {
      sections.push(data.description);
      sections.push('');
    }

    // Concept explanation
    if (data.concept) {
      sections.push(this.applyColor('📚 Concept:', 'yellow', opts));
      sections.push(this.indent(data.concept));
      if (data.explanation) {
        sections.push(this.indent(data.explanation));
      }
      sections.push('');
    }

    // Steps
    if (data.steps && Array.isArray(data.steps)) {
      sections.push(this.applyColor('📋 Steps to follow:', 'green', opts));
      data.steps.forEach((step, index) => {
        sections.push(`  ${this.applyColor(`Step ${index + 1}:`, 'bold', opts)} ${step}`);
      });
      sections.push('');
    }

    // Example
    if (data.example) {
      sections.push(this.applyColor('📝 Example:', 'blue', opts));
      if (typeof data.example === 'string') {
        sections.push(this.indent(data.example));
      } else {
        sections.push(this.indent(JSON.stringify(data.example, null, 2)));
      }
      sections.push('');
    }

    // Code snippet
    if (data.code) {
      const language = data.language || 'javascript';
      sections.push(this.applyColor('💻 Code:', 'magenta', opts));
      sections.push('```' + language);
      sections.push(data.code);
      sections.push('```');
      sections.push('');
    }

    // Tips
    if (data.tips && Array.isArray(data.tips)) {
      sections.push(this.applyColor('💡 Tips:', 'yellow', opts));
      data.tips.forEach(tip => {
        sections.push(`  • ${tip}`);
      });
      sections.push('');
    }

    // Warning
    if (data.warning) {
      sections.push(this.applyColor('⚠️ Warning:', 'red', opts));
      sections.push(this.indent(data.warning));
      sections.push('');
    }

    // Learn more
    if (data.learn_more) {
      sections.push(this.applyColor('📚 Learn more:', 'cyan', opts));
      sections.push(this.indent(data.learn_more));
      sections.push('');
    }

    // Commands
    if (data.commands && Array.isArray(data.commands)) {
      sections.push(this.applyColor('🔧 Commands to run:', 'green', opts));
      data.commands.forEach(cmd => {
        sections.push(`  $ ${cmd}`);
      });
      sections.push('');
    }

    // Progress indicator
    if (data.progress) {
      sections.push(this.applyColor('📊 Progress:', 'blue', opts));
      sections.push(this.indent(data.progress));
      sections.push('');
    }

    // Next steps
    if (data.next_steps && Array.isArray(data.next_steps)) {
      sections.push(this.applyColor('➡️ Next steps:', 'green', opts));
      data.next_steps.forEach((step, index) => {
        sections.push(`  ${index + 1}. ${step}`);
      });
      sections.push('');
    }

    // Achievement/Success message
    if (data.achievement) {
      sections.push(this.applyColor('✅ Achievement:', 'green', opts));
      sections.push(this.indent(data.achievement));
      sections.push('');
    }

    // Fallback to structured format
    if (sections.length === 1) {
      sections.push(this.formatStructured(data, opts));
    }

    return sections.join('\n').trim();
  }

  /**
   * Format data in a structured way when no specific fields match
   * @private
   * @param {any} data - Data to format
   * @param {object} options - Formatting options
   * @returns {string} Formatted output
   */
  formatStructured(data, options) {
    const sections = [];

    if (typeof data === 'object' && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        const formattedKey = this.formatKey(key);
        sections.push(this.applyColor(`${formattedKey}:`, 'bold', options));

        if (Array.isArray(value)) {
          value.forEach(item => {
            sections.push(`  • ${this.formatValue(item)}`);
          });
        } else if (typeof value === 'object' && value !== null) {
          sections.push(this.indent(JSON.stringify(value, null, 2)));
        } else {
          sections.push(this.indent(String(value)));
        }
        sections.push('');
      }
    } else {
      sections.push(String(data));
    }

    return sections.join('\n');
  }

  /**
   * Format a key name for display
   * @private
   * @param {string} key - Key to format
   * @returns {string} Formatted key
   */
  formatKey(key) {
    // Convert snake_case or camelCase to Title Case
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Format a value for display
   * @private
   * @param {any} value - Value to format
   * @returns {string} Formatted value
   */
  formatValue(value) {
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return String(value);
  }
}

export default GuideFormatter;