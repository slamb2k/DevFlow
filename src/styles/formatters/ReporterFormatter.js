/**
 * ReporterFormatter
 * Structured report output formatter
 */

import { BaseFormatter } from './BaseFormatter.js';

/**
 * Reporter style formatter - structured and data-driven
 */
export class ReporterFormatter extends BaseFormatter {
  constructor() {
    super('reporter', {
      verbose: true,
      includeMetrics: true,
      includeTimestamps: true,
      colors: true
    });
  }

  /**
   * Format data in reporter style
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

    // Report header
    if (data.title) {
      const header = `═══ ${data.title} ═══`;
      sections.push(this.applyColor(header, 'bold', opts));
      if (data.date) {
        sections.push(`Date: ${data.date}`);
      }
      if (data.generated_at) {
        sections.push(`Generated: ${data.generated_at}`);
      }
      sections.push('');
    }

    // Executive summary
    if (data.executive_summary) {
      sections.push(this.formatSection('Executive Summary', data.executive_summary, opts));
    }

    // Report sections
    if (data.sections) {
      for (const [sectionName, content] of Object.entries(data.sections)) {
        sections.push(this.formatSection(sectionName, content, opts));
      }
    }

    // Metrics
    if (data.metrics) {
      sections.push(this.applyColor('📊 Metrics', 'blue', opts));
      sections.push(this.createMetricsTable(data.metrics));
      sections.push('');
    }

    // Statistics
    if (data.statistics) {
      sections.push(this.applyColor('📈 Statistics', 'cyan', opts));
      for (const [key, value] of Object.entries(data.statistics)) {
        sections.push(`  ${this.formatStatKey(key)}: ${value}`);
      }
      sections.push('');
    }

    // Table data
    if (data.table) {
      sections.push(this.createTable(data.table.headers, data.table.rows));
      sections.push('');
    }

    // Summary
    if (data.summary) {
      sections.push(this.applyColor('📋 Summary', 'yellow', opts));
      if (typeof data.summary === 'object') {
        if (data.summary.total_issues !== undefined) {
          sections.push(`  Total Issues: ${data.summary.total_issues}`);
        }
        if (data.summary.critical !== undefined) {
          sections.push(`  ${this.applyColor('❌ Critical:', 'red', opts)} ${data.summary.critical}`);
        }
        if (data.summary.warnings !== undefined) {
          sections.push(`  ${this.applyColor('⚠️ Warnings:', 'yellow', opts)} ${data.summary.warnings}`);
        }
        if (data.summary.info !== undefined) {
          sections.push(`  ${this.applyColor('ℹ️ Info:', 'blue', opts)} ${data.summary.info}`);
        }
        // Handle other summary fields
        for (const [key, value] of Object.entries(data.summary)) {
          if (!['total_issues', 'critical', 'warnings', 'info'].includes(key)) {
            sections.push(`  ${this.formatStatKey(key)}: ${value}`);
          }
        }
      } else {
        sections.push(this.indent(String(data.summary)));
      }
      sections.push('');
    }

    // Findings
    if (data.findings && Array.isArray(data.findings)) {
      sections.push(this.applyColor('🔍 Findings', 'magenta', opts));
      data.findings.forEach((finding, index) => {
        sections.push(`  ${index + 1}. ${finding}`);
      });
      sections.push('');
    }

    // Recommendations
    if (data.recommendations && Array.isArray(data.recommendations)) {
      sections.push(this.applyColor('💡 Recommendations', 'green', opts));
      data.recommendations.forEach((rec, index) => {
        sections.push(`  ${index + 1}. ${rec}`);
      });
      sections.push('');
    }

    // Action items / Insights
    if (data.insights && Array.isArray(data.insights)) {
      sections.push(this.applyColor('🎯 Action Items', 'green', opts));
      data.insights.forEach(insight => {
        if (typeof insight === 'object' && insight.priority && insight.action) {
          const priority = this.formatPriority(insight.priority, opts);
          sections.push(`  ${priority} ${insight.action}`);
        } else {
          sections.push(`  • ${insight}`);
        }
      });
      sections.push('');
    }

    // Timeline
    if (data.timeline && Array.isArray(data.timeline)) {
      sections.push(this.applyColor('📅 Timeline', 'blue', opts));
      data.timeline.forEach(event => {
        if (typeof event === 'object' && event.date && event.description) {
          sections.push(`  ${event.date}: ${event.description}`);
        } else {
          sections.push(`  • ${event}`);
        }
      });
      sections.push('');
    }

    // Performance metrics
    if (data.performance) {
      sections.push(this.applyColor('⚡ Performance', 'yellow', opts));
      sections.push(this.formatPerformanceMetrics(data.performance, opts));
      sections.push('');
    }

    // Coverage report
    if (data.coverage) {
      sections.push(this.applyColor('📊 Coverage Report', 'cyan', opts));
      sections.push(this.formatCoverageReport(data.coverage, opts));
      sections.push('');
    }

    // Conclusion
    if (data.conclusion) {
      sections.push(this.applyColor('📝 Conclusion', 'bold', opts));
      sections.push(this.indent(data.conclusion));
      sections.push('');
    }

    // Footer
    if (data.footer) {
      sections.push('───────────────────────────────');
      sections.push(data.footer);
    }

    // Fallback to structured format
    if (sections.length === 0) {
      sections.push(this.formatStructuredReport(data, opts));
    }

    return sections.join('\n').trim();
  }

  /**
   * Format a report section
   * @private
   * @param {string} title - Section title
   * @param {any} content - Section content
   * @param {object} options - Formatting options
   * @returns {string} Formatted section
   */
  formatSection(title, content, options) {
    const sections = [];
    sections.push(this.applyColor(`▼ ${this.formatSectionTitle(title)}`, 'bold', options));

    if (Array.isArray(content)) {
      content.forEach((item, index) => {
        sections.push(`  ${index + 1}. ${item}`);
      });
    } else if (typeof content === 'object' && content !== null) {
      for (const [key, value] of Object.entries(content)) {
        sections.push(`  ${this.formatStatKey(key)}: ${this.formatValue(value)}`);
      }
    } else {
      sections.push(this.indent(String(content)));
    }

    sections.push('');
    return sections.join('\n');
  }

  /**
   * Format section title
   * @private
   * @param {string} title - Title to format
   * @returns {string} Formatted title
   */
  formatSectionTitle(title) {
    return title
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Create metrics table
   * @private
   * @param {object} metrics - Metrics object
   * @returns {string} Formatted table
   */
  createMetricsTable(metrics) {
    const entries = Object.entries(metrics);
    const maxKeyLength = Math.max(...entries.map(([k]) => k.length));

    const lines = [];
    for (const [key, value] of entries) {
      const paddedKey = this.formatStatKey(key).padEnd(maxKeyLength + 2);
      lines.push(`  ${paddedKey}: ${value}`);
    }

    return lines.join('\n');
  }

  /**
   * Format statistic key
   * @private
   * @param {string} key - Key to format
   * @returns {string} Formatted key
   */
  formatStatKey(key) {
    return key
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Format priority level
   * @private
   * @param {string} priority - Priority level
   * @param {object} options - Formatting options
   * @returns {string} Formatted priority
   */
  formatPriority(priority, options) {
    const level = String(priority).toUpperCase();
    const colors = {
      HIGH: 'red',
      MEDIUM: 'yellow',
      LOW: 'green'
    };

    const color = colors[level] || 'white';
    return this.applyColor(`[${level}]`, color, options);
  }

  /**
   * Format performance metrics
   * @private
   * @param {object} performance - Performance data
   * @param {object} options - Formatting options
   * @returns {string} Formatted performance metrics
   */
  formatPerformanceMetrics(performance, options) {
    const lines = [];

    if (performance.load_time) {
      lines.push(`  Load Time: ${performance.load_time}`);
    }
    if (performance.memory_usage) {
      lines.push(`  Memory Usage: ${performance.memory_usage}`);
    }
    if (performance.cpu_usage) {
      lines.push(`  CPU Usage: ${performance.cpu_usage}`);
    }
    if (performance.response_time) {
      lines.push(`  Response Time: ${performance.response_time}`);
    }

    // Handle other performance metrics
    for (const [key, value] of Object.entries(performance)) {
      if (!['load_time', 'memory_usage', 'cpu_usage', 'response_time'].includes(key)) {
        lines.push(`  ${this.formatStatKey(key)}: ${value}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format coverage report
   * @private
   * @param {object} coverage - Coverage data
   * @param {object} options - Formatting options
   * @returns {string} Formatted coverage report
   */
  formatCoverageReport(coverage, options) {
    const lines = [];

    if (coverage.statements) {
      lines.push(`  Statements: ${coverage.statements}`);
    }
    if (coverage.branches) {
      lines.push(`  Branches: ${coverage.branches}`);
    }
    if (coverage.functions) {
      lines.push(`  Functions: ${coverage.functions}`);
    }
    if (coverage.lines) {
      lines.push(`  Lines: ${coverage.lines}`);
    }

    // Handle other coverage metrics
    for (const [key, value] of Object.entries(coverage)) {
      if (!['statements', 'branches', 'functions', 'lines'].includes(key)) {
        lines.push(`  ${this.formatStatKey(key)}: ${value}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format data as a structured report when no specific fields match
   * @private
   * @param {any} data - Data to format
   * @param {object} options - Formatting options
   * @returns {string} Formatted report
   */
  formatStructuredReport(data, options) {
    const sections = [];

    sections.push(this.applyColor('═══ Report ═══', 'bold', options));
    sections.push('');

    if (typeof data === 'object' && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        const formattedKey = this.formatSectionTitle(key);
        sections.push(this.applyColor(`▼ ${formattedKey}`, 'bold', options));

        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            sections.push(`  ${index + 1}. ${this.formatValue(item)}`);
          });
        } else if (typeof value === 'object' && value !== null) {
          for (const [subKey, subValue] of Object.entries(value)) {
            sections.push(`  ${this.formatStatKey(subKey)}: ${this.formatValue(subValue)}`);
          }
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
   * Format a value for display
   * @private
   * @param {any} value - Value to format
   * @returns {string} Formatted value
   */
  formatValue(value) {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return String(value);
  }
}

export default ReporterFormatter;