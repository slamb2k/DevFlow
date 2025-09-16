/**
 * Output Formatters Tests
 * Tests for individual style formatters (Guide, Expert, Coach, Reporter)
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('Output Formatters', () => {
  let BaseFormatter;
  let GuideFormatter;
  let ExpertFormatter;
  let CoachFormatter;
  let ReporterFormatter;

  beforeEach(async () => {
    // Dynamic imports for fresh module state
    const baseModule = await import('../../../../src/styles/formatters/BaseFormatter.js');
    BaseFormatter = baseModule.BaseFormatter;

    const guideModule = await import('../../../../src/styles/formatters/GuideFormatter.js');
    GuideFormatter = guideModule.GuideFormatter;

    const expertModule = await import('../../../../src/styles/formatters/ExpertFormatter.js');
    ExpertFormatter = expertModule.ExpertFormatter;

    const coachModule = await import('../../../../src/styles/formatters/CoachFormatter.js');
    CoachFormatter = coachModule.CoachFormatter;

    const reporterModule = await import('../../../../src/styles/formatters/ReporterFormatter.js');
    ReporterFormatter = reporterModule.ReporterFormatter;
  });

  describe('BaseFormatter', () => {
    test('should create formatter with name and options', () => {
      const formatter = new BaseFormatter('test', {
        verbose: true,
        colors: false,
      });

      expect(formatter.name).toBe('test');
      expect(formatter.options).toEqual({
        verbose: true,
        colors: false,
      });
    });

    test('should provide default format method', () => {
      const formatter = new BaseFormatter('test', {});
      const result = formatter.format({ message: 'test' });

      expect(result).toBe(JSON.stringify({ message: 'test' }, null, 2));
    });

    test('should validate options', () => {
      const formatter = new BaseFormatter('test', {});
      const validation = formatter.validateOptions({
        colors: true,
        width: 80,
      });

      expect(validation.valid).toBe(true);
    });

    test('should merge options with defaults', () => {
      const formatter = new BaseFormatter('test', {
        verbose: true,
      });

      const merged = formatter.mergeOptions({
        colors: true,
      });

      expect(merged).toEqual({
        verbose: true,
        colors: true,
      });
    });

    test('should handle template rendering', () => {
      const formatter = new BaseFormatter('test', {});
      formatter.template = '{{greeting}}, {{name}}!';

      const result = formatter.renderTemplate({
        greeting: 'Hello',
        name: 'World',
      });

      expect(result).toBe('Hello, World!');
    });
  });

  describe('GuideFormatter', () => {
    let formatter;

    beforeEach(() => {
      formatter = new GuideFormatter();
    });

    test('should format with step-by-step instructions', () => {
      const data = {
        title: 'Setting up DevFlow',
        steps: ['Install dependencies', 'Configure environment', 'Run initial setup'],
      };

      const result = formatter.format(data);

      expect(result).toContain('📖 Guide:');
      expect(result).toContain('Setting up DevFlow');
      expect(result).toContain('Step 1:');
      expect(result).toContain('Step 2:');
      expect(result).toContain('Step 3:');
      expect(result).toContain('Install dependencies');
    });

    test('should include examples when provided', () => {
      const data = {
        title: 'Using Commands',
        description: 'How to use DevFlow commands',
        example: '/devflow-init --template react',
      };

      const result = formatter.format(data);

      expect(result).toContain('📝 Example:');
      expect(result).toContain('/devflow-init --template react');
    });

    test('should format tips and notes', () => {
      const data = {
        title: 'Best Practices',
        tips: ['Always run tests before committing', 'Use descriptive commit messages'],
      };

      const result = formatter.format(data);

      expect(result).toContain('💡 Tips:');
      expect(result).toContain('• Always run tests');
      expect(result).toContain('• Use descriptive commit');
    });

    test('should handle warnings', () => {
      const data = {
        title: 'Configuration',
        warning: 'This will overwrite existing settings',
      };

      const result = formatter.format(data);

      expect(result).toContain('⚠️ Warning:');
      expect(result).toContain('This will overwrite existing settings');
    });

    test('should format with educational tone', () => {
      const data = {
        concept: 'Git Branching',
        explanation: 'Branches allow parallel development',
        learn_more: 'https://docs.example.com/git',
      };

      const result = formatter.format(data);

      expect(result).toContain('📚 Concept:');
      expect(result).toContain('Branches allow parallel development');
      expect(result).toContain('Learn more:');
    });
  });

  describe('ExpertFormatter', () => {
    let formatter;

    beforeEach(() => {
      formatter = new ExpertFormatter();
    });

    test('should format concisely without explanations', () => {
      const data = {
        command: 'npm install',
        options: ['--save-dev', '--legacy-peer-deps'],
        output: 'Installed 245 packages',
      };

      const result = formatter.format(data);

      expect(result).not.toContain('Step');
      expect(result).not.toContain('This command will');
      expect(result).toContain('npm install');
      expect(result).toContain('--save-dev');
      expect(result).toContain('Installed 245 packages');
    });

    test('should format technical details directly', () => {
      const data = {
        config: {
          port: 3000,
          env: 'production',
          workers: 4,
        },
      };

      const result = formatter.format(data);

      expect(result).toContain('port: 3000');
      expect(result).toContain('env: production');
      expect(result).toContain('workers: 4');
      expect(result.split('\n').length).toBeLessThan(10); // Concise output
    });

    test('should use minimal formatting', () => {
      const data = {
        error: 'Module not found',
        file: 'src/index.js',
        line: 42,
      };

      const result = formatter.format(data);

      expect(result).toContain('Module not found');
      expect(result).toContain('src/index.js:42');
      expect(result).not.toContain('💡'); // No emoji hints
      expect(result).not.toContain('📝'); // No examples
    });

    test('should format code snippets efficiently', () => {
      const data = {
        code: 'const result = await fetch(url);',
        language: 'javascript',
      };

      const result = formatter.format(data);

      expect(result).toContain('```javascript');
      expect(result).toContain('const result = await fetch(url);');
      expect(result).toContain('```');
    });

    test('should handle lists efficiently', () => {
      const data = {
        files: ['index.js', 'config.json', 'package.json'],
      };

      const result = formatter.format(data);

      expect(result).toContain('index.js');
      expect(result).toContain('config.json');
      expect(result).toContain('package.json');
      expect(result.split('\n').length).toBeLessThan(5);
    });
  });

  describe('CoachFormatter', () => {
    let formatter;

    beforeEach(() => {
      formatter = new CoachFormatter();
    });

    test('should format with encouraging tone', () => {
      const data = {
        achievement: 'Tests passing',
        next_step: 'Consider adding edge cases',
      };

      const result = formatter.format(data);

      expect(result).toContain('Great job!');
      expect(result).toContain('Tests passing');
      expect(result).toContain('Consider adding edge cases');
    });

    test('should ask reflective questions', () => {
      const data = {
        decision: 'Choosing a framework',
        options: ['React', 'Vue', 'Angular'],
        considerations: ['Team expertise', 'Project size'],
      };

      const result = formatter.format(data);

      expect(result).toMatch(/What.*important/i);
      expect(result).toContain('Team expertise');
      expect(result).toContain('Project size');
    });

    test('should provide learning tips', () => {
      const data = {
        topic: 'Git Workflow',
        tip: 'Start with feature branches',
        practice: 'Try creating a branch for your next feature',
      };

      const result = formatter.format(data);

      expect(result).toContain('💡 Learning Tip:');
      expect(result).toContain('Start with feature branches');
      expect(result).toContain('Try creating a branch');
    });

    test('should celebrate progress', () => {
      const data = {
        milestone: 'First PR merged',
        progress: '5 of 10 tasks complete',
      };

      const result = formatter.format(data);

      expect(result).toMatch(/🎉|Congratulations|Well done/);
      expect(result).toContain('First PR merged');
      expect(result).toContain('5 of 10 tasks complete');
    });

    test('should provide gentle corrections', () => {
      const data = {
        issue: 'Tests failing',
        suggestion: 'Check the test setup',
        encouragement: 'This is a common issue',
      };

      const result = formatter.format(data);

      expect(result).not.toContain('Error:');
      expect(result).toContain("Let's");
      expect(result).toContain('Check the test setup');
      expect(result).toContain('common issue');
    });
  });

  describe('ReporterFormatter', () => {
    let formatter;

    beforeEach(() => {
      formatter = new ReporterFormatter();
    });

    test('should format structured reports', () => {
      const data = {
        title: 'Code Analysis Report',
        date: '2024-01-15',
        sections: {
          overview: 'Analysis complete',
          findings: ['Issue 1', 'Issue 2'],
          recommendations: ['Fix 1', 'Fix 2'],
        },
      };

      const result = formatter.format(data);

      expect(result).toContain('═══ Code Analysis Report ═══');
      expect(result).toContain('Date: 2024-01-15');
      expect(result).toContain('▼ Overview');
      expect(result).toContain('▼ Findings');
      expect(result).toContain('▼ Recommendations');
    });

    test('should format metrics and statistics', () => {
      const data = {
        metrics: {
          'Total Files': 42,
          'Code Coverage': '85%',
          Complexity: 'Low',
          Dependencies: 15,
        },
      };

      const result = formatter.format(data);

      expect(result).toContain('📊 Metrics');
      expect(result).toContain('Total Files');
      expect(result).toContain('42');
      expect(result).toContain('Code Coverage');
      expect(result).toContain('85%');
    });

    test('should format tables', () => {
      const data = {
        table: {
          headers: ['File', 'Lines', 'Coverage'],
          rows: [
            ['index.js', '150', '90%'],
            ['utils.js', '75', '85%'],
          ],
        },
      };

      const result = formatter.format(data);

      expect(result).toContain('│ File');
      expect(result).toContain('│ Lines');
      expect(result).toContain('│ Coverage');
      expect(result).toContain('├─');
      expect(result).toContain('│ index.js');
      expect(result).toContain('│ 150');
      expect(result).toContain('│ 90%');
    });

    test('should format summary sections', () => {
      const data = {
        summary: {
          total_issues: 5,
          critical: 1,
          warnings: 2,
          info: 2,
        },
      };

      const result = formatter.format(data);

      expect(result).toContain('📋 Summary');
      expect(result).toContain('Total Issues: 5');
      expect(result).toContain('Critical:');
      expect(result).toContain('1');
      expect(result).toContain('Warnings:');
      expect(result).toContain('2');
      expect(result).toContain('Info:');
      expect(result).toContain('2');
    });

    test('should format actionable insights', () => {
      const data = {
        insights: [
          { priority: 'high', action: 'Update dependencies' },
          { priority: 'medium', action: 'Refactor utils' },
          { priority: 'low', action: 'Add documentation' },
        ],
      };

      const result = formatter.format(data);

      expect(result).toContain('🎯 Action Items');
      expect(result).toContain('[HIGH]');
      expect(result).toContain('[MEDIUM]');
      expect(result).toContain('[LOW]');
      expect(result).toContain('Update dependencies');
    });
  });

  describe('Formatter Integration', () => {
    test('all formatters should extend BaseFormatter', () => {
      const guide = new GuideFormatter();
      const expert = new ExpertFormatter();
      const coach = new CoachFormatter();
      const reporter = new ReporterFormatter();

      expect(guide).toBeInstanceOf(BaseFormatter);
      expect(expert).toBeInstanceOf(BaseFormatter);
      expect(coach).toBeInstanceOf(BaseFormatter);
      expect(reporter).toBeInstanceOf(BaseFormatter);
    });

    test('all formatters should have unique names', () => {
      const formatters = [
        new GuideFormatter(),
        new ExpertFormatter(),
        new CoachFormatter(),
        new ReporterFormatter(),
      ];

      const names = formatters.map((f) => f.name);
      const uniqueNames = [...new Set(names)];

      expect(uniqueNames.length).toBe(names.length);
      expect(names).toContain('guide');
      expect(names).toContain('expert');
      expect(names).toContain('coach');
      expect(names).toContain('reporter');
    });

    test('formatters should handle empty data gracefully', () => {
      const formatters = [
        new GuideFormatter(),
        new ExpertFormatter(),
        new CoachFormatter(),
        new ReporterFormatter(),
      ];

      formatters.forEach((formatter) => {
        expect(() => formatter.format({})).not.toThrow();
        expect(() => formatter.format(null)).not.toThrow();
        expect(() => formatter.format(undefined)).not.toThrow();
      });
    });

    test('formatters should respect color options', () => {
      const data = { message: 'Test' };
      const formatters = [
        new GuideFormatter(),
        new ExpertFormatter(),
        new CoachFormatter(),
        new ReporterFormatter(),
      ];

      formatters.forEach((formatter) => {
        const withColors = formatter.format(data, { colors: true });
        const withoutColors = formatter.format(data, { colors: false });

        // Without colors should not contain ANSI codes
        expect(withoutColors).not.toMatch(/\x1b\[\d+m/);
      });
    });
  });
});
