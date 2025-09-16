/**
 * StyleRegistry Tests
 * Tests for the output style registry and formatter system
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import EventEmitter from 'events';

describe('StyleRegistry', () => {
  let StyleRegistry;
  let BaseFormatter;
  let mockFormatter;
  let registry;

  beforeEach(async () => {
    // Dynamic import to ensure fresh module state
    const styleModule = await import('../../../src/styles/StyleRegistry.js');
    StyleRegistry = styleModule.StyleRegistry;

    const formatterModule = await import('../../../src/styles/formatters/BaseFormatter.js');
    BaseFormatter = formatterModule.BaseFormatter;

    registry = new StyleRegistry();

    // Create mock formatter
    mockFormatter = {
      name: 'test',
      format: jest.fn(),
      validateOptions: jest.fn(),
      isAsyncFormatter: false,
    };
  });

  describe('Registry Management', () => {
    test('should register a new style formatter', () => {
      const formatter = new BaseFormatter('guide', {
        description: 'Guide style formatter',
      });

      registry.register('guide', formatter);

      expect(registry.has('guide')).toBe(true);
      expect(registry.get('guide')).toBe(formatter);
    });

    test('should prevent duplicate registration', () => {
      const formatter = new BaseFormatter('guide', {});
      registry.register('guide', formatter);

      expect(() => {
        registry.register('guide', formatter);
      }).toThrow('Style "guide" is already registered');
    });

    test('should unregister a style', () => {
      const formatter = new BaseFormatter('guide', {});
      registry.register('guide', formatter);

      const result = registry.unregister('guide');

      expect(result).toBe(true);
      expect(registry.has('guide')).toBe(false);
    });

    test('should list all registered styles', () => {
      registry.register('guide', new BaseFormatter('guide', {}));
      registry.register('expert', new BaseFormatter('expert', {}));
      registry.register('coach', new BaseFormatter('coach', {}));

      const styles = registry.list();

      expect(styles).toEqual(['guide', 'expert', 'coach']);
    });

    test('should validate formatter extends BaseFormatter', () => {
      const invalidFormatter = { format: () => {} };

      expect(() => {
        registry.register('invalid', invalidFormatter);
      }).toThrow('Formatter must extend BaseFormatter class');
    });
  });

  describe('Style Selection', () => {
    beforeEach(() => {
      registry.register('guide', new BaseFormatter('guide', { priority: 1 }));
      registry.register('expert', new BaseFormatter('expert', { priority: 2 }));
      registry.register('coach', new BaseFormatter('coach', { priority: 3 }));
      registry.register('reporter', new BaseFormatter('reporter', { priority: 4 }));
    });

    test('should select default style', () => {
      registry.setDefault('guide');
      const style = registry.selectStyle();

      expect(style).toBe('guide');
    });

    test('should select style by context', () => {
      const context = {
        command: 'init',
        phase: 'onboarding',
      };

      // Register context mappings
      registry.mapContext({ phase: 'onboarding' }, 'guide');

      const style = registry.selectStyle(context);
      expect(style).toBe('guide');
    });

    test('should select style by explicit preference', () => {
      const context = {
        style: 'expert',
      };

      const style = registry.selectStyle(context);
      expect(style).toBe('expert');
    });

    test('should fall back to default when context has no match', () => {
      registry.setDefault('expert');

      const context = {
        command: 'unknown',
      };

      const style = registry.selectStyle(context);
      expect(style).toBe('expert');
    });

    test('should handle missing default gracefully', () => {
      const style = registry.selectStyle();

      // Should return first registered style
      expect(style).toBe('guide');
    });
  });

  describe('Formatting Operations', () => {
    let guideFormatter;
    let expertFormatter;

    beforeEach(() => {
      guideFormatter = new BaseFormatter('guide', {
        verbose: true,
        includeExamples: true,
      });
      guideFormatter.format = jest.fn().mockReturnValue('Formatted as guide');

      expertFormatter = new BaseFormatter('expert', {
        verbose: false,
        includeExamples: false,
      });
      expertFormatter.format = jest.fn().mockReturnValue('Formatted as expert');

      registry.register('guide', guideFormatter);
      registry.register('expert', expertFormatter);
    });

    test('should format data using selected style', () => {
      registry.setDefault('guide');

      const data = { message: 'Test message' };
      const result = registry.format(data);

      expect(guideFormatter.format).toHaveBeenCalledWith(data, {});
      expect(result).toBe('Formatted as guide');
    });

    test('should format data with specific style override', () => {
      registry.setDefault('guide');

      const data = { message: 'Test message' };
      const result = registry.format(data, { style: 'expert' });

      expect(expertFormatter.format).toHaveBeenCalledWith(data, {});
      expect(result).toBe('Formatted as expert');
    });

    test('should pass options to formatter', () => {
      const data = { message: 'Test message' };
      const options = {
        style: 'guide',
        colors: true,
        width: 80,
      };

      registry.format(data, options);

      expect(guideFormatter.format).toHaveBeenCalledWith(data, {
        colors: true,
        width: 80,
      });
    });

    test('should handle async formatters', async () => {
      const asyncFormatter = new BaseFormatter('async', {});
      asyncFormatter.isAsyncFormatter = true;
      asyncFormatter.format = jest.fn().mockResolvedValue('Async result');

      registry.register('async', asyncFormatter);

      const data = { message: 'Test' };
      const result = await registry.formatAsync(data, { style: 'async' });

      expect(result).toBe('Async result');
    });

    test('should throw error for unknown style', () => {
      expect(() => {
        registry.format({}, { style: 'unknown' });
      }).toThrow('Style "unknown" is not registered');
    });
  });

  describe('Context Mapping', () => {
    beforeEach(() => {
      registry.register('guide', new BaseFormatter('guide', {}));
      registry.register('expert', new BaseFormatter('expert', {}));
      registry.register('coach', new BaseFormatter('coach', {}));
      registry.register('reporter', new BaseFormatter('reporter', {}));
    });

    test('should map command contexts to styles', () => {
      registry.mapContext({ command: 'init' }, 'guide');
      registry.mapContext({ command: 'analyze' }, 'reporter');
      registry.mapContext({ command: 'optimize' }, 'expert');

      expect(registry.selectStyle({ command: 'init' })).toBe('guide');
      expect(registry.selectStyle({ command: 'analyze' })).toBe('reporter');
      expect(registry.selectStyle({ command: 'optimize' })).toBe('expert');
    });

    test('should map phase contexts to styles', () => {
      registry.mapContext({ phase: 'planning' }, 'coach');
      registry.mapContext({ phase: 'implementation' }, 'expert');
      registry.mapContext({ phase: 'review' }, 'reporter');

      expect(registry.selectStyle({ phase: 'planning' })).toBe('coach');
      expect(registry.selectStyle({ phase: 'implementation' })).toBe('expert');
      expect(registry.selectStyle({ phase: 'review' })).toBe('reporter');
    });

    test('should prioritize explicit style over context mapping', () => {
      registry.mapContext({ command: 'init' }, 'guide');

      const style = registry.selectStyle({
        command: 'init',
        style: 'expert',
      });

      expect(style).toBe('expert');
    });

    test('should handle multiple context criteria', () => {
      registry.mapContext(
        {
          command: 'analyze',
          verbose: true,
        },
        'guide'
      );

      registry.mapContext(
        {
          command: 'analyze',
          verbose: false,
        },
        'expert'
      );

      expect(
        registry.selectStyle({
          command: 'analyze',
          verbose: true,
        })
      ).toBe('guide');

      expect(
        registry.selectStyle({
          command: 'analyze',
          verbose: false,
        })
      ).toBe('expert');
    });
  });

  describe('Event Emission', () => {
    test('should emit events on registration', (done) => {
      registry.on('style:registered', (styleName) => {
        expect(styleName).toBe('guide');
        done();
      });

      const formatter = new BaseFormatter('guide', {});
      registry.register('guide', formatter);
    });

    test('should emit events on unregistration', (done) => {
      const formatter = new BaseFormatter('guide', {});
      registry.register('guide', formatter);

      registry.on('style:unregistered', (styleName) => {
        expect(styleName).toBe('guide');
        done();
      });

      registry.unregister('guide');
    });

    test('should emit events on formatting', (done) => {
      const formatter = new BaseFormatter('guide', {});
      formatter.format = jest.fn().mockReturnValue('Result');
      registry.register('guide', formatter);
      registry.setDefault('guide');

      registry.on('format:start', ({ style, data }) => {
        expect(style).toBe('guide');
        expect(data).toEqual({ test: true });
      });

      registry.on('format:complete', ({ style, result }) => {
        expect(style).toBe('guide');
        expect(result).toBe('Result');
        done();
      });

      registry.format({ test: true });
    });

    test('should emit error events', (done) => {
      registry.on('format:error', ({ style, error }) => {
        expect(style).toBe('unknown');
        expect(error.message).toContain('not registered');
        done();
      });

      try {
        registry.format({}, { style: 'unknown' });
      } catch (e) {
        // Expected error
      }
    });
  });

  describe('Configuration Persistence', () => {
    test('should export configuration', () => {
      registry.register('guide', new BaseFormatter('guide', {}));
      registry.register('expert', new BaseFormatter('expert', {}));
      registry.setDefault('guide');
      registry.mapContext({ command: 'init' }, 'guide');

      const config = registry.exportConfig();

      expect(config).toEqual({
        defaultStyle: 'guide',
        registeredStyles: ['guide', 'expert'],
        contextMappings: [{ context: { command: 'init' }, style: 'guide' }],
      });
    });

    test('should import configuration', () => {
      const config = {
        defaultStyle: 'expert',
        contextMappings: [{ context: { command: 'analyze' }, style: 'reporter' }],
      };

      // Register styles first
      registry.register('expert', new BaseFormatter('expert', {}));
      registry.register('reporter', new BaseFormatter('reporter', {}));

      registry.importConfig(config);

      expect(registry.getDefault()).toBe('expert');
      expect(registry.selectStyle({ command: 'analyze' })).toBe('reporter');
    });
  });

  describe('Error Handling', () => {
    test('should handle formatter errors gracefully', () => {
      const formatter = new BaseFormatter('error', {});
      formatter.format = jest.fn().mockImplementation(() => {
        throw new Error('Formatting failed');
      });

      registry.register('error', formatter);

      expect(() => {
        registry.format({}, { style: 'error' });
      }).toThrow('Formatting failed');
    });

    test('should validate formatter has required methods', () => {
      const invalidFormatter = {
        name: 'invalid',
        // Missing format method
      };

      expect(() => {
        registry.register('invalid', invalidFormatter);
      }).toThrow('Formatter must extend BaseFormatter class');
    });

    test('should handle circular references in data', () => {
      const formatter = new BaseFormatter('guide', {});
      formatter.format = jest.fn().mockReturnValue('Handled circular');
      registry.register('guide', formatter);

      const data = { name: 'test' };
      data.self = data; // Circular reference

      const result = registry.format(data, { style: 'guide' });

      expect(formatter.format).toHaveBeenCalled();
      expect(result).toBe('Handled circular');
    });
  });
});
