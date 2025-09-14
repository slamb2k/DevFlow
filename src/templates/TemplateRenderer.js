class TemplateRenderer {
  constructor() {
    this.helpers = new Map();
    this.registerDefaultHelpers();
  }

  registerDefaultHelpers() {
    // String helpers
    this.registerHelper('uppercase', (str) => String(str).toUpperCase());
    this.registerHelper('lowercase', (str) => String(str).toLowerCase());
    this.registerHelper('capitalize', (str) => {
      const s = String(str);
      return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    });
    this.registerHelper('camelCase', (str) => {
      return String(str)
        .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
    });
    this.registerHelper('kebabCase', (str) => {
      return String(str)
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
    });
    this.registerHelper('snakeCase', (str) => {
      return String(str)
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase();
    });

    // Date helpers
    this.registerHelper('date', () => new Date().toISOString().split('T')[0]);
    this.registerHelper('time', () => new Date().toISOString().split('T')[1].split('.')[0]);
    this.registerHelper('timestamp', () => new Date().toISOString());
    this.registerHelper('year', () => new Date().getFullYear());

    // Logic helpers
    this.registerHelper('if', (condition, trueValue, falseValue = '') => {
      return condition ? trueValue : falseValue;
    });
    this.registerHelper('unless', (condition, value) => {
      return !condition ? value : '';
    });
    this.registerHelper('eq', (a, b) => a === b);
    this.registerHelper('ne', (a, b) => a !== b);
    this.registerHelper('gt', (a, b) => a > b);
    this.registerHelper('gte', (a, b) => a >= b);
    this.registerHelper('lt', (a, b) => a < b);
    this.registerHelper('lte', (a, b) => a <= b);

    // Array helpers
    this.registerHelper('join', (arr, separator = ', ') => {
      return Array.isArray(arr) ? arr.join(separator) : String(arr);
    });
    this.registerHelper('first', (arr) => {
      return Array.isArray(arr) ? arr[0] : arr;
    });
    this.registerHelper('last', (arr) => {
      return Array.isArray(arr) ? arr[arr.length - 1] : arr;
    });
    this.registerHelper('length', (arr) => {
      return Array.isArray(arr) ? arr.length : String(arr).length;
    });

    // Math helpers
    this.registerHelper('add', (a, b) => Number(a) + Number(b));
    this.registerHelper('subtract', (a, b) => Number(a) - Number(b));
    this.registerHelper('multiply', (a, b) => Number(a) * Number(b));
    this.registerHelper('divide', (a, b) => Number(a) / Number(b));
    this.registerHelper('round', (n, decimals = 0) => {
      const factor = Math.pow(10, decimals);
      return Math.round(Number(n) * factor) / factor;
    });
  }

  registerHelper(name, fn) {
    this.helpers.set(name, fn);
  }

  render(template, variables = {}) {
    // Merge with parent template if exists
    let content = template.content;
    let mergedVariables = { ...variables };

    if (template.parent) {
      // This would need access to TemplateManager to get parent template
      // For now, we'll just use the current template
      console.warn('Template inheritance not fully implemented in standalone renderer');
    }

    // Apply default values for missing variables
    if (template.variables) {
      for (const varDef of template.variables) {
        if (mergedVariables[varDef.name] === undefined && varDef.default !== undefined) {
          mergedVariables[varDef.name] = varDef.default;
        }
      }
    }

    // Render content
    if (typeof content === 'string') {
      return this.renderString(content, mergedVariables);
    } else if (typeof content === 'object') {
      return this.renderObject(content, mergedVariables);
    }

    return content;
  }

  renderString(content, variables) {
    let rendered = content;

    // Replace simple variables {{varName}}
    rendered = rendered.replace(/\{\{([^}|]+)\}\}/g, (match, varName) => {
      const trimmed = varName.trim();
      const value = this.resolveVariable(trimmed, variables);
      return value !== undefined ? String(value) : match;
    });

    // Replace variables with helpers {{varName|helper}}
    rendered = rendered.replace(/\{\{([^}|]+)\|([^}]+)\}\}/g, (match, varName, helperChain) => {
      const trimmed = varName.trim();
      let value = this.resolveVariable(trimmed, variables);

      if (value === undefined) {
        return match;
      }

      // Apply helper chain
      const helpers = helperChain.split('|').map(h => h.trim());
      for (const helperCall of helpers) {
        value = this.applyHelper(helperCall, value, variables);
      }

      return String(value);
    });

    // Process conditionals {{#if condition}}...{{/if}}
    rendered = this.processConditionals(rendered, variables);

    // Process loops {{#each array}}...{{/each}}
    rendered = this.processLoops(rendered, variables);

    // Process includes {{> templateName}}
    rendered = this.processIncludes(rendered, variables);

    return rendered;
  }

  renderObject(content, variables) {
    const rendered = {};

    for (const [key, value] of Object.entries(content)) {
      const renderedKey = this.renderString(key, variables);

      if (typeof value === 'string') {
        rendered[renderedKey] = this.renderString(value, variables);
      } else if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          rendered[renderedKey] = value.map(item => {
            if (typeof item === 'string') {
              return this.renderString(item, variables);
            } else if (typeof item === 'object') {
              return this.renderObject(item, variables);
            }
            return item;
          });
        } else {
          rendered[renderedKey] = this.renderObject(value, variables);
        }
      } else {
        rendered[renderedKey] = value;
      }
    }

    return rendered;
  }

  resolveVariable(path, variables) {
    const parts = path.split('.');
    let value = variables;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }

      // Handle array indices
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, prop, index] = arrayMatch;
        value = value[prop];
        if (Array.isArray(value)) {
          value = value[parseInt(index)];
        } else {
          return undefined;
        }
      } else {
        value = value[part];
      }
    }

    return value;
  }

  applyHelper(helperCall, value, variables) {
    // Parse helper call (might have arguments)
    const match = helperCall.match(/^(\w+)(?:\((.*)\))?$/);
    if (!match) {
      return value;
    }

    const [, helperName, argsString] = match;
    const helper = this.helpers.get(helperName);

    if (!helper) {
      console.warn(`Unknown helper: ${helperName}`);
      return value;
    }

    // Parse arguments
    const args = [value];
    if (argsString) {
      const parsedArgs = this.parseArguments(argsString, variables);
      args.push(...parsedArgs);
    }

    try {
      return helper(...args);
    } catch (error) {
      console.error(`Error in helper ${helperName}:`, error);
      return value;
    }
  }

  parseArguments(argsString, variables) {
    const args = [];
    const parts = argsString.split(',').map(s => s.trim());

    for (const part of parts) {
      // String literal
      if (part.startsWith('"') && part.endsWith('"')) {
        args.push(part.slice(1, -1));
      }
      // Number literal
      else if (!isNaN(part)) {
        args.push(Number(part));
      }
      // Boolean literal
      else if (part === 'true' || part === 'false') {
        args.push(part === 'true');
      }
      // Variable reference
      else {
        const value = this.resolveVariable(part, variables);
        args.push(value);
      }
    }

    return args;
  }

  processConditionals(content, variables) {
    const ifPattern = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)(?:\{\{#else\}\}([\s\S]*?))?\{\{\/if\}\}/g;

    return content.replace(ifPattern, (match, condition, trueBlock, falseBlock = '') => {
      const conditionValue = this.evaluateCondition(condition, variables);
      return conditionValue ? trueBlock : falseBlock;
    });
  }

  evaluateCondition(condition, variables) {
    // Simple variable check
    const value = this.resolveVariable(condition.trim(), variables);

    // Check for comparison operators
    const comparisonMatch = condition.match(/^(.+?)\s*(==|!=|>|>=|<|<=)\s*(.+)$/);
    if (comparisonMatch) {
      const [, left, operator, right] = comparisonMatch;
      const leftValue = this.resolveVariable(left.trim(), variables);
      const rightValue = this.parseValue(right.trim(), variables);

      switch (operator) {
        case '==': return leftValue == rightValue;
        case '!=': return leftValue != rightValue;
        case '>': return leftValue > rightValue;
        case '>=': return leftValue >= rightValue;
        case '<': return leftValue < rightValue;
        case '<=': return leftValue <= rightValue;
      }
    }

    // Truthy check
    return !!value;
  }

  parseValue(value, variables) {
    // String literal
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    }
    // Number literal
    if (!isNaN(value)) {
      return Number(value);
    }
    // Boolean literal
    if (value === 'true' || value === 'false') {
      return value === 'true';
    }
    // Variable reference
    return this.resolveVariable(value, variables);
  }

  processLoops(content, variables) {
    const eachPattern = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

    return content.replace(eachPattern, (match, arrayName, loopBlock) => {
      const array = this.resolveVariable(arrayName.trim(), variables);

      if (!Array.isArray(array)) {
        return '';
      }

      const results = [];
      for (let i = 0; i < array.length; i++) {
        const item = array[i];
        const loopVariables = {
          ...variables,
          item,
          index: i,
          first: i === 0,
          last: i === array.length - 1
        };

        // If item is an object, spread its properties
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          Object.assign(loopVariables, item);
        }

        results.push(this.renderString(loopBlock, loopVariables));
      }

      return results.join('');
    });
  }

  processIncludes(content, variables) {
    const includePattern = /\{\{>\s*([^}]+)\}\}/g;

    return content.replace(includePattern, (match, templateName) => {
      // This would need access to TemplateManager to include other templates
      // For now, we'll just return a placeholder
      console.warn(`Template include not implemented: ${templateName}`);
      return `<!-- Include: ${templateName} -->`;
    });
  }

  escapeHtml(str) {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return String(str).replace(/[&<>"']/g, char => escapeMap[char]);
  }
}

export default TemplateRenderer;