/**
 * CoachFormatter
 * Encouraging and collaborative output formatter
 */

import { BaseFormatter } from './BaseFormatter.js';

/**
 * Coach style formatter - encouraging and collaborative
 */
export class CoachFormatter extends BaseFormatter {
  constructor() {
    super('coach', {
      verbose: true,
      includeEncouragement: true,
      includeQuestions: true,
      colors: true,
    });
  }

  /**
   * Format data in coach style
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

    // Achievement or success
    if (data.achievement) {
      sections.push(this.applyColor('🎉 Great job!', 'green', opts));
      sections.push(data.achievement);
      if (data.next_step) {
        sections.push('');
        sections.push("Now let's think about the next step:");
        sections.push(this.indent(data.next_step));
      }
      sections.push('');
    }

    // Milestone celebration
    if (data.milestone) {
      sections.push(this.applyColor('🎉 Congratulations!', 'green', opts));
      sections.push(`You've reached an important milestone: ${data.milestone}`);
      if (data.progress) {
        sections.push(this.applyColor(`Progress: ${data.progress}`, 'blue', opts));
      }
      sections.push('');
    }

    // Decision making
    if (data.decision) {
      sections.push(this.applyColor("🤔 Let's think about this together:", 'yellow', opts));
      sections.push(data.decision);
      sections.push('');

      if (data.options && Array.isArray(data.options)) {
        sections.push('Here are your options:');
        data.options.forEach((option, index) => {
          sections.push(`  ${index + 1}. ${option}`);
        });
        sections.push('');
      }

      if (data.considerations && Array.isArray(data.considerations)) {
        sections.push("What's important to consider:");
        data.considerations.forEach((consideration) => {
          sections.push(`  • ${consideration}`);
        });
        sections.push('');
      }

      sections.push('Take a moment to think about what feels right for your project.');
      sections.push('');
    }

    // Learning opportunity
    if (data.topic) {
      sections.push(this.applyColor('💡 Learning Tip:', 'cyan', opts));
      sections.push(data.topic);
      if (data.tip) {
        sections.push(this.indent(data.tip));
      }
      if (data.practice) {
        sections.push('');
        sections.push('Try this:');
        sections.push(this.indent(data.practice));
      }
      sections.push('');
    }

    // Issue or challenge
    if (data.issue) {
      sections.push(this.applyColor("Let's work through this together:", 'yellow', opts));
      sections.push(data.issue);
      if (data.suggestion) {
        sections.push('');
        sections.push("Here's a suggestion:");
        sections.push(this.indent(data.suggestion));
      }
      if (data.encouragement) {
        sections.push('');
        sections.push(this.applyColor(`Remember: ${data.encouragement}`, 'green', opts));
      }
      sections.push('');
    }

    // Progress tracking
    if (data.progress_update) {
      sections.push(this.applyColor('📊 Your Progress:', 'blue', opts));
      sections.push(data.progress_update);
      if (data.completed_tasks) {
        sections.push('');
        sections.push("What you've accomplished:");
        data.completed_tasks.forEach((task) => {
          sections.push(`  ✅ ${task}`);
        });
      }
      if (data.upcoming_tasks) {
        sections.push('');
        sections.push("What's coming next:");
        data.upcoming_tasks.forEach((task) => {
          sections.push(`  ⏳ ${task}`);
        });
      }
      sections.push('');
      sections.push("You're making great progress! Keep it up!");
      sections.push('');
    }

    // Reflection questions
    if (data.reflection) {
      sections.push(this.applyColor('🤔 Reflection Time:', 'magenta', opts));
      sections.push(data.reflection);
      if (data.questions && Array.isArray(data.questions)) {
        sections.push('');
        data.questions.forEach((question) => {
          sections.push(`  • ${question}`);
        });
      }
      sections.push('');
      sections.push('Take your time to think about these questions.');
      sections.push('');
    }

    // Skills development
    if (data.skill) {
      sections.push(this.applyColor('🎯 Skill Development:', 'cyan', opts));
      sections.push(`You're developing: ${data.skill}`);
      if (data.level) {
        sections.push(`Current level: ${data.level}`);
      }
      if (data.next_level) {
        sections.push(`Next milestone: ${data.next_level}`);
      }
      if (data.practice_suggestion) {
        sections.push('');
        sections.push('To improve further:');
        sections.push(this.indent(data.practice_suggestion));
      }
      sections.push('');
    }

    // Encouragement messages
    if (data.encouragement && !data.issue) {
      sections.push(this.applyColor('💪 Keep Going!', 'green', opts));
      sections.push(data.encouragement);
      sections.push('');
    }

    // Collaboration
    if (data.collaboration) {
      sections.push(this.applyColor("🤝 Let's Collaborate:", 'blue', opts));
      sections.push(data.collaboration);
      if (data.team_questions) {
        sections.push('');
        sections.push('Questions to discuss with your team:');
        data.team_questions.forEach((q) => {
          sections.push(`  • ${q}`);
        });
      }
      sections.push('');
    }

    // Learning path
    if (data.learning_path) {
      sections.push(this.applyColor('📚 Your Learning Journey:', 'cyan', opts));
      if (data.completed_lessons) {
        sections.push('');
        sections.push("What you've learned:");
        data.completed_lessons.forEach((lesson) => {
          sections.push(`  ✅ ${lesson}`);
        });
      }
      if (data.current_lesson) {
        sections.push('');
        sections.push(`Currently working on: ${data.current_lesson}`);
      }
      if (data.next_lessons) {
        sections.push('');
        sections.push('Coming up:');
        data.next_lessons.forEach((lesson) => {
          sections.push(`  📖 ${lesson}`);
        });
      }
      sections.push('');
    }

    // Feedback
    if (data.feedback) {
      sections.push(this.applyColor('📝 Feedback:', 'yellow', opts));
      sections.push(data.feedback);
      if (data.strengths) {
        sections.push('');
        sections.push('Your strengths:');
        data.strengths.forEach((strength) => {
          sections.push(`  ⭐ ${strength}`);
        });
      }
      if (data.areas_to_improve) {
        sections.push('');
        sections.push('Areas to explore further:');
        data.areas_to_improve.forEach((area) => {
          sections.push(`  🔍 ${area}`);
        });
      }
      sections.push('');
    }

    // Fallback to supportive format
    if (sections.length === 0) {
      sections.push(this.formatSupportive(data, opts));
    }

    return sections.join('\n').trim();
  }

  /**
   * Format data in a supportive way when no specific fields match
   * @private
   * @param {any} data - Data to format
   * @param {object} options - Formatting options
   * @returns {string} Formatted output
   */
  formatSupportive(data, options) {
    const sections = [];

    sections.push(this.applyColor("Let's review what we have:", 'cyan', options));
    sections.push('');

    if (typeof data === 'object' && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        const formattedKey = this.formatKey(key);
        sections.push(`${formattedKey}:`);

        if (Array.isArray(value)) {
          value.forEach((item) => {
            sections.push(`  • ${this.formatValue(item)}`);
          });
        } else if (typeof value === 'object' && value !== null) {
          sections.push(this.indent(JSON.stringify(value, null, 2)));
        } else {
          sections.push(this.indent(String(value)));
        }
        sections.push('');
      }

      sections.push("How does this look to you? Is there anything you'd like to adjust?");
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
    // Convert snake_case or camelCase to readable format
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
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

export default CoachFormatter;
