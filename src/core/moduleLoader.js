/**
 * Base Module Loader
 * Provides dynamic module loading and registration for DevFlow components
 */

class ModuleLoader {
  constructor() {
    this.modules = new Map();
    this.loadOrder = [];
  }

  /**
   * Register a module with the loader
   * @param {string} name - Module name
   * @param {object} module - Module instance or factory
   * @param {object} options - Module options
   */
  registerModule(name, module, options = {}) {
    if (this.modules.has(name)) {
      throw new Error(`Module already registered: ${name}`);
    }

    this.modules.set(name, {
      module,
      options,
      loaded: false,
      dependencies: options.dependencies || [],
    });

    if (options.autoLoad) {
      this.loadModule(name);
    }
  }

  /**
   * Load a module and its dependencies
   * @param {string} name - Module name
   * @returns {object} Loaded module
   */
  loadModule(name) {
    const moduleInfo = this.modules.get(name);

    if (!moduleInfo) {
      throw new Error(`Module not found: ${name}`);
    }

    if (moduleInfo.loaded) {
      return moduleInfo.module;
    }

    // Load dependencies first
    for (const dep of moduleInfo.dependencies) {
      if (!this.modules.has(dep)) {
        throw new Error(`Missing dependency: ${dep} required by ${name}`);
      }
      this.loadModule(dep);
    }

    // Initialize module if it has an init function
    if (typeof moduleInfo.module.init === 'function') {
      const deps = this.resolveDependencies(moduleInfo.dependencies);
      moduleInfo.module.init(deps);
    }

    moduleInfo.loaded = true;
    this.loadOrder.push(name);

    return moduleInfo.module;
  }

  /**
   * Get a loaded module
   * @param {string} name - Module name
   * @returns {object} Module instance
   */
  getModule(name) {
    const moduleInfo = this.modules.get(name);

    if (!moduleInfo) {
      throw new Error(`Module not found: ${name}`);
    }

    if (!moduleInfo.loaded) {
      return this.loadModule(name);
    }

    return moduleInfo.module;
  }

  /**
   * Check if a module exists
   * @param {string} name - Module name
   * @returns {boolean}
   */
  hasModule(name) {
    return this.modules.has(name);
  }

  /**
   * Unload a module
   * @param {string} name - Module name
   */
  unloadModule(name) {
    const moduleInfo = this.modules.get(name);

    if (!moduleInfo) {
      return;
    }

    // Call cleanup if available
    if (typeof moduleInfo.module.cleanup === 'function') {
      moduleInfo.module.cleanup();
    }

    moduleInfo.loaded = false;
    const index = this.loadOrder.indexOf(name);
    if (index !== -1) {
      this.loadOrder.splice(index, 1);
    }
  }

  /**
   * Resolve dependencies for a module
   * @param {string[]} dependencies - Dependency names
   * @returns {object} Resolved dependencies
   */
  resolveDependencies(dependencies) {
    const resolved = {};

    for (const dep of dependencies) {
      resolved[dep] = this.getModule(dep);
    }

    return resolved;
  }

  /**
   * Load all registered modules
   */
  loadAll() {
    const unloaded = Array.from(this.modules.keys()).filter(
      (name) => !this.modules.get(name).loaded
    );

    for (const name of unloaded) {
      this.loadModule(name);
    }
  }

  /**
   * Get module loading order
   * @returns {string[]} Module names in load order
   */
  getLoadOrder() {
    return [...this.loadOrder];
  }

  /**
   * Clear all modules
   */
  clear() {
    // Unload in reverse order
    for (let i = this.loadOrder.length - 1; i >= 0; i--) {
      this.unloadModule(this.loadOrder[i]);
    }

    this.modules.clear();
    this.loadOrder = [];
  }
}

// Export singleton instance
const moduleLoader = new ModuleLoader();

export default moduleLoader;
export { ModuleLoader };
