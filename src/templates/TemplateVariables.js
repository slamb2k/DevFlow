class TemplateVariables {
  constructor() {
    this.variables = new Map();
    this.computed = new Map();
  }

  define(name, definition) {
    if (!name || typeof name !== 'string') {
      throw new Error('Variable name must be a non-empty string');
    }

    const varDef = {
      name,
      type: definition.type || 'string',
      default: definition.default,
      required: definition.required || false,
      description: definition.description,
      choices: definition.choices,
      validation: definition.validation,
      computed: definition.computed || false,
      computeFn: definition.computeFn
    };

    if (varDef.computed && !varDef.computeFn) {
      throw new Error(`Computed variable ${name} must have a computeFn`);
    }

    if (varDef.computed) {
      this.computed.set(name, varDef);
    } else {
      this.variables.set(name, varDef);
    }

    return varDef;
  }

  get(name) {
    return this.variables.get(name) || this.computed.get(name);
  }

  getAll() {
    return [
      ...Array.from(this.variables.values()),
      ...Array.from(this.computed.values())
    ];
  }

  resolve(providedVariables = {}) {
    const resolved = { ...providedVariables };

    // Apply defaults for missing variables
    for (const [name, varDef] of this.variables) {
      if (resolved[name] === undefined && varDef.default !== undefined) {
        resolved[name] = this.cloneValue(varDef.default);
      }
    }

    // Compute computed variables
    for (const [name, varDef] of this.computed) {
      if (varDef.computeFn) {
        try {
          resolved[name] = varDef.computeFn(resolved);
        } catch (error) {
          console.error(`Error computing variable ${name}:`, error);
          resolved[name] = undefined;
        }
      }
    }

    return resolved;
  }

  validate(providedVariables) {
    const errors = [];

    // Check required variables
    for (const [name, varDef] of this.variables) {
      const value = providedVariables[name];

      if (varDef.required && value === undefined) {
        errors.push({
          field: name,
          message: `Required variable '${name}' is missing`
        });
        continue;
      }

      if (value !== undefined) {
        // Type validation
        const typeError = this.validateType(value, varDef.type);
        if (typeError) {
          errors.push({
            field: name,
            message: `Variable '${name}': ${typeError}`
          });
        }

        // Choices validation
        if (varDef.choices && !varDef.choices.includes(value)) {
          errors.push({
            field: name,
            message: `Variable '${name}' must be one of: ${varDef.choices.join(', ')}`
          });
        }

        // Custom validation
        if (varDef.validation) {
          const validationErrors = this.runValidation(name, value, varDef.validation);
          errors.push(...validationErrors);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateType(value, expectedType) {
    switch (expectedType) {
      case 'string':
        if (typeof value !== 'string') {
          return `Expected string, got ${typeof value}`;
        }
        break;

      case 'number':
        if (typeof value !== 'number') {
          return `Expected number, got ${typeof value}`;
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return `Expected boolean, got ${typeof value}`;
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          return `Expected array, got ${typeof value}`;
        }
        break;

      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return `Expected object, got ${typeof value}`;
        }
        break;

      case 'date':
        if (!(value instanceof Date) && isNaN(Date.parse(value))) {
          return `Expected valid date, got ${typeof value}`;
        }
        break;

      case 'regex':
        try {
          new RegExp(value);
        } catch {
          return `Expected valid regex pattern`;
        }
        break;
    }

    return null;
  }

  runValidation(name, value, rules) {
    const errors = [];

    // Pattern validation
    if (rules.pattern && typeof value === 'string') {
      const regex = new RegExp(rules.pattern);
      if (!regex.test(value)) {
        errors.push({
          field: name,
          message: rules.patternMessage || `Value does not match pattern: ${rules.pattern}`
        });
      }
    }

    // Length validations
    if (typeof value === 'string' || Array.isArray(value)) {
      const length = value.length;

      if (rules.minLength !== undefined && length < rules.minLength) {
        errors.push({
          field: name,
          message: `Minimum length is ${rules.minLength}, got ${length}`
        });
      }

      if (rules.maxLength !== undefined && length > rules.maxLength) {
        errors.push({
          field: name,
          message: `Maximum length is ${rules.maxLength}, got ${length}`
        });
      }
    }

    // Numeric validations
    if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push({
          field: name,
          message: `Minimum value is ${rules.min}, got ${value}`
        });
      }

      if (rules.max !== undefined && value > rules.max) {
        errors.push({
          field: name,
          message: `Maximum value is ${rules.max}, got ${value}`
        });
      }
    }

    // Custom validator function
    if (rules.custom && typeof rules.custom === 'function') {
      const customResult = rules.custom(value);
      if (customResult !== true) {
        errors.push({
          field: name,
          message: typeof customResult === 'string' ? customResult : 'Custom validation failed'
        });
      }
    }

    return errors;
  }

  merge(otherVariables) {
    const merged = new TemplateVariables();

    // Copy this instance's variables
    for (const [name, varDef] of this.variables) {
      merged.variables.set(name, { ...varDef });
    }
    for (const [name, varDef] of this.computed) {
      merged.computed.set(name, { ...varDef });
    }

    // Merge with other variables
    if (otherVariables instanceof TemplateVariables) {
      for (const [name, varDef] of otherVariables.variables) {
        merged.variables.set(name, { ...varDef });
      }
      for (const [name, varDef] of otherVariables.computed) {
        merged.computed.set(name, { ...varDef });
      }
    } else if (Array.isArray(otherVariables)) {
      // Merge from array of variable definitions
      for (const varDef of otherVariables) {
        merged.define(varDef.name, varDef);
      }
    }

    return merged;
  }

  substitute(template, variables) {
    const resolved = this.resolve(variables);

    if (typeof template === 'string') {
      return this.substituteString(template, resolved);
    } else if (typeof template === 'object' && template !== null) {
      return this.substituteObject(template, resolved);
    }

    return template;
  }

  substituteString(str, variables) {
    // Replace {{variable}} patterns
    return str.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const trimmed = path.trim();
      const value = this.resolvePath(trimmed, variables);
      return value !== undefined ? String(value) : match;
    });
  }

  substituteObject(obj, variables) {
    if (Array.isArray(obj)) {
      return obj.map(item => this.substitute(item, variables));
    }

    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const substitutedKey = this.substituteString(key, variables);
      result[substitutedKey] = this.substitute(value, variables);
    }
    return result;
  }

  resolvePath(path, variables) {
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

  cloneValue(value) {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === 'object') {
      if (value instanceof Date) {
        return new Date(value);
      }
      if (Array.isArray(value)) {
        return value.map(item => this.cloneValue(item));
      }
      const cloned = {};
      for (const [key, val] of Object.entries(value)) {
        cloned[key] = this.cloneValue(val);
      }
      return cloned;
    }
    return value;
  }

  extractFromTemplate(template) {
    const extracted = new Set();
    const pattern = /\{\{([^}]+)\}\}/g;

    const extractFromString = (str) => {
      let match;
      while ((match = pattern.exec(str)) !== null) {
        const varName = match[1].trim().split('.')[0].split('[')[0];
        extracted.add(varName);
      }
    };

    const extractFromValue = (value) => {
      if (typeof value === 'string') {
        extractFromString(value);
      } else if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(extractFromValue);
        } else {
          Object.values(value).forEach(extractFromValue);
        }
      }
    };

    extractFromValue(template);
    return Array.from(extracted);
  }

  getDependencies(varName) {
    const varDef = this.get(varName);
    if (!varDef || !varDef.computed || !varDef.computeFn) {
      return [];
    }

    // Parse the compute function to find dependencies
    // This is a simple implementation - in production you'd want proper AST parsing
    const fnString = varDef.computeFn.toString();
    const deps = new Set();

    // Look for variable references in the function
    const matches = fnString.match(/variables\[['"](\w+)['"]\]/g) || [];
    for (const match of matches) {
      const depName = match.match(/variables\[['"](\w+)['"]\]/)[1];
      if (depName !== varName) {
        deps.add(depName);
      }
    }

    return Array.from(deps);
  }

  getRequired() {
    const required = [];
    for (const [name, varDef] of this.variables) {
      if (varDef.required) {
        required.push(name);
      }
    }
    return required;
  }

  getOptional() {
    const optional = [];
    for (const [name, varDef] of this.variables) {
      if (!varDef.required) {
        optional.push(name);
      }
    }
    return optional;
  }

  getComputed() {
    return Array.from(this.computed.keys());
  }

  toJSON() {
    return {
      variables: Array.from(this.variables.values()),
      computed: Array.from(this.computed.values())
    };
  }

  static fromJSON(json) {
    const instance = new TemplateVariables();

    if (json.variables) {
      for (const varDef of json.variables) {
        instance.define(varDef.name, varDef);
      }
    }

    if (json.computed) {
      for (const varDef of json.computed) {
        // Recreate compute function from string if stored
        if (varDef.computeFnString) {
          varDef.computeFn = new Function('variables', varDef.computeFnString);
        }
        instance.define(varDef.name, varDef);
      }
    }

    return instance;
  }
}

export default TemplateVariables;