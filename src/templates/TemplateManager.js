import { promises as fs } from 'fs';
import path from 'path';
import TemplateValidator from './TemplateValidator.js';
import TemplateRenderer from './TemplateRenderer.js';

class TemplateManager {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.templatesPath = path.join(projectPath, '.devflow/templates');
    this.validator = new TemplateValidator();
    this.renderer = new TemplateRenderer();
    this.templates = new Map();
    this.categories = new Map();
  }

  async initialize() {
    await this.ensureTemplateDirectory();
    await this.loadTemplates();
    await this.loadBuiltInTemplates();
  }

  async ensureTemplateDirectory() {
    await fs.mkdir(this.templatesPath, { recursive: true });

    // Create category directories
    const categories = ['cicd', 'docker', 'config', 'documentation', 'testing'];
    for (const category of categories) {
      await fs.mkdir(path.join(this.templatesPath, category), { recursive: true });
    }
  }

  async loadTemplates() {
    try {
      const categories = await fs.readdir(this.templatesPath, { withFileTypes: true });

      for (const category of categories) {
        if (category.isDirectory()) {
          const categoryPath = path.join(this.templatesPath, category.name);
          const templates = await fs.readdir(categoryPath);

          for (const templateFile of templates) {
            if (templateFile.endsWith('.json')) {
              const templatePath = path.join(categoryPath, templateFile);
              const template = await this.loadTemplate(templatePath);

              if (template) {
                this.registerTemplate(template);
              }
            }
          }
        }
      }
    } catch (error) {
      // Templates directory might not exist yet
      console.error('Error loading templates:', error.message);
    }
  }

  async loadTemplate(templatePath) {
    try {
      const content = await fs.readFile(templatePath, 'utf8');
      const template = JSON.parse(content);

      // Validate template structure
      if (this.validator.validateTemplate(template)) {
        template.path = templatePath;
        return template;
      }

      console.warn(`Invalid template at ${templatePath}`);
      return null;
    } catch (error) {
      console.error(`Error loading template ${templatePath}:`, error.message);
      return null;
    }
  }

  async loadBuiltInTemplates() {
    // Load built-in templates from src/templates/builtin
    const builtInPath = path.join(__dirname, 'builtin');

    try {
      const templates = await fs.readdir(builtInPath);

      for (const templateFile of templates) {
        if (templateFile.endsWith('.json')) {
          const templatePath = path.join(builtInPath, templateFile);
          const template = await this.loadTemplate(templatePath);

          if (template) {
            template.builtin = true;
            this.registerTemplate(template);
          }
        }
      }
    } catch (error) {
      // Built-in templates might not exist
    }
  }

  registerTemplate(template) {
    const id = template.id || this.generateTemplateId(template);
    template.id = id;

    this.templates.set(id, template);

    // Register in category
    if (template.category) {
      if (!this.categories.has(template.category)) {
        this.categories.set(template.category, new Set());
      }
      this.categories.get(template.category).add(id);
    }
  }

  generateTemplateId(template) {
    const base = template.name.toLowerCase().replace(/\s+/g, '-');
    const category = template.category || 'general';
    return `${category}-${base}-${Date.now()}`;
  }

  async saveTemplate(template) {
    // Validate template
    const validation = this.validator.validateTemplate(template);
    if (!validation.valid) {
      throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
    }

    // Ensure template has an ID
    if (!template.id) {
      template.id = this.generateTemplateId(template);
    }

    // Determine save path
    const category = template.category || 'general';
    const categoryPath = path.join(this.templatesPath, category);
    await fs.mkdir(categoryPath, { recursive: true });

    const fileName = `${template.id}.json`;
    const filePath = path.join(categoryPath, fileName);

    // Save template
    await fs.writeFile(filePath, JSON.stringify(template, null, 2));

    // Register template
    template.path = filePath;
    this.registerTemplate(template);

    return template;
  }

  async getTemplate(id) {
    return this.templates.get(id);
  }

  async getTemplatesByCategory(category) {
    const templateIds = this.categories.get(category);
    if (!templateIds) {
      return [];
    }

    const templates = [];
    for (const id of templateIds) {
      const template = this.templates.get(id);
      if (template) {
        templates.push(template);
      }
    }

    return templates;
  }

  async getAllTemplates() {
    return Array.from(this.templates.values());
  }

  async searchTemplates(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    for (const template of this.templates.values()) {
      if (
        template.name.toLowerCase().includes(lowerQuery) ||
        template.description?.toLowerCase().includes(lowerQuery) ||
        template.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
      ) {
        results.push(template);
      }
    }

    return results;
  }

  async renderTemplate(templateId, variables = {}) {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return this.renderer.render(template, variables);
  }

  async cloneTemplate(templateId, newName) {
    const original = await this.getTemplate(templateId);
    if (!original) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const clone = {
      ...original,
      id: undefined, // Will be regenerated
      name: newName,
      parent: original.id,
      builtin: false,
      path: undefined,
    };

    return this.saveTemplate(clone);
  }

  async deleteTemplate(templateId) {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    if (template.builtin) {
      throw new Error('Cannot delete built-in templates');
    }

    // Remove from filesystem
    if (template.path) {
      await fs.unlink(template.path);
    }

    // Remove from memory
    this.templates.delete(templateId);

    // Remove from category
    if (template.category) {
      const categorySet = this.categories.get(template.category);
      if (categorySet) {
        categorySet.delete(templateId);
      }
    }

    return true;
  }

  async updateTemplate(templateId, updates) {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    if (template.builtin) {
      throw new Error('Cannot modify built-in templates. Clone it first.');
    }

    // Apply updates
    const updated = { ...template, ...updates };

    // Preserve important fields
    updated.id = template.id;
    updated.path = template.path;

    // Validate updated template
    const validation = this.validator.validateTemplate(updated);
    if (!validation.valid) {
      throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
    }

    // Save to filesystem
    await fs.writeFile(template.path, JSON.stringify(updated, null, 2));

    // Update in memory
    this.templates.set(templateId, updated);

    return updated;
  }

  async exportTemplate(templateId, format = 'json') {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Remove internal fields for export
    const exported = { ...template };
    delete exported.path;
    delete exported.builtin;

    switch (format) {
      case 'json':
        return JSON.stringify(exported, null, 2);

      case 'yaml':
        return this.exportToYAML(exported);

      default:
        return exported;
    }
  }

  async importTemplate(data, format = 'json') {
    let template;

    switch (format) {
      case 'json':
        template = typeof data === 'string' ? JSON.parse(data) : data;
        break;

      case 'yaml':
        template = this.importFromYAML(data);
        break;

      default:
        template = data;
    }

    // Remove any existing ID to generate a new one
    delete template.id;
    delete template.path;
    delete template.builtin;

    // Save the imported template
    return this.saveTemplate(template);
  }

  exportToYAML(template) {
    // Simple YAML export (you might want to use a proper YAML library)
    let yaml = '';

    const addField = (key, value, indent = 0) => {
      const spaces = ' '.repeat(indent);

      if (value === null || value === undefined) {
        return;
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        for (const [k, v] of Object.entries(value)) {
          addField(k, v, indent + 2);
        }
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          yaml += `${spaces}- ${JSON.stringify(item)}\n`;
        }
      } else {
        yaml += `${spaces}${key}: ${JSON.stringify(value)}\n`;
      }
    };

    for (const [key, value] of Object.entries(template)) {
      addField(key, value);
    }

    return yaml;
  }

  importFromYAML(yamlString) {
    // Simple YAML import (you might want to use a proper YAML library)
    const lines = yamlString.split('\n');
    const template = {};
    const stack = [{ obj: template, indent: -1 }];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const indent = line.length - line.trimStart().length;
      const match = trimmed.match(/^([^:]+):\s*(.*)$/);

      if (match) {
        const [, key, value] = match;

        // Pop stack to current indent level
        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
          stack.pop();
        }

        const current = stack[stack.length - 1].obj;

        if (value) {
          // Simple value
          try {
            current[key] = JSON.parse(value);
          } catch {
            current[key] = value;
          }
        } else {
          // Object or array
          current[key] = {};
          stack.push({ obj: current[key], indent });
        }
      } else if (trimmed.startsWith('- ')) {
        // Array item
        const value = trimmed.substring(2);
        const current = stack[stack.length - 1].obj;

        if (!Array.isArray(current)) {
          // Convert to array
          const parent = stack[stack.length - 2].obj;
          const key = Object.keys(parent).find((k) => parent[k] === current);
          parent[key] = [];
          stack[stack.length - 1].obj = parent[key];
        }

        try {
          stack[stack.length - 1].obj.push(JSON.parse(value));
        } catch {
          stack[stack.length - 1].obj.push(value);
        }
      }
    }

    return template;
  }

  async getTemplateStats() {
    const stats = {
      total: this.templates.size,
      byCategory: {},
      builtin: 0,
      custom: 0,
    };

    for (const template of this.templates.values()) {
      // Count by category
      const category = template.category || 'uncategorized';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

      // Count builtin vs custom
      if (template.builtin) {
        stats.builtin++;
      } else {
        stats.custom++;
      }
    }

    return stats;
  }
}

export default TemplateManager;
