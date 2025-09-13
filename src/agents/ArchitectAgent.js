import { BaseAgent } from './BaseAgent.js';
import fs from 'fs/promises';
import path from 'path';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';

/**
 * ArchitectAgent - Performs design pattern recognition, architecture validation,
 * diagram generation, and structure analysis
 */
export class ArchitectAgent extends BaseAgent {
  constructor(config = {}) {
    super({
      ...config,
      id: 'architect',
      name: 'ArchitectAgent',
      description: 'Performs design pattern recognition, architecture validation, and diagram generation'
    });

    this.capabilities = [
      'design-pattern-recognition',
      'architecture-validation',
      'diagram-generation',
      'structure-analysis'
    ];

    // Cache for architecture validations
    this.validationCache = new Map();
  }

  async onInitialize() {
    // Load pattern catalog
    this.state.patternCatalog = this.loadPatternCatalog();
    this.state.recognitionHistory = this.state.recognitionHistory || [];
  }

  loadPatternCatalog() {
    return [
      {
        name: 'Singleton',
        indicators: ['getInstance', 'instance', 'constructor.*throw.*instance'],
        confidence: 0.9
      },
      {
        name: 'Factory',
        indicators: ['create', 'factory', 'switch.*type', 'if.*type.*return.*new'],
        confidence: 0.85
      },
      {
        name: 'Observer',
        indicators: ['subscribe', 'unsubscribe', 'notify', 'observers', 'listeners'],
        confidence: 0.85
      },
      {
        name: 'Strategy',
        indicators: ['strategy', 'setStrategy', 'executeStrategy', 'algorithm'],
        confidence: 0.8
      },
      {
        name: 'Decorator',
        indicators: ['wrapper', 'decorate', 'enhance', 'wrap'],
        confidence: 0.75
      },
      {
        name: 'Adapter',
        indicators: ['adapt', 'adapter', 'convert', 'translate'],
        confidence: 0.75
      },
      {
        name: 'Command',
        indicators: ['execute', 'undo', 'redo', 'command', 'invoker'],
        confidence: 0.8
      },
      {
        name: 'Iterator',
        indicators: ['next', 'hasNext', 'current', 'iterator', 'Symbol.iterator'],
        confidence: 0.85
      }
    ];
  }

  canHandle(task) {
    const validTasks = [
      'recognize-patterns',
      'validate-architecture',
      'generate-diagram',
      'analyze-structure'
    ];
    return validTasks.includes(task);
  }

  async onExecute(task, context) {
    switch (task) {
      case 'recognize-patterns':
        return await this.recognizePatterns(context);
      case 'validate-architecture':
        return await this.validateArchitecture(context);
      case 'generate-diagram':
        return await this.generateDiagram(context);
      case 'analyze-structure':
        return await this.analyzeStructure(context);
      default:
        throw new Error(`Unknown task: ${task}`);
    }
  }

  async recognizePatterns(context) {
    const { filePath } = context;

    try {
      const code = await fs.readFile(filePath, 'utf-8');
      const patterns = [];

      // Check each pattern in catalog
      for (const pattern of this.state.patternCatalog) {
        let matchCount = 0;
        const totalIndicators = pattern.indicators.length;

        for (const indicator of pattern.indicators) {
          const regex = new RegExp(indicator, 'i');
          if (regex.test(code)) {
            matchCount++;
          }
        }

        if (matchCount > 0) {
          const confidence = (matchCount / totalIndicators) * pattern.confidence;
          if (confidence > 0.5) {
            patterns.push({
              name: pattern.name,
              confidence: Number(confidence.toFixed(2)),
              matchedIndicators: matchCount,
              totalIndicators
            });
          }
        }
      }

      // Sort by confidence
      patterns.sort((a, b) => b.confidence - a.confidence);

      // Update state
      const historyEntry = {
        file: filePath,
        patterns,
        timestamp: new Date().toISOString()
      };

      this.state.recognitionHistory.push(historyEntry);
      await this.saveState();

      return { patterns };
    } catch (error) {
      throw new Error(`Failed to recognize patterns: ${error.message}`);
    }
  }

  async validateArchitecture(context) {
    const { directory, type, filePath, useCache } = context;

    // Check cache
    const cacheKey = `${directory || filePath}-${type}`;
    if (useCache && this.validationCache.has(cacheKey)) {
      return {
        ...this.validationCache.get(cacheKey),
        cached: true
      };
    }

    let result;

    switch (type) {
      case 'layered':
        result = await this.validateLayeredArchitecture(directory, filePath);
        break;
      case 'microservices':
        result = await this.validateMicroservicesArchitecture(directory);
        break;
      case 'hexagonal':
        result = await this.validateHexagonalArchitecture(directory);
        break;
      default:
        throw new Error(`Unknown architecture type: ${type}`);
    }

    // Cache result
    if (useCache) {
      this.validationCache.set(cacheKey, result);
    }

    return result;
  }

  async validateLayeredArchitecture(directory, filePath) {
    const violations = [];
    const layers = [];

    if (directory) {
      // Check directory structure
      try {
        const entries = await fs.readdir(directory);
        const expectedLayers = ['controllers', 'services', 'repositories', 'models'];

        for (const layer of expectedLayers) {
          if (entries.includes(layer)) {
            layers.push(layer);
          }
        }

        const valid = layers.length >= 3; // At least 3 layers

        return {
          valid,
          architecture: 'layered',
          layers,
          violations: valid ? [] : [{
            type: 'missing-layers',
            message: 'Layered architecture requires at least 3 distinct layers'
          }]
        };
      } catch (error) {
        throw new Error(`Failed to validate layered architecture: ${error.message}`);
      }
    }

    if (filePath) {
      // Check for layer violations in file
      const code = await fs.readFile(filePath, 'utf-8');

      // Controller should not import repository directly
      if (filePath.includes('controller')) {
        if (code.includes('Repository') && !code.includes('Service')) {
          violations.push({
            type: 'layer-violation',
            message: 'Controller accessing repository directly, should go through service layer',
            file: filePath
          });
        }
      }

      // Service should not import controller
      if (filePath.includes('service')) {
        if (code.includes('Controller')) {
          violations.push({
            type: 'layer-violation',
            message: 'Service should not depend on controller layer',
            file: filePath
          });
        }
      }

      return {
        valid: violations.length === 0,
        violations
      };
    }
  }

  async validateMicroservicesArchitecture(directory) {
    try {
      const entries = await fs.readdir(directory);
      const services = [];
      let apiGateway = null;

      for (const entry of entries) {
        if (entry.includes('service') || entry.includes('api')) {
          const stat = await fs.stat(path.join(directory, entry));
          if (stat.isDirectory()) {
            if (entry.includes('gateway')) {
              apiGateway = entry;
            } else {
              services.push(entry);
            }
          }
        }
      }

      return {
        valid: services.length > 0,
        architecture: 'microservices',
        services,
        apiGateway,
        sharedLibraries: entries.includes('shared') || entries.includes('common')
      };
    } catch (error) {
      throw new Error(`Failed to validate microservices architecture: ${error.message}`);
    }
  }

  async validateHexagonalArchitecture(directory) {
    try {
      const entries = await fs.readdir(directory);
      const core = [];
      const ports = [];
      const adapters = [];

      for (const entry of entries) {
        if (entry === 'domain' || entry === 'core' || entry === 'application') {
          core.push(entry);
        } else if (entry === 'ports' || entry.includes('port')) {
          ports.push(entry);
        } else if (entry === 'adapters' || entry === 'infrastructure') {
          adapters.push(entry);
        }
      }

      const valid = core.length > 0 && (ports.length > 0 || adapters.length > 0);

      return {
        valid,
        architecture: 'hexagonal',
        core,
        ports,
        adapters
      };
    } catch (error) {
      throw new Error(`Failed to validate hexagonal architecture: ${error.message}`);
    }
  }

  async generateDiagram(context) {
    const { directory, filePath, type } = context;

    switch (type) {
      case 'component':
        return await this.generateComponentDiagram(directory);
      case 'class':
        return await this.generateClassDiagram(filePath);
      case 'sequence':
        return await this.generateSequenceDiagram(filePath);
      case 'architecture-overview':
        return await this.generateArchitectureOverview(directory);
      default:
        throw new Error(`Unknown diagram type: ${type}`);
    }
  }

  async generateComponentDiagram(directory) {
    try {
      const files = await fs.readdir(directory);
      const components = files
        .filter(f => f.endsWith('.js') || f.endsWith('.jsx'))
        .map(f => f.replace(/\.(js|jsx)$/, ''));

      let diagram = 'graph TD\n';

      // Analyze dependencies between components
      for (const file of files) {
        if (file.endsWith('.js') || file.endsWith('.jsx')) {
          try {
            const code = await fs.readFile(path.join(directory, file), 'utf-8');
            const componentName = file.replace(/\.(js|jsx)$/, '');

            // Extract imports
            const importRegex = /import.*from\s+['"]\.\/(.*?)['"]/g;
            let match;
            while ((match = importRegex.exec(code)) !== null) {
              const imported = match[1].replace(/\.(js|jsx)$/, '');
              diagram += `    ${componentName} --> ${imported}\n`;
            }
          } catch (error) {
            // Skip files that can't be read
          }
        }
      }

      return {
        diagram,
        format: 'mermaid',
        components
      };
    } catch (error) {
      throw new Error(`Failed to generate component diagram: ${error.message}`);
    }
  }

  async generateClassDiagram(filePath) {
    try {
      const code = await fs.readFile(filePath, 'utf-8');
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx'],
        errorRecovery: true
      });

      let diagram = 'classDiagram\n';
      const classes = new Map();
      const inheritance = [];

      traverse.default(ast, {
        ClassDeclaration(path) {
          const className = path.node.id?.name || 'Anonymous';
          const superClass = path.node.superClass?.name;

          if (superClass) {
            inheritance.push(`${className} --|> ${superClass}`);
          }

          const methods = [];
          const properties = [];

          path.traverse({
            ClassMethod(methodPath) {
              const methodName = methodPath.node.key.name;
              const params = methodPath.node.params.map(p => p.name || 'param').join(', ');
              methods.push(`+${methodName}(${params})`);
            },
            ClassProperty(propPath) {
              const propName = propPath.node.key.name;
              properties.push(`+${propName}`);
            }
          });

          classes.set(className, { methods, properties });
        }
      });

      // Build class definitions
      for (const [className, details] of classes.entries()) {
        diagram += `    class ${className} {\n`;
        details.properties.forEach(prop => {
          diagram += `        ${prop}\n`;
        });
        details.methods.forEach(method => {
          diagram += `        ${method}\n`;
        });
        diagram += '    }\n';
      }

      // Add inheritance relationships
      inheritance.forEach(rel => {
        diagram += `    ${rel}\n`;
      });

      return {
        diagram,
        format: 'mermaid'
      };
    } catch (error) {
      throw new Error(`Failed to generate class diagram: ${error.message}`);
    }
  }

  async generateSequenceDiagram(filePath) {
    try {
      const code = await fs.readFile(filePath, 'utf-8');

      // Extract service calls
      const servicePattern = /(\w+Service|\w+Repository|\w+Client)\.(\w+)/g;
      const matches = [];
      let match;

      while ((match = servicePattern.exec(code)) !== null) {
        matches.push({
          service: match[1],
          method: match[2]
        });
      }

      let diagram = 'sequenceDiagram\n';
      diagram += '    participant Client\n';

      const services = [...new Set(matches.map(m => m.service))];
      services.forEach(service => {
        diagram += `    participant ${service}\n`;
      });

      // Generate sequence
      matches.forEach(m => {
        diagram += `    Client->>+${m.service}: ${m.method}()\n`;
        diagram += `    ${m.service}-->>-Client: response\n`;
      });

      return {
        diagram,
        format: 'mermaid'
      };
    } catch (error) {
      throw new Error(`Failed to generate sequence diagram: ${error.message}`);
    }
  }

  async generateArchitectureOverview(directory) {
    try {
      const entries = await fs.readdir(directory);

      let diagram = 'graph TB\n';
      diagram += '    subgraph "Application Architecture"\n';

      // Identify main components
      if (entries.includes('src')) {
        diagram += '        src[Source Code]\n';
      }
      if (entries.includes('tests') || entries.includes('test')) {
        diagram += '        tests[Tests]\n';
      }
      if (entries.includes('docs')) {
        diagram += '        docs[Documentation]\n';
      }
      if (entries.includes('config')) {
        diagram += '        config[Configuration]\n';
      }
      if (entries.includes('scripts')) {
        diagram += '        scripts[Scripts]\n';
      }

      diagram += '    end\n';

      // Add relationships
      if (entries.includes('src') && entries.includes('tests')) {
        diagram += '    tests --> src\n';
      }
      if (entries.includes('config') && entries.includes('src')) {
        diagram += '    src --> config\n';
      }

      return {
        diagram,
        format: 'mermaid',
        type: 'architecture-overview'
      };
    } catch (error) {
      throw new Error(`Failed to generate architecture overview: ${error.message}`);
    }
  }

  async analyzeStructure(context) {
    const { directory } = context;

    try {
      const structure = await this.mapDirectoryStructure(directory);
      const metrics = this.calculateStructureMetrics(structure);
      const issues = this.detectStructureIssues(structure, metrics);
      const recommendations = this.generateRecommendations(issues, metrics);

      return {
        structure,
        metrics,
        issues,
        recommendations
      };
    } catch (error) {
      throw new Error(`Failed to analyze structure: ${error.message}`);
    }
  }

  async mapDirectoryStructure(dir, level = 0, maxLevel = 5) {
    const structure = {
      name: path.basename(dir),
      type: 'directory',
      level,
      children: []
    };

    if (level >= maxLevel) {
      return structure;
    }

    try {
      const entries = await fs.readdir(dir);

      for (const entry of entries) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;

        const fullPath = path.join(dir, entry);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          const subStructure = await this.mapDirectoryStructure(fullPath, level + 1, maxLevel);
          structure.children.push(subStructure);
        } else if (stat.isFile()) {
          structure.children.push({
            name: entry,
            type: 'file',
            level: level + 1
          });
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }

    return structure;
  }

  calculateStructureMetrics(structure) {
    let metrics = {
      directories: 0,
      files: 0,
      maxDepth: 0,
      avgFilesPerDir: 0
    };

    const traverse = (node, depth = 0) => {
      if (node.type === 'directory') {
        metrics.directories++;
        metrics.maxDepth = Math.max(metrics.maxDepth, depth);

        const fileCount = node.children.filter(c => c.type === 'file').length;
        metrics.avgFilesPerDir += fileCount;

        node.children.forEach(child => traverse(child, depth + 1));
      } else {
        metrics.files++;
      }
    };

    traverse(structure);

    if (metrics.directories > 0) {
      metrics.avgFilesPerDir = metrics.avgFilesPerDir / metrics.directories;
    }

    return metrics;
  }

  detectStructureIssues(structure, metrics) {
    const issues = [];

    // Check for deep nesting
    if (metrics.maxDepth > 5) {
      issues.push({
        type: 'deep-nesting',
        severity: 'medium',
        message: `Directory structure is nested ${metrics.maxDepth} levels deep`
      });
    }

    // Check for too many files in single directory
    const checkFlatStructure = (node) => {
      if (node.type === 'directory') {
        const fileCount = node.children.filter(c => c.type === 'file').length;
        if (fileCount > 20) {
          issues.push({
            type: 'too-many-files',
            severity: 'low',
            directory: node.name,
            fileCount
          });
        }
        node.children.forEach(checkFlatStructure);
      }
    };

    checkFlatStructure(structure);

    return issues;
  }

  generateRecommendations(issues, metrics) {
    const recommendations = [];

    if (issues.some(i => i.type === 'deep-nesting')) {
      recommendations.push({
        type: 'flatten-structure',
        message: 'Consider flattening the directory structure to improve maintainability'
      });
    }

    if (issues.some(i => i.type === 'too-many-files')) {
      recommendations.push({
        type: 'organize-files',
        message: 'Consider organizing files into subdirectories by feature or type'
      });
    }

    if (metrics.avgFilesPerDir > 15) {
      recommendations.push({
        type: 'split-directories',
        message: 'Consider splitting large directories into smaller, focused modules'
      });
    }

    return recommendations;
  }
}