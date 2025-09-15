class TemplateInheritance {
  constructor(templateManager) {
    this.templateManager = templateManager;
    this.inheritanceChain = new Map();
  }

  async resolveInheritance(templateId) {
    const template = await this.templateManager.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Check for circular inheritance
    const chain = await this.getInheritanceChain(templateId);
    if (chain.includes(templateId)) {
      throw new Error(`Circular inheritance detected for template: ${templateId}`);
    }

    // If no parent, return as is
    if (!template.parent) {
      return template;
    }

    // Get parent template
    const parent = await this.resolveInheritance(template.parent);

    // Merge templates
    return this.mergeTemplates(parent, template);
  }

  async getInheritanceChain(templateId, chain = []) {
    const template = await this.templateManager.getTemplate(templateId);
    if (!template) {
      return chain;
    }

    if (chain.includes(templateId)) {
      throw new Error(`Circular inheritance detected: ${chain.join(' -> ')} -> ${templateId}`);
    }

    chain.push(templateId);

    if (template.parent) {
      return this.getInheritanceChain(template.parent, chain);
    }

    return chain;
  }

  mergeTemplates(parent, child) {
    const merged = {
      ...parent,
      ...child,
      // Preserve child's identity
      id: child.id,
      name: child.name,
      parent: child.parent,
    };

    // Merge variables
    merged.variables = this.mergeVariables(parent.variables, child.variables);

    // Merge content with blocks
    merged.content = this.mergeContent(parent.content, child.content);

    // Merge metadata
    merged.metadata = this.mergeMetadata(parent.metadata, child.metadata);

    // Merge tags (union)
    merged.tags = [...new Set([...(parent.tags || []), ...(child.tags || [])])];

    return merged;
  }

  mergeVariables(parentVars = [], childVars = []) {
    const merged = new Map();

    // Add parent variables
    for (const variable of parentVars) {
      merged.set(variable.name, { ...variable });
    }

    // Override with child variables
    for (const variable of childVars) {
      if (merged.has(variable.name)) {
        // Merge variable definitions
        const parent = merged.get(variable.name);
        merged.set(variable.name, {
          ...parent,
          ...variable,
          // Preserve parent's validation if child doesn't override
          validation: variable.validation || parent.validation,
        });
      } else {
        merged.set(variable.name, { ...variable });
      }
    }

    return Array.from(merged.values());
  }

  mergeContent(parentContent, childContent) {
    // If both are strings, look for block overrides
    if (typeof parentContent === 'string' && typeof childContent === 'string') {
      return this.mergeStringContent(parentContent, childContent);
    }

    // If both are objects, deep merge
    if (typeof parentContent === 'object' && typeof childContent === 'object') {
      return this.deepMerge(parentContent, childContent);
    }

    // Child completely overrides parent
    return childContent;
  }

  mergeStringContent(parentContent, childContent) {
    // Extract blocks from child
    const childBlocks = this.extractBlocks(childContent);

    // Replace blocks in parent
    let merged = parentContent;
    for (const [blockName, blockContent] of childBlocks.entries()) {
      const blockPattern = new RegExp(
        `\\{\\{#block\\s+${blockName}\\}\\}[\\s\\S]*?\\{\\{/block\\}\\}`,
        'g'
      );
      merged = merged.replace(blockPattern, blockContent);
    }

    // If child has content outside blocks, append it
    const childWithoutBlocks = this.removeBlocks(childContent);
    if (childWithoutBlocks.trim()) {
      // Look for {{#content}} placeholder in parent
      if (merged.includes('{{#content}}')) {
        merged = merged.replace('{{#content}}', childWithoutBlocks);
      } else {
        // Append to end if no placeholder
        merged += `\n${childWithoutBlocks}`;
      }
    }

    return merged;
  }

  extractBlocks(content) {
    const blocks = new Map();
    const blockPattern = /\{\{#block\s+(\w+)\}\}([\s\S]*?)\{\{\/block\}\}/g;
    let match;

    while ((match = blockPattern.exec(content)) !== null) {
      const [_fullMatch, blockName, blockContent] = match;
      blocks.set(blockName, blockContent.trim());
    }

    return blocks;
  }

  removeBlocks(content) {
    const blockPattern = /\{\{#block\s+\w+\}\}[\s\S]*?\{\{\/block\}\}/g;
    return content.replace(blockPattern, '').trim();
  }

  deepMerge(parent, child) {
    if (Array.isArray(parent) && Array.isArray(child)) {
      // For arrays, child replaces parent unless special merge directive
      return child;
    }

    if (typeof parent !== 'object' || typeof child !== 'object') {
      return child;
    }

    const merged = { ...parent };

    for (const [key, value] of Object.entries(child)) {
      if (key.startsWith('$')) {
        // Special merge directives
        const directive = key;
        const targetKey = directive.substring(1);

        switch (directive) {
          case `$append_${targetKey}`:
            // Append to array
            if (Array.isArray(merged[targetKey])) {
              merged[targetKey] = [...merged[targetKey], ...value];
            }
            break;

          case `$prepend_${targetKey}`:
            // Prepend to array
            if (Array.isArray(merged[targetKey])) {
              merged[targetKey] = [...value, ...merged[targetKey]];
            }
            break;

          case `$merge_${targetKey}`:
            // Deep merge objects
            if (typeof merged[targetKey] === 'object') {
              merged[targetKey] = this.deepMerge(merged[targetKey], value);
            }
            break;

          case `$replace_${targetKey}`:
            // Replace entirely
            merged[targetKey] = value;
            break;
        }
      } else if (value === null) {
        // null means remove this key
        delete merged[key];
      } else if (typeof value === 'object' && typeof merged[key] === 'object') {
        // Recursive merge for nested objects
        merged[key] = this.deepMerge(merged[key], value);
      } else {
        // Simple override
        merged[key] = value;
      }
    }

    return merged;
  }

  mergeMetadata(parentMeta = {}, childMeta = {}) {
    return this.deepMerge(parentMeta, childMeta);
  }

  async validateInheritance(templateId) {
    try {
      const chain = await this.getInheritanceChain(templateId);
      const resolved = await this.resolveInheritance(templateId);

      return {
        valid: true,
        chain,
        depth: chain.length,
        resolved,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  async getInheritanceTree(templateId) {
    const tree = {
      id: templateId,
      children: [],
    };

    // Find all templates that inherit from this one
    const allTemplates = await this.templateManager.getAllTemplates();
    for (const template of allTemplates) {
      if (template.parent === templateId) {
        const childTree = await this.getInheritanceTree(template.id);
        tree.children.push(childTree);
      }
    }

    return tree;
  }

  async getDerivedTemplates(templateId) {
    const derived = [];
    const allTemplates = await this.templateManager.getAllTemplates();

    for (const template of allTemplates) {
      if (template.parent === templateId) {
        derived.push(template);
        // Recursively find templates derived from this one
        const childDerived = await this.getDerivedTemplates(template.id);
        derived.push(...childDerived);
      }
    }

    return derived;
  }

  async updateParentTemplate(templateId, updates) {
    // When updating a parent template, check impact on children
    const derived = await this.getDerivedTemplates(templateId);
    const impacts = [];

    for (const child of derived) {
      const impact = await this.analyzeUpdateImpact(child.id, updates);
      if (impact.hasImpact) {
        impacts.push({
          templateId: child.id,
          templateName: child.name,
          ...impact,
        });
      }
    }

    return impacts;
  }

  async analyzeUpdateImpact(childId, parentUpdates) {
    const child = await this.templateManager.getTemplate(childId);
    const impact = {
      hasImpact: false,
      changes: [],
    };

    // Check if child overrides any updated fields
    if (parentUpdates.variables) {
      for (const variable of parentUpdates.variables) {
        const childVar = child.variables?.find((v) => v.name === variable.name);
        if (!childVar) {
          impact.hasImpact = true;
          impact.changes.push({
            type: 'new_variable',
            name: variable.name,
          });
        }
      }
    }

    if (parentUpdates.content && !child.content) {
      impact.hasImpact = true;
      impact.changes.push({
        type: 'content_change',
        description: 'Parent content changed, child inherits',
      });
    }

    return impact;
  }
}

export default TemplateInheritance;
