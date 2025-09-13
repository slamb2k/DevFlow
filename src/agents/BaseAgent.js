import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

/**
 * Base class for all DevFlow agents
 * Provides core functionality for agent lifecycle, state management, and communication
 */
export class BaseAgent extends EventEmitter {
  constructor(config = {}) {
    super();

    this.id = config.id || this.constructor.name.toLowerCase();
    this.name = config.name || this.constructor.name;
    this.description = config.description || '';
    this.version = config.version || '1.0.0';

    this.status = 'idle';
    this.config = config;
    this.state = {};
    this.capabilities = [];

    // State persistence path
    this.statePath = path.join(
      process.cwd(),
      '.devflow',
      'agents',
      this.id,
      'state.json'
    );
  }

  /**
   * Initialize the agent
   * Override in subclasses for custom initialization
   */
  async initialize() {
    this.status = 'initializing';
    this.emit('initializing', { agent: this.id });

    try {
      // Load persisted state if exists
      await this.loadState();

      // Run custom initialization
      await this.onInitialize();

      this.status = 'ready';
      this.emit('ready', { agent: this.id });
    } catch (error) {
      this.status = 'error';
      this.emit('error', { agent: this.id, error });
      throw error;
    }
  }

  /**
   * Custom initialization hook for subclasses
   */
  async onInitialize() {
    // Override in subclasses
  }

  /**
   * Execute a task
   * This is the main entry point for agent work
   * @param {string} task - Task identifier
   * @param {Object} context - Task context and parameters
   */
  async execute(task, context = {}) {
    if (this.status !== 'ready') {
      throw new Error(`Agent ${this.id} is not ready (status: ${this.status})`);
    }

    this.status = 'busy';
    this.emit('task:start', { agent: this.id, task, context });

    try {
      // Validate task
      if (!this.canHandle(task)) {
        throw new Error(`Agent ${this.id} cannot handle task: ${task}`);
      }

      // Execute task implementation
      const startTime = Date.now();
      const result = await this.onExecute(task, context);
      const executionTime = Date.now() - startTime;

      // Save state after execution
      await this.saveState();

      this.status = 'ready';
      this.emit('task:complete', {
        agent: this.id,
        task,
        result,
        executionTime
      });

      return {
        success: true,
        result,
        metrics: {
          executionTime,
          agentId: this.id
        }
      };
    } catch (error) {
      this.status = 'ready';
      this.emit('task:error', { agent: this.id, task, error });

      return {
        success: false,
        error: error.message,
        metrics: {
          agentId: this.id
        }
      };
    }
  }

  /**
   * Task execution implementation
   * Must be overridden in subclasses
   */
  async onExecute(task, context) {
    throw new Error(`Agent ${this.id} must implement onExecute method`);
  }

  /**
   * Check if agent can handle a task
   * @param {string} task - Task identifier
   */
  canHandle(task) {
    // Default implementation - override in subclasses
    return true;
  }

  /**
   * Get agent capabilities
   */
  getCapabilities() {
    return this.capabilities;
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      capabilities: this.getCapabilities()
    };
  }

  /**
   * Load agent state from disk
   */
  async loadState() {
    try {
      const stateData = await fs.readFile(this.statePath, 'utf-8');
      this.state = JSON.parse(stateData);
      this.emit('state:loaded', { agent: this.id, state: this.state });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`Failed to load state for agent ${this.id}:`, error.message);
      }
      // Initialize with empty state if file doesn't exist
      this.state = {};
    }
  }

  /**
   * Save agent state to disk
   */
  async saveState() {
    try {
      const stateDir = path.dirname(this.statePath);
      await fs.mkdir(stateDir, { recursive: true });
      await fs.writeFile(
        this.statePath,
        JSON.stringify(this.state, null, 2),
        'utf-8'
      );
      this.emit('state:saved', { agent: this.id, state: this.state });
    } catch (error) {
      console.error(`Failed to save state for agent ${this.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Update agent state
   * @param {Object} updates - State updates to apply
   */
  updateState(updates) {
    this.state = { ...this.state, ...updates };
    this.emit('state:updated', { agent: this.id, updates });
  }

  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Cleanup agent resources
   * Override in subclasses for custom cleanup
   */
  async cleanup() {
    this.status = 'cleaning';
    this.emit('cleaning', { agent: this.id });

    try {
      // Save final state
      await this.saveState();

      // Run custom cleanup
      await this.onCleanup();

      this.status = 'stopped';
      this.emit('stopped', { agent: this.id });
    } catch (error) {
      this.status = 'error';
      this.emit('error', { agent: this.id, error });
      throw error;
    }
  }

  /**
   * Custom cleanup hook for subclasses
   */
  async onCleanup() {
    // Override in subclasses
  }

  /**
   * Send message to another agent
   * @param {string} targetAgent - Target agent ID
   * @param {Object} message - Message to send
   */
  async sendMessage(targetAgent, message) {
    this.emit('message:send', {
      from: this.id,
      to: targetAgent,
      message
    });

    // Message sending will be handled by AgentRegistry
    return {
      sent: true,
      from: this.id,
      to: targetAgent,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Receive message from another agent
   * @param {Object} message - Received message
   */
  async receiveMessage(message) {
    this.emit('message:received', {
      agent: this.id,
      message
    });

    // Handle message - override in subclasses for custom handling
    return await this.onMessage(message);
  }

  /**
   * Message handling hook for subclasses
   */
  async onMessage(message) {
    // Override in subclasses
    return { received: true };
  }
}