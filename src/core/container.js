/**
 * Dependency Injection Container
 * Manages service registration and resolution for DevFlow
 */

class Container {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
    this.factories = new Map();
  }

  /**
   * Register a service class
   * @param {string} name - Service name
   * @param {Function} ServiceClass - Service constructor
   * @param {object} options - Registration options
   */
  register(name, ServiceClass, options = {}) {
    if (typeof ServiceClass !== 'function') {
      throw new TypeError(`Service must be a constructor: ${name}`);
    }

    this.services.set(name, {
      ServiceClass,
      dependencies: options.dependencies || [],
      singleton: false,
    });
  }

  /**
   * Register a singleton service
   * @param {string} name - Service name
   * @param {Function} ServiceClass - Service constructor
   * @param {object} options - Registration options
   */
  registerSingleton(name, ServiceClass, options = {}) {
    if (typeof ServiceClass !== 'function') {
      throw new TypeError(`Service must be a constructor: ${name}`);
    }

    this.services.set(name, {
      ServiceClass,
      dependencies: options.dependencies || [],
      singleton: true,
    });
  }

  /**
   * Register a factory function
   * @param {string} name - Service name
   * @param {Function} factory - Factory function
   */
  registerFactory(name, factory) {
    if (typeof factory !== 'function') {
      throw new TypeError(`Factory must be a function: ${name}`);
    }

    this.factories.set(name, factory);
  }

  /**
   * Register a value directly
   * @param {string} name - Service name
   * @param {any} value - Service value
   */
  registerValue(name, value) {
    this.singletons.set(name, value);
  }

  /**
   * Resolve a service
   * @param {string} name - Service name
   * @returns {any} Service instance
   */
  resolve(name) {
    // Check if it's a singleton that's already created
    if (this.singletons.has(name)) {
      return this.singletons.get(name);
    }

    // Check if it's a factory
    if (this.factories.has(name)) {
      const factory = this.factories.get(name);
      return factory(this);
    }

    // Check if it's a registered service
    const serviceInfo = this.services.get(name);
    if (!serviceInfo) {
      throw new Error(`Service not found: ${name}`);
    }

    // Resolve dependencies
    const dependencies = this.resolveDependencies(serviceInfo.dependencies);

    // Create instance
    const instance = new serviceInfo.ServiceClass(...dependencies);

    // Store singleton if needed
    if (serviceInfo.singleton) {
      this.singletons.set(name, instance);
    }

    return instance;
  }

  /**
   * Resolve multiple dependencies
   * @param {string[]} dependencies - Dependency names
   * @returns {any[]} Resolved dependencies
   */
  resolveDependencies(dependencies) {
    return dependencies.map((dep) => {
      if (typeof dep === 'string') {
        return this.resolve(dep);
      }
      return dep;
    });
  }

  /**
   * Check if a service exists
   * @param {string} name - Service name
   * @returns {boolean}
   */
  has(name) {
    return this.services.has(name) || this.singletons.has(name) || this.factories.has(name);
  }

  /**
   * Create a child container
   * @returns {Container} Child container
   */
  createChild() {
    const child = new Container();

    // Copy service definitions (not instances)
    for (const [name, serviceInfo] of this.services) {
      child.services.set(name, { ...serviceInfo });
    }

    // Copy factories
    for (const [name, factory] of this.factories) {
      child.factories.set(name, factory);
    }

    // Share singleton instances
    child.singletons = this.singletons;

    return child;
  }

  /**
   * Clear all registrations
   */
  clear() {
    // Call cleanup on singletons if available
    for (const instance of this.singletons.values()) {
      if (instance && typeof instance.cleanup === 'function') {
        instance.cleanup();
      }
    }

    this.services.clear();
    this.singletons.clear();
    this.factories.clear();
  }

  /**
   * Get all registered service names
   * @returns {string[]} Service names
   */
  getServiceNames() {
    const names = new Set([
      ...this.services.keys(),
      ...this.singletons.keys(),
      ...this.factories.keys(),
    ]);
    return Array.from(names);
  }

  /**
   * Create a scoped container for a specific context
   * @param {object} scopedValues - Values to inject in this scope
   * @returns {Container} Scoped container
   */
  createScope(scopedValues = {}) {
    const scoped = this.createChild();

    // Register scoped values
    for (const [name, value] of Object.entries(scopedValues)) {
      scoped.registerValue(name, value);
    }

    return scoped;
  }
}

// Export Container class and global container
const globalContainer = new Container();

export { Container, globalContainer as container };
