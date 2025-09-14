import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import TemplateManager from '../../../src/templates/TemplateManager.js';
import TemplateValidator from '../../../src/templates/TemplateValidator.js';
import TemplateInheritance from '../../../src/templates/TemplateInheritance.js';
import TemplateVariables from '../../../src/templates/TemplateVariables.js';
import { promises as fs } from 'fs';
import path from 'path';

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn(),
    copyFile: jest.fn(),
    unlink: jest.fn()
  }
}));

describe('TemplateManager', () => {
  let manager;
  let mockProjectPath;

  beforeEach(() => {
    mockProjectPath = '/test/project';
    manager = new TemplateManager(mockProjectPath);
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct project path', () => {
      expect(manager.projectPath).toBe(mockProjectPath);
    });

    it('should initialize template components', () => {
      expect(manager.validator).toBeInstanceOf(TemplateValidator);
      expect(manager.inheritance).toBeInstanceOf(TemplateInheritance);
      expect(manager.variables).toBeInstanceOf(TemplateVariables);
    });

    it('should create template directories if not exist', async () => {
      fs.access.mockRejectedValue(new Error('Not found'));

      await manager.initialize();

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.devflow/templates/custom'),
        { recursive: true }
      );
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.devflow/templates/base'),
        { recursive: true }
      );
    });
  });

  describe('Template Storage', () => {
    it('should save custom template', async () => {
      const template = {
        name: 'ci-pipeline',
        type: 'github-actions',
        content: 'name: CI\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest'
      };

      await manager.saveTemplate(template);

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.devflow/templates/custom/ci-pipeline.yml'),
        template.content
      );
    });

    it('should load template by name', async () => {
      const mockContent = 'name: Test\njobs:\n  test:\n    steps:\n      - run: npm test';
      fs.readFile.mockResolvedValue(mockContent);

      const template = await manager.loadTemplate('test-workflow');

      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('test-workflow'),
        'utf8'
      );
      expect(template.content).toBe(mockContent);
    });

    it('should list all available templates', async () => {
      fs.readdir.mockResolvedValue(['template1.yml', 'template2.json', 'template3.md']);

      const templates = await manager.listTemplates();

      expect(templates).toEqual([
        { name: 'template1', type: 'yml' },
        { name: 'template2', type: 'json' },
        { name: 'template3', type: 'md' }
      ]);
    });

    it('should delete template', async () => {
      await manager.deleteTemplate('old-template');

      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('old-template')
      );
    });
  });

  describe('Template Validation', () => {
    it('should validate template structure', async () => {
      const template = {
        name: 'valid-template',
        type: 'config',
        content: '{ "valid": "json" }',
        variables: ['PROJECT_NAME', 'VERSION']
      };

      const isValid = await manager.validateTemplate(template);

      expect(isValid).toBe(true);
    });

    it('should reject invalid template structure', async () => {
      const template = {
        name: '',  // Invalid: empty name
        content: 'some content'
      };

      const isValid = await manager.validateTemplate(template);

      expect(isValid).toBe(false);
    });

    it('should validate required fields', async () => {
      const template = {
        name: 'test',
        type: 'config',
        content: 'content',
        required: ['PROJECT_NAME'],
        variables: { PROJECT_NAME: 'MyProject' }
      };

      const isValid = await manager.validateRequiredFields(template);

      expect(isValid).toBe(true);
    });
  });

  describe('Template Variables', () => {
    it('should substitute variables in template', async () => {
      const template = {
        content: 'Project: {{PROJECT_NAME}}\nVersion: {{VERSION}}'
      };
      const variables = {
        PROJECT_NAME: 'DevFlow',
        VERSION: '1.0.0'
      };

      const processed = await manager.processVariables(template, variables);

      expect(processed).toBe('Project: DevFlow\nVersion: 1.0.0');
    });

    it('should handle nested variables', async () => {
      const template = {
        content: '{{#if ENABLE_TESTS}}test: npm test{{/if}}'
      };
      const variables = {
        ENABLE_TESTS: true
      };

      const processed = await manager.processVariables(template, variables);

      expect(processed).toContain('test: npm test');
    });

    it('should use default values for missing variables', async () => {
      const template = {
        content: 'Port: {{PORT}}',
        defaults: { PORT: '3000' }
      };
      const variables = {};

      const processed = await manager.processVariables(template, variables);

      expect(processed).toBe('Port: 3000');
    });

    it('should extract variables from template', () => {
      const content = 'Name: {{NAME}}\nEnv: {{ENV}}\n{{#if DEBUG}}Debug mode{{/if}}';

      const variables = manager.extractVariables(content);

      expect(variables).toEqual(['NAME', 'ENV', 'DEBUG']);
    });
  });

  describe('Template Inheritance', () => {
    it('should inherit from base template', async () => {
      const baseTemplate = {
        name: 'base-config',
        content: 'base: true\nshared: value'
      };
      const childTemplate = {
        name: 'child-config',
        extends: 'base-config',
        content: 'child: true'
      };

      manager.loadTemplate = jest.fn()
        .mockResolvedValueOnce(baseTemplate)
        .mockResolvedValueOnce(childTemplate);

      const merged = await manager.mergeTemplates(childTemplate);

      expect(merged.content).toContain('base: true');
      expect(merged.content).toContain('child: true');
    });

    it('should override base template values', async () => {
      const baseTemplate = {
        variables: { PORT: '3000', HOST: 'localhost' }
      };
      const childTemplate = {
        extends: 'base',
        variables: { PORT: '8080' }
      };

      const merged = await manager.inheritance.merge(baseTemplate, childTemplate);

      expect(merged.variables.PORT).toBe('8080');
      expect(merged.variables.HOST).toBe('localhost');
    });

    it('should support multiple inheritance levels', async () => {
      const grandparent = { level: 0, prop1: 'value1' };
      const parent = { extends: 'grandparent', level: 1, prop2: 'value2' };
      const child = { extends: 'parent', level: 2, prop3: 'value3' };

      const merged = await manager.inheritance.resolveChain(child);

      expect(merged).toHaveProperty('prop1', 'value1');
      expect(merged).toHaveProperty('prop2', 'value2');
      expect(merged).toHaveProperty('prop3', 'value3');
      expect(merged.level).toBe(2);
    });
  });

  describe('Template Import/Export', () => {
    it('should export template to file', async () => {
      const template = {
        name: 'export-test',
        content: 'test content',
        variables: ['VAR1', 'VAR2']
      };

      const exportPath = await manager.exportTemplate(template, '/export/path');

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/export/path/export-test.json',
        JSON.stringify(template, null, 2)
      );
      expect(exportPath).toContain('export-test.json');
    });

    it('should import template from file', async () => {
      const mockTemplate = {
        name: 'imported',
        content: 'imported content'
      };
      fs.readFile.mockResolvedValue(JSON.stringify(mockTemplate));

      const imported = await manager.importTemplate('/import/path/template.json');

      expect(imported).toEqual(mockTemplate);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('imported'),
        expect.any(String)
      );
    });

    it('should export all templates as bundle', async () => {
      const templates = [
        { name: 'template1', content: 'content1' },
        { name: 'template2', content: 'content2' }
      ];

      manager.listTemplates = jest.fn().mockResolvedValue(templates);

      const bundle = await manager.exportBundle('/export/bundle');

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/export/bundle/templates-bundle.json',
        expect.stringContaining('template1')
      );
    });

    it('should import template bundle', async () => {
      const bundle = {
        version: '1.0.0',
        templates: [
          { name: 'bundled1', content: 'content1' },
          { name: 'bundled2', content: 'content2' }
        ]
      };
      fs.readFile.mockResolvedValue(JSON.stringify(bundle));

      const imported = await manager.importBundle('/import/bundle.json');

      expect(imported.count).toBe(2);
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('Template Sharing', () => {
    it('should generate shareable template URL', async () => {
      const template = { name: 'shareable', content: 'content' };

      const url = await manager.generateShareableUrl(template);

      expect(url).toContain('devflow://template/');
      expect(url).toContain('shareable');
    });

    it('should import from shareable URL', async () => {
      const url = 'devflow://template/shared-template?data=eyJuYW1lIjoidGVzdCJ9';

      const imported = await manager.importFromUrl(url);

      expect(imported).toHaveProperty('name');
    });
  });
});

describe('TemplateValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new TemplateValidator();
  });

  describe('Schema Validation', () => {
    it('should validate template against schema', () => {
      const template = {
        name: 'valid',
        type: 'config',
        content: 'content',
        version: '1.0.0'
      };

      const result = validator.validate(template);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing required fields', () => {
      const template = {
        type: 'config'
        // Missing 'name' and 'content'
      };

      const result = validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: name');
      expect(result.errors).toContain('Missing required field: content');
    });

    it('should validate field types', () => {
      const template = {
        name: 123,  // Should be string
        type: 'config',
        content: 'content'
      };

      const result = validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field "name" must be of type string');
    });

    it('should validate custom schemas', () => {
      const customSchema = {
        required: ['customField'],
        properties: {
          customField: { type: 'number' }
        }
      };

      const template = { customField: 42 };

      const result = validator.validateWithSchema(template, customSchema);

      expect(result.valid).toBe(true);
    });
  });

  describe('Content Validation', () => {
    it('should validate JSON content', () => {
      const template = {
        type: 'json',
        content: '{ "valid": "json" }'
      };

      const result = validator.validateContent(template);

      expect(result.valid).toBe(true);
    });

    it('should detect invalid JSON', () => {
      const template = {
        type: 'json',
        content: '{ invalid json }'
      };

      const result = validator.validateContent(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid JSON content');
    });

    it('should validate YAML content', () => {
      const template = {
        type: 'yaml',
        content: 'key: value\nlist:\n  - item1\n  - item2'
      };

      const result = validator.validateContent(template);

      expect(result.valid).toBe(true);
    });
  });
});

describe('TemplateInheritance', () => {
  let inheritance;

  beforeEach(() => {
    inheritance = new TemplateInheritance();
  });

  describe('Template Merging', () => {
    it('should merge child into parent template', () => {
      const parent = {
        prop1: 'parent1',
        prop2: 'parent2',
        nested: { a: 1, b: 2 }
      };
      const child = {
        prop2: 'child2',
        prop3: 'child3',
        nested: { b: 3, c: 4 }
      };

      const merged = inheritance.merge(parent, child);

      expect(merged.prop1).toBe('parent1');
      expect(merged.prop2).toBe('child2');
      expect(merged.prop3).toBe('child3');
      expect(merged.nested).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should handle array merging', () => {
      const parent = { items: ['item1', 'item2'] };
      const child = { items: ['item3', 'item4'] };

      const merged = inheritance.merge(parent, child);

      expect(merged.items).toEqual(['item1', 'item2', 'item3', 'item4']);
    });

    it('should respect merge strategy', () => {
      const parent = { list: [1, 2] };
      const child = { list: [3, 4], mergeStrategy: 'replace' };

      const merged = inheritance.merge(parent, child);

      expect(merged.list).toEqual([3, 4]);
    });
  });

  describe('Inheritance Chain', () => {
    it('should resolve single parent', async () => {
      const templates = {
        parent: { prop: 'parent' },
        child: { extends: 'parent', prop: 'child' }
      };

      const resolved = await inheritance.resolveChain(templates, 'child');

      expect(resolved.prop).toBe('child');
    });

    it('should resolve multiple inheritance levels', async () => {
      const templates = {
        base: { level1: 'base' },
        middle: { extends: 'base', level2: 'middle' },
        final: { extends: 'middle', level3: 'final' }
      };

      const resolved = await inheritance.resolveChain(templates, 'final');

      expect(resolved.level1).toBe('base');
      expect(resolved.level2).toBe('middle');
      expect(resolved.level3).toBe('final');
    });

    it('should detect circular inheritance', async () => {
      const templates = {
        a: { extends: 'b' },
        b: { extends: 'c' },
        c: { extends: 'a' }
      };

      await expect(inheritance.resolveChain(templates, 'a'))
        .rejects.toThrow('Circular inheritance detected');
    });
  });
});

describe('TemplateVariables', () => {
  let variables;

  beforeEach(() => {
    variables = new TemplateVariables();
  });

  describe('Variable Extraction', () => {
    it('should extract simple variables', () => {
      const content = 'Hello {{NAME}}, welcome to {{PROJECT}}!';

      const extracted = variables.extract(content);

      expect(extracted).toEqual(['NAME', 'PROJECT']);
    });

    it('should extract conditional variables', () => {
      const content = '{{#if ENABLE_FEATURE}}Feature enabled{{/if}}';

      const extracted = variables.extract(content);

      expect(extracted).toEqual(['ENABLE_FEATURE']);
    });

    it('should extract loop variables', () => {
      const content = '{{#each ITEMS}}{{this.name}}{{/each}}';

      const extracted = variables.extract(content);

      expect(extracted).toEqual(['ITEMS']);
    });

    it('should handle nested variables', () => {
      const content = '{{CONFIG.DATABASE.HOST}}:{{CONFIG.DATABASE.PORT}}';

      const extracted = variables.extract(content);

      expect(extracted).toEqual(['CONFIG']);
    });
  });

  describe('Variable Substitution', () => {
    it('should substitute simple variables', () => {
      const template = 'Hello {{NAME}}!';
      const vars = { NAME: 'World' };

      const result = variables.substitute(template, vars);

      expect(result).toBe('Hello World!');
    });

    it('should handle missing variables', () => {
      const template = 'Value: {{MISSING}}';
      const vars = {};

      const result = variables.substitute(template, vars);

      expect(result).toBe('Value: ');
    });

    it('should use default values', () => {
      const template = 'Port: {{PORT}}';
      const vars = {};
      const defaults = { PORT: '3000' };

      const result = variables.substitute(template, vars, defaults);

      expect(result).toBe('Port: 3000');
    });

    it('should handle conditional blocks', () => {
      const template = '{{#if DEBUG}}Debug mode{{else}}Production{{/if}}';
      const vars1 = { DEBUG: true };
      const vars2 = { DEBUG: false };

      const result1 = variables.substitute(template, vars1);
      const result2 = variables.substitute(template, vars2);

      expect(result1).toBe('Debug mode');
      expect(result2).toBe('Production');
    });

    it('should handle loops', () => {
      const template = '{{#each PORTS}}{{this}},{{/each}}';
      const vars = { PORTS: [3000, 3001, 3002] };

      const result = variables.substitute(template, vars);

      expect(result).toBe('3000,3001,3002,');
    });
  });

  describe('Variable Validation', () => {
    it('should validate required variables', () => {
      const required = ['NAME', 'VERSION'];
      const provided = { NAME: 'test', VERSION: '1.0' };

      const result = variables.validateRequired(required, provided);

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should detect missing required variables', () => {
      const required = ['NAME', 'VERSION'];
      const provided = { NAME: 'test' };

      const result = variables.validateRequired(required, provided);

      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['VERSION']);
    });

    it('should validate variable types', () => {
      const schema = {
        PORT: { type: 'number' },
        NAME: { type: 'string' }
      };
      const vars = {
        PORT: 3000,
        NAME: 'app'
      };

      const result = variables.validateTypes(vars, schema);

      expect(result.valid).toBe(true);
    });
  });
});