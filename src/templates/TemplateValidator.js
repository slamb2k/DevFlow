class TemplateValidator {
  constructor() {
    this.requiredFields = ['name', 'content'];
    this.optionalFields = ['id', 'category', 'description', 'variables', 'parent', 'tags', 'metadata'];
    this.validCategories = ['cicd', 'docker', 'config', 'documentation', 'testing', 'general'];
  }

  validateTemplate(template) {
    const errors = [];

    // Check required fields
    for (const field of this.requiredFields) {
      if (!template[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate name
    if (template.name && typeof template.name !== 'string') {
      errors.push('Template name must be a string');
    }

    // Validate content
    if (template.content) {
      if (typeof template.content !== 'string' && typeof template.content !== 'object') {
        errors.push('Template content must be a string or object');
      }
    }

    // Validate category
    if (template.category && !this.validCategories.includes(template.category)) {
      errors.push(`Invalid category: ${template.category}. Must be one of: ${this.validCategories.join(', ')}`);
    }

    // Validate variables
    if (template.variables) {
      const varErrors = this.validateVariables(template.variables);
      errors.push(...varErrors);
    }

    // Validate parent reference
    if (template.parent && typeof template.parent !== 'string') {
      errors.push('Parent reference must be a string');
    }

    // Validate tags
    if (template.tags) {
      if (!Array.isArray(template.tags)) {
        errors.push('Tags must be an array');
      } else {
        for (const tag of template.tags) {
          if (typeof tag !== 'string') {
            errors.push('All tags must be strings');
            break;
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateVariables(variables) {
    const errors = [];

    if (!Array.isArray(variables)) {
      errors.push('Variables must be an array');
      return errors;
    }

    for (let i = 0; i < variables.length; i++) {
      const variable = variables[i];

      if (!variable.name) {
        errors.push(`Variable at index ${i} missing name`);
      }

      if (variable.name && typeof variable.name !== 'string') {
        errors.push(`Variable name at index ${i} must be a string`);
      }

      // Validate variable type
      const validTypes = ['string', 'number', 'boolean', 'array', 'object'];
      if (variable.type && !validTypes.includes(variable.type)) {
        errors.push(`Variable ${variable.name} has invalid type: ${variable.type}`);
      }

      // Validate default value matches type
      if (variable.default !== undefined && variable.type) {
        const typeError = this.validateValueType(variable.default, variable.type);
        if (typeError) {
          errors.push(`Variable ${variable.name} default value: ${typeError}`);
        }
      }

      // Validate choices if present
      if (variable.choices) {
        if (!Array.isArray(variable.choices)) {
          errors.push(`Variable ${variable.name} choices must be an array`);
        } else if (variable.choices.length === 0) {
          errors.push(`Variable ${variable.name} choices cannot be empty`);
        }
      }

      // Validate validation rules
      if (variable.validation) {
        const validationErrors = this.validateValidationRules(variable.name, variable.validation);
        errors.push(...validationErrors);
      }
    }

    return errors;
  }

  validateValueType(value, expectedType) {
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
    }

    return null;
  }

  validateValidationRules(variableName, validation) {
    const errors = [];

    if (typeof validation !== 'object' || validation === null) {
      errors.push(`Validation rules for ${variableName} must be an object`);
      return errors;
    }

    // Validate pattern (regex)
    if (validation.pattern) {
      try {
        new RegExp(validation.pattern);
      } catch (e) {
        errors.push(`Invalid regex pattern for ${variableName}: ${validation.pattern}`);
      }
    }

    // Validate min/max for numbers
    if (validation.min !== undefined && typeof validation.min !== 'number') {
      errors.push(`Min value for ${variableName} must be a number`);
    }

    if (validation.max !== undefined && typeof validation.max !== 'number') {
      errors.push(`Max value for ${variableName} must be a number`);
    }

    if (validation.min !== undefined && validation.max !== undefined && validation.min > validation.max) {
      errors.push(`Min value cannot be greater than max value for ${variableName}`);
    }

    // Validate minLength/maxLength for strings
    if (validation.minLength !== undefined && typeof validation.minLength !== 'number') {
      errors.push(`MinLength for ${variableName} must be a number`);
    }

    if (validation.maxLength !== undefined && typeof validation.maxLength !== 'number') {
      errors.push(`MaxLength for ${variableName} must be a number`);
    }

    return errors;
  }

  validateRenderedContent(content, template) {
    const errors = [];

    // Check for unreplaced variables
    const unreplacedVars = this.findUnreplacedVariables(content);
    if (unreplacedVars.length > 0) {
      errors.push(`Unreplaced variables found: ${unreplacedVars.join(', ')}`);
    }

    // Validate against template-specific rules
    if (template.validation) {
      const customErrors = this.validateCustomRules(content, template.validation);
      errors.push(...customErrors);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  findUnreplacedVariables(content) {
    const pattern = /\{\{([^}]+)\}\}/g;
    const matches = [];
    let match;

    while ((match = pattern.exec(content)) !== null) {
      matches.push(match[1].trim());
    }

    return matches;
  }

  validateCustomRules(content, rules) {
    const errors = [];

    // File size validation
    if (rules.maxSize) {
      const size = Buffer.byteLength(content, 'utf8');
      if (size > rules.maxSize) {
        errors.push(`Content exceeds maximum size of ${rules.maxSize} bytes`);
      }
    }

    // Required patterns
    if (rules.requiredPatterns) {
      for (const pattern of rules.requiredPatterns) {
        const regex = new RegExp(pattern.regex);
        if (!regex.test(content)) {
          errors.push(pattern.message || `Required pattern not found: ${pattern.regex}`);
        }
      }
    }

    // Forbidden patterns
    if (rules.forbiddenPatterns) {
      for (const pattern of rules.forbiddenPatterns) {
        const regex = new RegExp(pattern.regex);
        if (regex.test(content)) {
          errors.push(pattern.message || `Forbidden pattern found: ${pattern.regex}`);
        }
      }
    }

    return errors;
  }

  validateVariableValues(variables, templateVariables) {
    const errors = [];

    for (const templateVar of templateVariables) {
      const value = variables[templateVar.name];

      // Check required variables
      if (templateVar.required && value === undefined) {
        errors.push(`Required variable missing: ${templateVar.name}`);
        continue;
      }

      // Skip optional variables that aren't provided
      if (value === undefined) {
        continue;
      }

      // Validate type
      if (templateVar.type) {
        const typeError = this.validateValueType(value, templateVar.type);
        if (typeError) {
          errors.push(`Variable ${templateVar.name}: ${typeError}`);
        }
      }

      // Validate choices
      if (templateVar.choices && !templateVar.choices.includes(value)) {
        errors.push(`Variable ${templateVar.name} must be one of: ${templateVar.choices.join(', ')}`);
      }

      // Apply validation rules
      if (templateVar.validation) {
        const validationErrors = this.applyValidationRules(templateVar.name, value, templateVar.validation);
        errors.push(...validationErrors);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  applyValidationRules(name, value, rules) {
    const errors = [];

    // Pattern validation
    if (rules.pattern && typeof value === 'string') {
      const regex = new RegExp(rules.pattern);
      if (!regex.test(value)) {
        errors.push(`${name} does not match pattern: ${rules.pattern}`);
      }
    }

    // Number range validation
    if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${name} must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`${name} must be at most ${rules.max}`);
      }
    }

    // String length validation
    if (typeof value === 'string') {
      if (rules.minLength !== undefined && value.length < rules.minLength) {
        errors.push(`${name} must be at least ${rules.minLength} characters`);
      }
      if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        errors.push(`${name} must be at most ${rules.maxLength} characters`);
      }
    }

    // Array length validation
    if (Array.isArray(value)) {
      if (rules.minItems !== undefined && value.length < rules.minItems) {
        errors.push(`${name} must have at least ${rules.minItems} items`);
      }
      if (rules.maxItems !== undefined && value.length > rules.maxItems) {
        errors.push(`${name} must have at most ${rules.maxItems} items`);
      }
    }

    return errors;
  }
}

export default TemplateValidator;