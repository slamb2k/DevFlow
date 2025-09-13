import { jest } from '@jest/globals';
import { ArchitectAgent } from '../../../src/agents/ArchitectAgent.js';
import fs from 'fs/promises';
import path from 'path';

describe('ArchitectAgent', () => {
  let architect;
  let mockFS;

  beforeEach(() => {
    architect = new ArchitectAgent();

    // Mock file system operations
    mockFS = {
      readFile: jest.spyOn(fs, 'readFile'),
      writeFile: jest.spyOn(fs, 'writeFile'),
      mkdir: jest.spyOn(fs, 'mkdir'),
      readdir: jest.spyOn(fs, 'readdir'),
      stat: jest.spyOn(fs, 'stat')
    };

    // Mock successful state operations
    mockFS.readFile.mockRejectedValue({ code: 'ENOENT' });
    mockFS.writeFile.mockResolvedValue();
    mockFS.mkdir.mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with correct properties', async () => {
      await architect.initialize();

      expect(architect.id).toBe('architect');
      expect(architect.name).toBe('ArchitectAgent');
      expect(architect.status).toBe('ready');
      expect(architect.getCapabilities()).toContain('design-pattern-recognition');
      expect(architect.getCapabilities()).toContain('architecture-validation');
      expect(architect.getCapabilities()).toContain('diagram-generation');
      expect(architect.getCapabilities()).toContain('structure-analysis');
    });

    test('should load design pattern catalog on initialization', async () => {
      await architect.initialize();

      const state = architect.getState();
      expect(state.patternCatalog).toBeDefined();
      expect(state.patternCatalog.length).toBeGreaterThan(0);
    });
  });

  describe('Design Pattern Recognition', () => {
    test('should recognize singleton pattern', async () => {
      await architect.initialize();

      const singletonCode = `
        class ConfigManager {
          static instance = null;

          static getInstance() {
            if (!ConfigManager.instance) {
              ConfigManager.instance = new ConfigManager();
            }
            return ConfigManager.instance;
          }

          constructor() {
            if (ConfigManager.instance) {
              throw new Error('Use ConfigManager.getInstance()');
            }
            this.config = {};
          }
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(singletonCode);

      const result = await architect.execute('recognize-patterns', {
        filePath: 'config.js'
      });

      expect(result.success).toBe(true);
      expect(result.result.patterns).toContainEqual(
        expect.objectContaining({
          name: 'Singleton',
          confidence: expect.any(Number)
        })
      );
    });

    test('should recognize factory pattern', async () => {
      await architect.initialize();

      const factoryCode = `
        class VehicleFactory {
          createVehicle(type) {
            switch(type) {
              case 'car':
                return new Car();
              case 'truck':
                return new Truck();
              case 'motorcycle':
                return new Motorcycle();
              default:
                throw new Error('Unknown vehicle type');
            }
          }
        }

        class Car { constructor() { this.wheels = 4; } }
        class Truck { constructor() { this.wheels = 6; } }
        class Motorcycle { constructor() { this.wheels = 2; } }
      `;

      mockFS.readFile.mockResolvedValueOnce(factoryCode);

      const result = await architect.execute('recognize-patterns', {
        filePath: 'factory.js'
      });

      expect(result.success).toBe(true);
      expect(result.result.patterns).toContainEqual(
        expect.objectContaining({
          name: 'Factory',
          confidence: expect.any(Number)
        })
      );
    });

    test('should recognize observer pattern', async () => {
      await architect.initialize();

      const observerCode = `
        class Subject {
          constructor() {
            this.observers = [];
          }

          subscribe(observer) {
            this.observers.push(observer);
          }

          unsubscribe(observer) {
            this.observers = this.observers.filter(obs => obs !== observer);
          }

          notify(data) {
            this.observers.forEach(observer => observer.update(data));
          }
        }

        class Observer {
          update(data) {
            console.log('Received update:', data);
          }
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(observerCode);

      const result = await architect.execute('recognize-patterns', {
        filePath: 'observer.js'
      });

      expect(result.success).toBe(true);
      expect(result.result.patterns).toContainEqual(
        expect.objectContaining({
          name: 'Observer',
          confidence: expect.any(Number)
        })
      );
    });

    test('should recognize multiple patterns in same file', async () => {
      await architect.initialize();

      const multiPatternCode = `
        // Singleton
        class AppState {
          static instance = null;
          static getInstance() {
            if (!AppState.instance) {
              AppState.instance = new AppState();
            }
            return AppState.instance;
          }
        }

        // Strategy
        class PaymentProcessor {
          constructor(strategy) {
            this.strategy = strategy;
          }

          processPayment(amount) {
            return this.strategy.pay(amount);
          }
        }

        class CreditCardStrategy {
          pay(amount) { return 'Paid with credit card'; }
        }

        class PayPalStrategy {
          pay(amount) { return 'Paid with PayPal'; }
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(multiPatternCode);

      const result = await architect.execute('recognize-patterns', {
        filePath: 'multi.js'
      });

      expect(result.success).toBe(true);
      expect(result.result.patterns.length).toBeGreaterThanOrEqual(2);
      expect(result.result.patterns.map(p => p.name)).toContain('Singleton');
      expect(result.result.patterns.map(p => p.name)).toContain('Strategy');
    });
  });

  describe('Architecture Validation', () => {
    test('should validate layered architecture', async () => {
      await architect.initialize();

      // Mock directory structure for layered architecture
      mockFS.readdir
        .mockResolvedValueOnce(['controllers', 'services', 'repositories', 'models'])
        .mockResolvedValueOnce(['userController.js', 'productController.js'])
        .mockResolvedValueOnce(['userService.js', 'productService.js'])
        .mockResolvedValueOnce(['userRepository.js', 'productRepository.js'])
        .mockResolvedValueOnce(['User.js', 'Product.js']);

      mockFS.stat.mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false
      });

      const result = await architect.execute('validate-architecture', {
        directory: './src',
        type: 'layered'
      });

      expect(result.success).toBe(true);
      expect(result.result.valid).toBe(true);
      expect(result.result.architecture).toBe('layered');
      expect(result.result.layers).toContain('controllers');
      expect(result.result.layers).toContain('services');
      expect(result.result.layers).toContain('repositories');
    });

    test('should detect architecture violations', async () => {
      await architect.initialize();

      // Mock code with layer violation (controller importing repository directly)
      const controllerCode = `
        import { UserRepository } from '../repositories/userRepository.js';
        import { UserService } from '../services/userService.js';

        class UserController {
          constructor() {
            this.userRepository = new UserRepository(); // Violation!
            this.userService = new UserService();
          }
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(controllerCode);

      const result = await architect.execute('validate-architecture', {
        filePath: 'controllers/userController.js',
        type: 'layered'
      });

      expect(result.success).toBe(true);
      expect(result.result.violations).toBeDefined();
      expect(result.result.violations.length).toBeGreaterThan(0);
      expect(result.result.violations[0]).toMatchObject({
        type: 'layer-violation',
        message: expect.stringContaining('controller')
      });
    });

    test('should validate microservices architecture', async () => {
      await architect.initialize();

      // Mock microservices structure
      mockFS.readdir.mockResolvedValueOnce([
        'user-service',
        'product-service',
        'order-service',
        'api-gateway',
        'shared'
      ]);

      const packageJson = JSON.stringify({
        name: 'user-service',
        dependencies: {
          'express': '^4.0.0',
          '@company/shared': '^1.0.0'
        }
      });

      mockFS.readFile.mockResolvedValue(packageJson);
      mockFS.stat.mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false
      });

      const result = await architect.execute('validate-architecture', {
        directory: './',
        type: 'microservices'
      });

      expect(result.success).toBe(true);
      expect(result.result.services).toBeDefined();
      expect(result.result.services.length).toBeGreaterThan(0);
      expect(result.result.apiGateway).toBeDefined();
    });

    test('should validate hexagonal architecture', async () => {
      await architect.initialize();

      // Mock hexagonal architecture structure
      mockFS.readdir
        .mockResolvedValueOnce(['domain', 'application', 'infrastructure', 'adapters'])
        .mockResolvedValueOnce(['entities', 'valueObjects', 'repositories'])
        .mockResolvedValueOnce(['useCases', 'services'])
        .mockResolvedValueOnce(['persistence', 'messaging'])
        .mockResolvedValueOnce(['web', 'cli', 'api']);

      mockFS.stat.mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false
      });

      const result = await architect.execute('validate-architecture', {
        directory: './src',
        type: 'hexagonal'
      });

      expect(result.success).toBe(true);
      expect(result.result.valid).toBe(true);
      expect(result.result.architecture).toBe('hexagonal');
      expect(result.result.core).toContain('domain');
      expect(result.result.ports).toBeDefined();
      expect(result.result.adapters).toBeDefined();
    });
  });

  describe('Diagram Generation', () => {
    test('should generate component diagram', async () => {
      await architect.initialize();

      // Mock project structure
      mockFS.readdir.mockResolvedValue([
        'UserComponent.js',
        'ProductList.js',
        'ShoppingCart.js'
      ]);

      mockFS.readFile.mockResolvedValue(`
        import { ProductList } from './ProductList';
        import { ShoppingCart } from './ShoppingCart';
        export const UserComponent = () => {};
      `);

      const result = await architect.execute('generate-diagram', {
        directory: './src/components',
        type: 'component'
      });

      expect(result.success).toBe(true);
      expect(result.result.diagram).toBeDefined();
      expect(result.result.format).toBe('mermaid');
      expect(result.result.diagram).toContain('graph');
      expect(result.result.components).toContain('UserComponent');
      expect(result.result.components).toContain('ProductList');
    });

    test('should generate class diagram', async () => {
      await architect.initialize();

      const classCode = `
        class Animal {
          constructor(name) {
            this.name = name;
          }
          speak() {
            return 'Sound';
          }
        }

        class Dog extends Animal {
          constructor(name, breed) {
            super(name);
            this.breed = breed;
          }
          speak() {
            return 'Woof';
          }
        }

        class Cat extends Animal {
          speak() {
            return 'Meow';
          }
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(classCode);

      const result = await architect.execute('generate-diagram', {
        filePath: 'animals.js',
        type: 'class'
      });

      expect(result.success).toBe(true);
      expect(result.result.diagram).toBeDefined();
      expect(result.result.diagram).toContain('classDiagram');
      expect(result.result.diagram).toContain('Animal');
      expect(result.result.diagram).toContain('Dog --|> Animal');
      expect(result.result.diagram).toContain('Cat --|> Animal');
    });

    test('should generate sequence diagram from flow', async () => {
      await architect.initialize();

      const flowCode = `
        async function processOrder(orderId) {
          const order = await orderService.getOrder(orderId);
          const payment = await paymentService.processPayment(order);
          const shipping = await shippingService.createShipment(order);
          await notificationService.sendConfirmation(order, payment, shipping);
          return { order, payment, shipping };
        }
      `;

      mockFS.readFile.mockResolvedValueOnce(flowCode);

      const result = await architect.execute('generate-diagram', {
        filePath: 'orderFlow.js',
        type: 'sequence'
      });

      expect(result.success).toBe(true);
      expect(result.result.diagram).toBeDefined();
      expect(result.result.diagram).toContain('sequenceDiagram');
      expect(result.result.diagram).toContain('orderService');
      expect(result.result.diagram).toContain('paymentService');
      expect(result.result.diagram).toContain('shippingService');
    });

    test('should generate architecture overview diagram', async () => {
      await architect.initialize();

      // Mock full project structure
      mockFS.readdir.mockResolvedValueOnce([
        'src',
        'tests',
        'docs',
        'config',
        'scripts'
      ]);

      const result = await architect.execute('generate-diagram', {
        directory: './',
        type: 'architecture-overview'
      });

      expect(result.success).toBe(true);
      expect(result.result.diagram).toBeDefined();
      expect(result.result.type).toBe('architecture-overview');
      expect(result.result.diagram).toContain('graph');
    });
  });

  describe('Structure Analysis', () => {
    test('should analyze project structure', async () => {
      await architect.initialize();

      mockFS.readdir.mockResolvedValue([
        'src',
        'tests',
        'docs',
        'package.json',
        'README.md'
      ]);

      mockFS.stat.mockImplementation((path) => ({
        isDirectory: () => !path.includes('.'),
        isFile: () => path.includes('.')
      }));

      const result = await architect.execute('analyze-structure', {
        directory: './'
      });

      expect(result.success).toBe(true);
      expect(result.result.structure).toBeDefined();
      expect(result.result.metrics).toBeDefined();
      expect(result.result.metrics.directories).toBeGreaterThan(0);
      expect(result.result.recommendations).toBeDefined();
    });

    test('should detect structural issues', async () => {
      await architect.initialize();

      // Mock problematic structure (too deep nesting)
      mockFS.readdir
        .mockResolvedValueOnce(['level1'])
        .mockResolvedValueOnce(['level2'])
        .mockResolvedValueOnce(['level3'])
        .mockResolvedValueOnce(['level4'])
        .mockResolvedValueOnce(['level5'])
        .mockResolvedValueOnce(['tooDeep.js']);

      mockFS.stat.mockImplementation((path) => ({
        isDirectory: () => !path.endsWith('.js'),
        isFile: () => path.endsWith('.js')
      }));

      const result = await architect.execute('analyze-structure', {
        directory: './'
      });

      expect(result.success).toBe(true);
      expect(result.result.issues).toBeDefined();
      expect(result.result.issues).toContainEqual(
        expect.objectContaining({
          type: 'deep-nesting'
        })
      );
    });

    test('should recommend structure improvements', async () => {
      await architect.initialize();

      // Mock flat structure (needs organization)
      const files = Array.from({ length: 50 }, (_, i) => `component${i}.js`);
      mockFS.readdir.mockResolvedValueOnce(files);

      mockFS.stat.mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true
      });

      const result = await architect.execute('analyze-structure', {
        directory: './src'
      });

      expect(result.success).toBe(true);
      expect(result.result.recommendations).toBeDefined();
      expect(result.result.recommendations).toContainEqual(
        expect.objectContaining({
          type: 'organize-files'
        })
      );
    });
  });

  describe('Task Validation', () => {
    test('should only handle architecture tasks', async () => {
      await architect.initialize();

      expect(architect.canHandle('recognize-patterns')).toBe(true);
      expect(architect.canHandle('validate-architecture')).toBe(true);
      expect(architect.canHandle('generate-diagram')).toBe(true);
      expect(architect.canHandle('analyze-structure')).toBe(true);
      expect(architect.canHandle('invalid-task')).toBe(false);
    });
  });

  describe('State Management', () => {
    test('should maintain pattern recognition history', async () => {
      await architect.initialize();

      const testCode = 'class Singleton {}';
      mockFS.readFile.mockResolvedValueOnce(testCode);

      await architect.execute('recognize-patterns', {
        filePath: 'test.js'
      });

      const state = architect.getState();
      expect(state.recognitionHistory).toBeDefined();
      expect(state.recognitionHistory.length).toBeGreaterThan(0);
      expect(state.recognitionHistory[0]).toMatchObject({
        file: 'test.js',
        patterns: expect.any(Array)
      });
    });

    test('should cache architecture validations', async () => {
      await architect.initialize();

      mockFS.readdir.mockResolvedValue(['controllers', 'services', 'models']);
      mockFS.stat.mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false
      });

      // First validation
      await architect.execute('validate-architecture', {
        directory: './src',
        type: 'layered'
      });

      // Second validation should use cache
      const result = await architect.execute('validate-architecture', {
        directory: './src',
        type: 'layered',
        useCache: true
      });

      expect(result.result.cached).toBe(true);
    });
  });
});