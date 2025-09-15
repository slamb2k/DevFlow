import { BaseAgent } from './BaseAgent.js';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import fs from 'fs/promises';
import path from 'path';

/**
 * AnalyzerAgent - Performs code analysis including AST parsing, complexity analysis,
 * pattern detection, and dependency analysis
 */
export class AnalyzerAgent extends BaseAgent {
  constructor(config = {}) {
    super({
      ...config,
      id: 'analyzer',
      name: 'AnalyzerAgent',
      description:
        'Performs AST parsing, complexity analysis, pattern detection, and dependency analysis',
    });

    this.capabilities = [
      'ast-parsing',
      'complexity-analysis',
      'pattern-detection',
      'dependency-analysis',
    ];

    // Analysis cache
    this.analysisCache = new Map();
  }

  async onInitialize() {
    // Load analysis rules and patterns
    this.state.analysisHistory = this.state.analysisHistory || [];
    this.state.patterns = this.state.patterns || this.loadPatterns();
  }

  loadPatterns() {
    return {
      antiPatterns: [
        { name: 'swallowed-error', regex: /catch\s*\([^)]*\)\s*{\s*(?:\/\/.*)?}/ },
        { name: 'var-in-loop', regex: /for\s*\(.*var\s+/ },
        { name: 'console-log', regex: /console\.(log|error|warn|info)/ },
      ],
      codeSmells: [
        { name: 'long-method', maxLines: 50 },
        { name: 'long-parameter-list', maxParams: 5 },
        { name: 'god-object', maxMethods: 20 },
      ],
    };
  }

  canHandle(task) {
    const validTasks = [
      'parse-ast',
      'analyze-complexity',
      'detect-patterns',
      'analyze-dependencies',
      'analyze-project',
    ];
    return validTasks.includes(task);
  }

  async onExecute(task, context) {
    switch (task) {
      case 'parse-ast':
        return await this.parseAST(context);
      case 'analyze-complexity':
        return await this.analyzeComplexity(context);
      case 'detect-patterns':
        return await this.detectPatterns(context);
      case 'analyze-dependencies':
        return await this.analyzeDependencies(context);
      case 'analyze-project':
        return await this.analyzeProject(context);
      default:
        throw new Error(`Unknown task: ${task}`);
    }
  }

  async parseAST(context) {
    const { filePath, useCache } = context;

    // Check cache
    if (useCache && this.analysisCache.has(filePath)) {
      return {
        ...this.analysisCache.get(filePath),
        cached: true,
      };
    }

    try {
      const code = await fs.readFile(filePath, 'utf-8');
      const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');

      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: isTypeScript ? ['typescript', 'jsx'] : ['jsx'],
        errorRecovery: true,
      });

      const analysis = {
        ast,
        functions: [],
        classes: [],
        interfaces: [],
        imports: [],
        exports: [],
      };

      // Extract key elements
      traverse.default(ast, {
        FunctionDeclaration(path) {
          analysis.functions.push(path.node.id?.name || 'anonymous');
        },
        ClassDeclaration(path) {
          analysis.classes.push(path.node.id?.name || 'anonymous');
        },
        TSInterfaceDeclaration(path) {
          if (isTypeScript) {
            analysis.interfaces.push(path.node.id.name);
          }
        },
        ImportDeclaration(path) {
          analysis.imports.push(path.node.source.value);
        },
        ExportNamedDeclaration(path) {
          if (path.node.declaration?.id) {
            analysis.exports.push(path.node.declaration.id.name);
          }
        },
      });

      // Cache result
      if (useCache) {
        this.analysisCache.set(filePath, analysis);
      }

      // Update state
      this.state.lastAnalysis = {
        file: filePath,
        timestamp: new Date().toISOString(),
        summary: {
          functions: analysis.functions.length,
          classes: analysis.classes.length,
          interfaces: analysis.interfaces.length,
        },
      };

      this.state.analysisHistory.push(this.state.lastAnalysis);
      await this.saveState();

      return analysis;
    } catch (error) {
      throw new Error(`Failed to parse ${filePath}: ${error.message}`);
    }
  }

  async analyzeComplexity(context) {
    const { filePath } = context;

    try {
      const code = await fs.readFile(filePath, 'utf-8');
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx'],
        errorRecovery: true,
      });

      const complexity = {
        cyclomatic: 1,
        functions: {},
        cognitive: 0,
      };

      const metrics = {
        linesOfCode: code.split('\n').length,
        commentLines:
          (code.match(/\/\/.*/g) || []).length +
          (code.match(/\/\*[\s\S]*?\*\//g) || []).join('').split('\n').length,
        maintainabilityIndex: 100,
      };

      // Calculate cyclomatic complexity
      traverse.default(ast, {
        IfStatement() {
          complexity.cyclomatic++;
        },
        ConditionalExpression() {
          complexity.cyclomatic++;
        },
        ForStatement() {
          complexity.cyclomatic++;
        },
        WhileStatement() {
          complexity.cyclomatic++;
        },
        DoWhileStatement() {
          complexity.cyclomatic++;
        },
        CatchClause() {
          complexity.cyclomatic++;
        },
        SwitchCase() {
          complexity.cyclomatic++;
        },
        LogicalExpression(path) {
          if (path.node.operator === '&&' || path.node.operator === '||') {
            complexity.cyclomatic++;
          }
        },
        FunctionDeclaration(path) {
          const funcName = path.node.id?.name || 'anonymous';
          let funcComplexity = 1;

          path.traverse({
            IfStatement() {
              funcComplexity++;
            },
            ConditionalExpression() {
              funcComplexity++;
            },
            ForStatement() {
              funcComplexity++;
            },
            WhileStatement() {
              funcComplexity++;
            },
            DoWhileStatement() {
              funcComplexity++;
            },
            CatchClause() {
              funcComplexity++;
            },
            SwitchCase() {
              funcComplexity++;
            },
          });

          complexity.functions[funcName] = funcComplexity;
        },
      });

      // Calculate maintainability index
      const volume = metrics.linesOfCode * Math.log2(complexity.cyclomatic + 1);
      const _effort = volume * complexity.cyclomatic;
      metrics.maintainabilityIndex = Math.max(
        0,
        171 -
          5.2 * Math.log(volume) -
          0.23 * complexity.cyclomatic -
          16.2 * Math.log(metrics.linesOfCode)
      );

      const recommendations = [];
      if (complexity.cyclomatic > 10) {
        recommendations.push('Consider refactoring - high cyclomatic complexity detected');
      }

      Object.entries(complexity.functions).forEach(([func, comp]) => {
        if (comp > 10) {
          recommendations.push(
            `Function '${func}' has high complexity (${comp}) - consider refactoring`
          );
        }
      });

      return {
        complexity,
        metrics,
        recommendations,
      };
    } catch (error) {
      throw new Error(`Failed to analyze complexity: ${error.message}`);
    }
  }

  async detectPatterns(context) {
    const { filePath } = context;

    try {
      const code = await fs.readFile(filePath, 'utf-8');
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx'],
        errorRecovery: true,
      });

      const patterns = [];
      const antiPatterns = [];
      const codeSmells = [];

      // Check for design patterns
      const codeStr = code.toString();

      // Singleton detection
      if (
        codeStr.includes('getInstance') ||
        (codeStr.includes('static instance') && codeStr.includes('constructor'))
      ) {
        patterns.push({ name: 'singleton', confidence: 0.9 });
      }

      // Factory detection
      if (codeStr.match(/create\w+\s*\([^)]*type/i) && codeStr.includes('switch')) {
        patterns.push({ name: 'factory', confidence: 0.8 });
      }

      // Observer detection
      if (
        codeStr.includes('subscribe') &&
        codeStr.includes('notify') &&
        codeStr.includes('observers')
      ) {
        patterns.push({ name: 'observer', confidence: 0.85 });
      }

      // Strategy detection
      if (codeStr.match(/this\.strategy\s*=/) && codeStr.includes('strategy')) {
        patterns.push({ name: 'strategy', confidence: 0.8 });
      }

      // Check for anti-patterns
      this.state.patterns.antiPatterns.forEach((pattern) => {
        if (pattern.regex.test(codeStr)) {
          antiPatterns.push({ name: pattern.name, severity: 'medium' });
        }
      });

      // Check for code smells
      traverse.default(ast, {
        FunctionDeclaration(path) {
          const funcName = path.node.id?.name || 'anonymous';
          const loc = path.node.loc;

          if (loc) {
            const lines = loc.end.line - loc.start.line;
            if (lines > 50) {
              codeSmells.push({
                type: 'long-method',
                name: funcName,
                lines,
              });
            }
          }

          const params = path.node.params.length;
          if (params > 5) {
            codeSmells.push({
              type: 'long-parameter-list',
              name: funcName,
              params,
            });
          }
        },
        ClassDeclaration(path) {
          const className = path.node.id?.name || 'anonymous';
          let methodCount = 0;

          path.traverse({
            ClassMethod() {
              methodCount++;
            },
          });

          if (methodCount > 20) {
            codeSmells.push({
              type: 'god-object',
              name: className,
              methods: methodCount,
            });
          }
        },
      });

      // Long function name detection
      if (codeStr.match(/function\s+\w{40,}/)) {
        codeSmells.push({ type: 'long-method-name' });
      }

      return {
        patterns,
        antiPatterns,
        codeSmells,
      };
    } catch (error) {
      throw new Error(`Failed to detect patterns: ${error.message}`);
    }
  }

  async analyzeDependencies(context) {
    const { filePath, directory } = context;

    if (filePath && filePath.endsWith('package.json')) {
      // Analyze package.json
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const pkg = JSON.parse(content);

        return {
          production: Object.keys(pkg.dependencies || {}),
          development: Object.keys(pkg.devDependencies || {}),
          total: Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length,
        };
      } catch (error) {
        throw new Error(`Failed to analyze package.json: ${error.message}`);
      }
    }

    if (directory) {
      // Analyze directory for circular dependencies
      const dependencies = new Map();
      const files = await this.getAllFiles(directory, ['.js', '.jsx', '.ts', '.tsx']);

      for (const file of files) {
        try {
          const code = await fs.readFile(file, 'utf-8');
          const deps = this.extractImports(code);
          dependencies.set(file, deps);
        } catch (error) {
          // Skip files that can't be read
        }
      }

      const circular = this.detectCircularDependencies(dependencies);
      return {
        totalFiles: files.length,
        dependencies: Array.from(dependencies.entries()),
        circularDependencies: circular,
      };
    }

    // Analyze single file dependencies
    try {
      const code = await fs.readFile(filePath, 'utf-8');
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx'],
        errorRecovery: true,
      });

      const dependencies = {
        imports: [],
        requires: [],
        exports: [],
      };

      traverse.default(ast, {
        ImportDeclaration(path) {
          dependencies.imports.push(path.node.source.value);
        },
        CallExpression(path) {
          if (path.node.callee.name === 'require') {
            const arg = path.node.arguments[0];
            if (arg && arg.type === 'StringLiteral') {
              dependencies.requires.push(arg.value);
            }
          }
        },
        ExportNamedDeclaration(path) {
          if (path.node.declaration?.id) {
            dependencies.exports.push(path.node.declaration.id.name);
          }
        },
      });

      return dependencies;
    } catch (error) {
      throw new Error(`Failed to analyze dependencies: ${error.message}`);
    }
  }

  async analyzeProject(context) {
    const { directory } = context;

    try {
      const files = await this.getAllFiles(directory, ['.js', '.jsx', '.ts', '.tsx']);
      const summary = {
        totalFiles: files.length,
        languages: {},
        totalLines: 0,
        avgComplexity: 0,
      };

      const codeQuality = {
        issues: [],
        score: 100,
      };

      let totalComplexity = 0;
      let analyzedFiles = 0;

      for (const file of files) {
        const ext = path.extname(file);
        summary.languages[ext] = (summary.languages[ext] || 0) + 1;

        try {
          const code = await fs.readFile(file, 'utf-8');
          summary.totalLines += code.split('\n').length;

          // Sample complexity analysis
          const complexity = await this.analyzeComplexity({ filePath: file });
          totalComplexity += complexity.complexity.cyclomatic;
          analyzedFiles++;

          // Check for quality issues
          if (complexity.complexity.cyclomatic > 20) {
            codeQuality.issues.push({
              file,
              issue: 'High complexity',
              severity: 'high',
            });
            codeQuality.score -= 5;
          }
        } catch (error) {
          // Skip files that can't be analyzed
        }
      }

      summary.avgComplexity = analyzedFiles > 0 ? totalComplexity / analyzedFiles : 0;
      codeQuality.score = Math.max(0, codeQuality.score);

      return {
        summary,
        codeQuality,
      };
    } catch (error) {
      throw new Error(`Failed to analyze project: ${error.message}`);
    }
  }

  async getAllFiles(dir, extensions) {
    const files = [];

    try {
      const entries = await fs.readdir(dir);

      for (const entry of entries) {
        if (entry === 'node_modules' || entry.startsWith('.')) {
          continue;
        }

        const fullPath = path.join(dir, entry);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          const subFiles = await this.getAllFiles(fullPath, extensions);
          files.push(...subFiles);
        } else if (stat.isFile() && extensions.some((ext) => entry.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }

    return files;
  }

  extractImports(code) {
    const imports = [];
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    const requireRegex = /require\s*\(['"]([^'"]+)['"]\)/g;

    let match;
    while ((match = importRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }
    while ((match = requireRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  detectCircularDependencies(dependencies) {
    const circular = [];
    const visited = new Set();
    const stack = new Set();

    const dfs = (file, path = []) => {
      if (stack.has(file)) {
        const cycleStart = path.indexOf(file);
        if (cycleStart !== -1) {
          circular.push(path.slice(cycleStart));
        }
        return;
      }

      if (visited.has(file)) {
        return;
      }

      visited.add(file);
      stack.add(file);
      path.push(file);

      const deps = dependencies.get(file) || [];
      for (const dep of deps) {
        // Resolve relative paths
        const resolvedDep = this.resolveDependency(file, dep);
        if (dependencies.has(resolvedDep)) {
          dfs(resolvedDep, [...path]);
        }
      }

      stack.delete(file);
    };

    for (const file of dependencies.keys()) {
      if (!visited.has(file)) {
        dfs(file);
      }
    }

    return circular;
  }

  resolveDependency(fromFile, dep) {
    if (dep.startsWith('.')) {
      return path.resolve(path.dirname(fromFile), dep);
    }
    return dep;
  }
}
