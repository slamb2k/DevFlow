import { EventEmitter } from 'events'

/**
 * Base class for all platform integrations
 * Provides common functionality and defines the interface that all integrations must implement
 */
export class BaseIntegration extends EventEmitter {
  constructor(options = {}) {
    super()

    this.name = options.name || 'unknown'
    this.platform = options.platform || 'unknown'
    this.version = options.version || '1.0.0'
    this.status = 'disconnected'
    this.config = {}
    this.metadata = options.metadata || {}
  }

  /**
   * Initialize the integration
   * Must be implemented by subclasses
   */
  async initialize() {
    throw new Error('Method initialize must be implemented')
  }

  /**
   * Connect to the platform
   * Must be implemented by subclasses
   */
  async connect() {
    throw new Error('Method connect must be implemented')
  }

  /**
   * Disconnect from the platform
   * Must be implemented by subclasses
   */
  async disconnect() {
    throw new Error('Method disconnect must be implemented')
  }

  /**
   * Cleanup resources
   * Must be implemented by subclasses
   */
  async cleanup() {
    throw new Error('Method cleanup must be implemented')
  }

  /**
   * Handle incoming events from the platform
   * Must be implemented by subclasses
   */
  async handle_event(event) {
    throw new Error('Method handle_event must be implemented')
  }

  /**
   * Get the current status of the integration
   */
  get_status() {
    return this.status
  }

  /**
   * Set the status of the integration
   */
  set_status(status) {
    const old_status = this.status
    this.status = status
    this.emit('status_changed', { old_status, new_status: status })
  }

  /**
   * Get the integration name
   */
  get_name() {
    return this.name
  }

  /**
   * Get the platform name
   */
  get_platform() {
    return this.platform
  }

  /**
   * Get the integration version
   */
  get_version() {
    return this.version
  }

  /**
   * Set the integration configuration
   */
  set_config(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid configuration')
    }
    this.config = { ...this.config, ...config }
    this.emit('config_changed', this.config)
  }

  /**
   * Get the integration configuration
   */
  get_config() {
    return { ...this.config }
  }

  /**
   * Validate configuration
   * Can be overridden by subclasses for specific validation
   */
  validate_config(config) {
    return config && typeof config === 'object'
  }

  /**
   * Send an event to the platform
   * Can be overridden by subclasses
   */
  async send_event(event) {
    throw new Error('Method send_event must be implemented')
  }

  /**
   * Receive a message from another plugin
   * Can be overridden by subclasses
   */
  async receive_message(message) {
    return { status: 'received', message }
  }

  /**
   * Get integration metadata
   */
  get_metadata() {
    return { ...this.metadata }
  }

  /**
   * Set integration metadata
   */
  set_metadata(metadata) {
    this.metadata = { ...this.metadata, ...metadata }
  }

  /**
   * Health check for the integration
   * Can be overridden by subclasses
   */
  async health_check() {
    return {
      healthy: this.status === 'connected',
      status: this.status,
      platform: this.platform,
      name: this.name,
    }
  }

  /**
   * Get integration capabilities
   * Should be overridden by subclasses to declare their capabilities
   */
  get_capabilities() {
    return {
      events: [],
      actions: [],
      webhooks: false,
      oauth: false,
      rate_limited: true,
    }
  }

  /**
   * Execute a platform-specific action
   * Should be overridden by subclasses
   */
  async execute_action(action, params) {
    throw new Error(`Action ${action} not implemented`)
  }

  /**
   * Get integration statistics
   */
  get_stats() {
    return {
      platform: this.platform,
      name: this.name,
      status: this.status,
      uptime: Date.now() - (this.connected_at || Date.now()),
    }
  }

  /**
   * Override emit to catch errors in event handlers
   */
  emit(event, ...args) {
    try {
      return super.emit(event, ...args)
    } catch (error) {
      console.error('Error in event handler:', error)
      this.emit('error', error)
      return false
    }
  }
}