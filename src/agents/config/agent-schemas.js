/**
 * Configuration schemas for specialized agents
 */

export const agentSchemas = {
  analyzer: {
    type: 'object',
    properties: {
      maxComplexity: {
        type: 'number',
        default: 10,
        description: 'Maximum acceptable cyclomatic complexity'
      },
      maxFileSize: {
        type: 'number',
        default: 1000,
        description: 'Maximum lines of code per file'
      },
      enableCaching: {
        type: 'boolean',
        default: true,
        description: 'Enable analysis result caching'
      },
      patterns: {
        type: 'object',
        properties: {
          detectAntiPatterns: { type: 'boolean', default: true },
          detectCodeSmells: { type: 'boolean', default: true },
          detectDesignPatterns: { type: 'boolean', default: true }
        }
      },
      excludePaths: {
        type: 'array',
        items: { type: 'string' },
        default: ['node_modules', 'dist', 'build', '.git'],
        description: 'Paths to exclude from analysis'
      }
    }
  },

  architect: {
    type: 'object',
    properties: {
      architectureType: {
        type: 'string',
        enum: ['layered', 'microservices', 'hexagonal', 'mvc', 'mvvm'],
        default: 'layered',
        description: 'Expected architecture pattern'
      },
      diagramFormat: {
        type: 'string',
        enum: ['mermaid', 'plantuml', 'graphviz'],
        default: 'mermaid',
        description: 'Output format for diagrams'
      },
      validationLevel: {
        type: 'string',
        enum: ['strict', 'moderate', 'lenient'],
        default: 'moderate',
        description: 'How strictly to validate architecture'
      },
      patternConfidenceThreshold: {
        type: 'number',
        default: 0.7,
        minimum: 0,
        maximum: 1,
        description: 'Minimum confidence level for pattern detection'
      },
      enableCaching: {
        type: 'boolean',
        default: true,
        description: 'Enable validation result caching'
      }
    }
  },

  security: {
    type: 'object',
    properties: {
      scanLevel: {
        type: 'string',
        enum: ['basic', 'standard', 'comprehensive'],
        default: 'standard',
        description: 'Depth of security scanning'
      },
      enableSAST: {
        type: 'boolean',
        default: true,
        description: 'Enable static application security testing'
      },
      enableSecretDetection: {
        type: 'boolean',
        default: true,
        description: 'Enable secret and credential detection'
      },
      enableDependencyAudit: {
        type: 'boolean',
        default: true,
        description: 'Enable dependency vulnerability scanning'
      },
      customRules: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            pattern: { type: 'string' },
            severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }
          }
        },
        default: [],
        description: 'Custom security rules'
      },
      excludePaths: {
        type: 'array',
        items: { type: 'string' },
        default: ['node_modules', 'test', '__tests__'],
        description: 'Paths to exclude from security scanning'
      },
      severityThreshold: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium',
        description: 'Minimum severity to report'
      }
    }
  },

  optimizer: {
    type: 'object',
    properties: {
      performanceThresholds: {
        type: 'object',
        properties: {
          loadTime: { type: 'number', default: 3000 },
          bundleSize: { type: 'number', default: 2000000 },
          cacheHitRate: { type: 'number', default: 0.7 }
        }
      },
      enableProfiling: {
        type: 'boolean',
        default: true,
        description: 'Enable performance profiling'
      },
      enableBundleAnalysis: {
        type: 'boolean',
        default: true,
        description: 'Enable bundle size analysis'
      },
      suggestionLevel: {
        type: 'string',
        enum: ['conservative', 'balanced', 'aggressive'],
        default: 'balanced',
        description: 'How aggressively to suggest optimizations'
      },
      cacheStrategy: {
        type: 'string',
        enum: ['none', 'memory', 'disk'],
        default: 'memory',
        description: 'Caching strategy for analysis results'
      },
      bottleneckSeverityThreshold: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        default: 'medium',
        description: 'Minimum severity for bottleneck reporting'
      }
    }
  }
};

/**
 * Get default configuration for an agent
 */
export function getDefaultConfig(agentId) {
  const schema = agentSchemas[agentId];
  if (!schema) {
    return {};
  }

  const config = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    if (prop.type === 'object' && prop.properties) {
      config[key] = {};
      for (const [subKey, subProp] of Object.entries(prop.properties)) {
        if ('default' in subProp) {
          config[key][subKey] = subProp.default;
        }
      }
    } else if ('default' in prop) {
      config[key] = prop.default;
    }
  }

  return config;
}

/**
 * Validate agent configuration
 */
export function validateConfig(agentId, config) {
  const schema = agentSchemas[agentId];
  if (!schema) {
    return { valid: false, errors: [`Unknown agent: ${agentId}`] };
  }

  const errors = [];

  for (const [key, prop] of Object.entries(schema.properties)) {
    const value = config[key];

    // Check type
    if (value !== undefined) {
      if (prop.type === 'number' && typeof value !== 'number') {
        errors.push(`${key} must be a number`);
      }
      if (prop.type === 'string' && typeof value !== 'string') {
        errors.push(`${key} must be a string`);
      }
      if (prop.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`${key} must be a boolean`);
      }
      if (prop.type === 'array' && !Array.isArray(value)) {
        errors.push(`${key} must be an array`);
      }

      // Check enum values
      if (prop.enum && !prop.enum.includes(value)) {
        errors.push(`${key} must be one of: ${prop.enum.join(', ')}`);
      }

      // Check numeric constraints
      if (prop.type === 'number') {
        if (prop.minimum !== undefined && value < prop.minimum) {
          errors.push(`${key} must be at least ${prop.minimum}`);
        }
        if (prop.maximum !== undefined && value > prop.maximum) {
          errors.push(`${key} must be at most ${prop.maximum}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Merge user config with defaults
 */
export function mergeWithDefaults(agentId, userConfig = {}) {
  const defaultConfig = getDefaultConfig(agentId);
  return { ...defaultConfig, ...userConfig };
}