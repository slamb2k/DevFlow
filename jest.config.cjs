module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@commands/(.*)$': '<rootDir>/src/commands/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@output/(.*)$': '<rootDir>/src/output/$1',
    '^@integration/(.*)$': '<rootDir>/src/integration/$1'
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'esnext',
          target: 'es2022'
        }
      }
    ]
  },
  testMatch: [
    '**/__tests__/**/*.test.[jt]s',
    '**/__tests__/**/*.spec.[jt]s'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{js,ts}',
    '!src/**/*.spec.{js,ts}',
    '!src/**/index.{js,ts}'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  testTimeout: 10000,
  verbose: true,
  bail: false,
  errorOnDeprecated: true,
  maxWorkers: '50%',
  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  },
  setupFilesAfterEnv: [
    '<rootDir>/__tests__/setup.js'
  ],
  moduleDirectories: [
    'node_modules',
    'src'
  ],
  clearMocks: true,
  restoreMocks: true,
  watchPathIgnorePatterns: [
    'node_modules',
    'dist',
    'coverage'
  ]
};