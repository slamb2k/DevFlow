/**
 * Jest setup file
 * Configure test environment and global test utilities
 */

import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Suppress console output during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Add custom matchers if needed
expect.extend({
  toBeValidPath(received) {
    const pass = typeof received === 'string' && received.length > 0;
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be a valid path`
          : `Expected ${received} to be a valid path`,
    };
  },
});

// Global test utilities
global.testUtils = {
  mockFs: () => {
    const fs = require('fs');
    jest.spyOn(fs, 'readFile');
    jest.spyOn(fs, 'writeFile');
    jest.spyOn(fs, 'mkdir');
    jest.spyOn(fs, 'access');
  },

  restoreFs: () => {
    jest.restoreAllMocks();
  },

  createMockLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});