import { EventEmitter } from 'events'
import { promises as fs } from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

/**
 * Manages all platform integrations and their lifecycle
 */
export class IntegrationManager extends EventEmitter {
  constructor(options = {}) {
    super()

    this.event_bus = options.event_bus
    this.credential_manager = options.credential_manager
    this.plugins = new Map()
    this.plugin_registry = {}
    this.plugin_configs = new Map()
    this.plugin_defaults = new Map()
    this.event_mappings = {}
    this.message_queues = new Map()
    this.plugin_contexts = new Map()
    this.shutdown_handlers = []
  }

  /**
   * Load all plugins from the integrations directory
   */
  async load_plugins(dir = path.join(process.cwd(), 'src', 'integrations')) {
    try {
      const files = await fs.readdir(dir)
      const plugin_files = files.filter(f => f.endsWith('-integration.js'))

      for (const file of plugin_files) {
        await this.load_plugin_from_path(path.join(dir, file))
      }

      return true
    } catch (error) {
      console.error('Failed to load plugins:', error)
      return false
    }
  }

  /**
   * Load a plugin from a file path
   */
  async load_plugin_from_path(plugin_path) {
    try {
      const module_url = pathToFileURL(plugin_path).href
      const module = await import(module_url)
      const PluginClass = module.default || module[Object.keys(module)[0]]

      if (!PluginClass) {
        console.error(`No plugin class found in ${plugin_path}`)
        return false
      }

      const plugin = new PluginClass({
        event_bus: this.event_bus,
        credential_manager: this.credential_manager,
      })

      return this.load_plugin(plugin)
    } catch (error) {
      console.error(`Failed to load plugin from ${plugin_path}:`, error)
      return false
    }
  }

  /**
   * Load and validate a plugin instance
   */
  async load_plugin(plugin) {
    if (!this.validate_plugin(plugin)) {
      return false
    }

    this.register_plugin(plugin)
    return true
  }

  /**
   * Validate plugin interface
   */
  validate_plugin(plugin) {
    if (!plugin || typeof plugin !== 'object') {
      return false
    }

    const required_properties = ['name', 'platform']
    const required_methods = ['initialize', 'connect', 'disconnect', 'cleanup']

    for (const prop of required_properties) {
      if (!plugin[prop]) {
        console.error(`Plugin missing required property: ${prop}`)
        return false
      }
    }

    for (const method of required_methods) {
      if (typeof plugin[method] !== 'function') {
        console.error(`Plugin missing required method: ${method}`)
        return false
      }
    }

    return true
  }

  /**
   * Register a plugin in the manager
   */
  register_plugin(plugin) {
    const name = plugin.name || plugin.get_name()
    const platform = plugin.platform || plugin.get_platform()

    this.plugins.set(name, plugin)
    this.plugin_registry[name] = {
      name,
      platform,
      version: plugin.version || plugin.get_version(),
      status: 'registered',
      registered_at: Date.now(),
    }

    if (this.event_bus) {
      this.event_bus.emit('plugin:registered', { plugin: name, platform })
    }
  }

  /**
   * Get all loaded plugins
   */
  get_loaded_plugins() {
    return Array.from(this.plugins.keys())
  }

  /**
   * Get the plugin registry
   */
  get_plugin_registry() {
    return { ...this.plugin_registry }
  }

  /**
   * Reload a plugin
   */
  async reload_plugin(name) {
    const plugin = this.plugins.get(name)
    if (!plugin) {
      return false
    }

    if (plugin.cleanup) {
      await plugin.cleanup()
    }

    if (plugin.initialize) {
      await plugin.initialize()
    }

    return true
  }

  /**
   * Initialize a plugin
   */
  async initialize_plugin(name) {
    const plugin = this.plugins.get(name)
    if (!plugin) {
      return false
    }

    try {
      await plugin.initialize()
      this.plugin_registry[name].status = 'initialized'

      if (this.event_bus) {
        this.event_bus.emit('plugin:initialized', {
          plugin: name,
          platform: plugin.platform || plugin.get_platform(),
        })
      }

      return true
    } catch (error) {
      console.error('Plugin initialization failed:', { plugin: name, error })
      this.plugin_registry[name].status = 'failed'
      return false
    }
  }

  /**
   * Initialize all plugins
   */
  async initialize_all_plugins() {
    const plugins = Array.from(this.plugins.entries())

    // Sort by dependencies if needed
    const sorted_plugins = this.sort_by_dependencies(plugins)

    for (const [name, plugin] of sorted_plugins) {
      await this.initialize_plugin(name)
    }
  }

  /**
   * Sort plugins by their dependencies
   */
  sort_by_dependencies(plugins) {
    // Simple topological sort for plugin dependencies
    const sorted = []
    const visited = new Set()

    const visit = ([name, plugin]) => {
      if (visited.has(name)) return

      if (plugin.dependencies) {
        for (const dep of plugin.dependencies) {
          const dep_plugin = plugins.find(([n]) => n === dep)
          if (dep_plugin) {
            visit(dep_plugin)
          }
        }
      }

      visited.add(name)
      sorted.push([name, plugin])
    }

    for (const plugin_entry of plugins) {
      visit(plugin_entry)
    }

    return sorted
  }

  /**
   * Connect a plugin
   */
  async connect_plugin(name, options = {}) {
    const plugin = this.plugins.get(name)
    if (!plugin) {
      return false
    }

    if (options.retry && plugin.connect) {
      return this.connect_with_retry(plugin, options)
    }

    try {
      await plugin.connect()
      this.plugin_registry[name].status = 'connected'
      return true
    } catch (error) {
      console.error(`Failed to connect plugin ${name}:`, error)
      return false
    }
  }

  /**
   * Connect with retry logic
   */
  async connect_with_retry(plugin, options) {
    const max_retries = options.max_retries || 3
    let attempts = 0

    while (attempts < max_retries) {
      try {
        await plugin.connect()
        return true
      } catch (error) {
        attempts++
        if (attempts >= max_retries) {
          throw error
        }
        await this.delay(Math.pow(2, attempts) * 1000)
      }
    }

    return false
  }

  /**
   * Disconnect a plugin
   */
  async disconnect_plugin(name) {
    const plugin = this.plugins.get(name)
    if (!plugin || !plugin.disconnect) {
      return false
    }

    try {
      await plugin.disconnect()
      this.plugin_registry[name].status = 'disconnected'
      return true
    } catch (error) {
      console.error(`Failed to disconnect plugin ${name}:`, error)
      return false
    }
  }

  /**
   * Get plugin status
   */
  get_plugin_status(name) {
    const plugin = this.plugins.get(name)
    if (!plugin) {
      return 'not_found'
    }

    if (plugin.get_status) {
      return plugin.get_status()
    }

    return this.plugin_registry[name]?.status || 'unknown'
  }

  /**
   * Shutdown all plugins
   */
  async shutdown() {
    for (const [name, plugin] of this.plugins) {
      if (plugin.cleanup) {
        try {
          await plugin.cleanup()
        } catch (error) {
          console.error(`Error cleaning up plugin ${name}:`, error)
        }
      }
    }

    for (const handler of this.shutdown_handlers) {
      await handler()
    }
  }

  /**
   * Route events between plugins
   */
  async route_event(event) {
    const target_plugin_name = event.target
    const target_plugin = this.plugins.get(target_plugin_name)

    if (!target_plugin || !target_plugin.handle_event) {
      return false
    }

    try {
      await target_plugin.handle_event(event)
      return true
    } catch (error) {
      console.error(`Error routing event to ${target_plugin_name}:`, error)
      return false
    }
  }

  /**
   * Broadcast event to all plugins
   */
  async broadcast_event(event) {
    const promises = []

    for (const [name, plugin] of this.plugins) {
      if (plugin.handle_event) {
        promises.push(
          plugin.handle_event(event).catch(error => {
            console.error(`Error broadcasting to ${name}:`, error)
          })
        )
      }
    }

    await Promise.all(promises)
  }

  /**
   * Set event mappings for cross-platform routing
   */
  set_event_mappings(mappings) {
    this.event_mappings = { ...this.event_mappings, ...mappings }
  }

  /**
   * Map an event name to another platform's event
   */
  map_event(event_name) {
    return this.event_mappings[event_name] || event_name
  }

  /**
   * Execute an action on a plugin
   */
  async execute_plugin_action(plugin_name, action, params) {
    const plugin = this.plugins.get(plugin_name)

    if (!plugin) {
      return {
        success: false,
        error: `Plugin not found: ${plugin_name}`,
      }
    }

    if (plugin.execute_action) {
      try {
        const result = await plugin.execute_action(action, params)
        return { success: true, result }
      } catch (error) {
        return { success: false, error: error.message }
      }
    }

    return {
      success: false,
      error: `Plugin ${plugin_name} does not support actions`,
    }
  }

  /**
   * Get plugins by platform
   */
  get_plugins_by_platform(platform) {
    const matching_plugins = []

    for (const [name, plugin] of this.plugins) {
      const plugin_platform = plugin.platform || plugin.get_platform()
      if (plugin_platform === platform) {
        matching_plugins.push(plugin)
      }
    }

    return matching_plugins
  }

  /**
   * Set plugin configuration
   */
  set_plugin_config(name, config) {
    this.plugin_configs.set(name, config)

    const plugin = this.plugins.get(name)
    if (plugin && plugin.set_config) {
      plugin.set_config(this.get_plugin_config(name))
    }
  }

  /**
   * Get plugin configuration (merged with defaults)
   */
  get_plugin_config(name) {
    const defaults = this.plugin_defaults.get(name) || {}
    const config = this.plugin_configs.get(name) || {}
    return { ...defaults, ...config }
  }

  /**
   * Set plugin default configuration
   */
  set_plugin_defaults(name, defaults) {
    this.plugin_defaults.set(name, defaults)
  }

  /**
   * Validate plugin configuration
   */
  validate_plugin_config(name, config) {
    const plugin = this.plugins.get(name)

    if (!plugin) {
      return false
    }

    if (plugin.validate_config) {
      return plugin.validate_config(config)
    }

    // Basic validation
    return config && typeof config === 'object'
  }

  /**
   * Send message between plugins
   */
  async send_plugin_message(from, to, message) {
    const target_plugin = this.plugins.get(to)

    if (!target_plugin) {
      return null
    }

    const full_message = {
      from,
      timestamp: Date.now(),
      ...message,
    }

    if (target_plugin.receive_message) {
      return await target_plugin.receive_message(full_message)
    }

    // Queue message if plugin is offline
    if (this.get_plugin_status(to) === 'disconnected') {
      this.queue_message(to, full_message)
      return { status: 'queued' }
    }

    return null
  }

  /**
   * Queue a message for a plugin
   */
  queue_message(plugin_name, message) {
    if (!this.message_queues.has(plugin_name)) {
      this.message_queues.set(plugin_name, [])
    }
    this.message_queues.get(plugin_name).push(message)
  }

  /**
   * Get message queue for a plugin
   */
  get_message_queue(plugin_name) {
    return this.message_queues.get(plugin_name) || []
  }

  /**
   * Create plugin context (for sandboxing)
   */
  create_plugin_context(name) {
    if (!this.plugin_contexts.has(name)) {
      this.plugin_contexts.set(name, {
        storage: new Map(),
        cache: new Map(),
        timers: new Set(),
      })
    }
    return this.plugin_contexts.get(name)
  }

  /**
   * Discover plugins in a directory
   */
  async discover_plugins(dir) {
    try {
      const files = await fs.readdir(dir)
      const plugin_files = files.filter(f =>
        f.endsWith('-integration.js') || f.endsWith('-plugin.js')
      )
      return plugin_files.map(f => path.join(dir, f))
    } catch (error) {
      console.error('Failed to discover plugins:', error)
      return []
    }
  }

  /**
   * Helper: delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}