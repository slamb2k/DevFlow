import { EventEmitter } from 'events';
import { BaseAgent } from './BaseAgent.js';

/**
 * Central registry for managing DevFlow agents
 * Handles agent registration, discovery, invocation, and lifecycle
 */
export class AgentRegistry extends EventEmitter {
  constructor() {
    super();

    // Map of agent ID to agent instance
    this.agents = new Map();

    // Map of agent ID to status
    this.agentStatus = new Map();

    // Message queue for inter-agent communication
    this.messageQueue = [];

    // Message processing interval
    this.messageInterval = null;

    // Setup message routing
    this.setupMessageRouting();
  }

  /**
   * Register a new agent
   * @param {string} id - Unique agent identifier
   * @param {BaseAgent} agent - Agent instance
   */
  async register(id, agent) {
    if (this.agents.has(id)) {
      throw new Error(`Agent ${id} is already registered`);
    }

    if (!(agent instanceof BaseAgent)) {
      throw new Error('Agent must extend BaseAgent class');
    }

    // Store agent
    this.agents.set(id, agent);
    this.agentStatus.set(id, 'registering');

    // Setup agent event listeners
    this.setupAgentListeners(id, agent);

    // Initialize agent
    try {
      await agent.initialize();
      this.agentStatus.set(id, 'ready');
      this.emit('agent:registered', { id, agent: agent.getStatus() });
    } catch (error) {
      this.agentStatus.set(id, 'error');
      this.agents.delete(id);
      throw new Error(`Failed to initialize agent ${id}: ${error.message}`);
    }
  }

  /**
   * Unregister an agent
   * @param {string} id - Agent identifier
   */
  async unregister(id) {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error(`Agent ${id} not found`);
    }

    this.agentStatus.set(id, 'unregistering');

    try {
      // Cleanup agent
      await agent.cleanup();

      // Remove from registry
      this.agents.delete(id);
      this.agentStatus.delete(id);

      this.emit('agent:unregistered', { id });
    } catch (error) {
      this.agentStatus.set(id, 'error');
      throw new Error(`Failed to unregister agent ${id}: ${error.message}`);
    }
  }

  /**
   * Check if agent is registered
   * @param {string} id - Agent identifier
   */
  has(id) {
    return this.agents.has(id);
  }

  /**
   * Get agent by ID
   * @param {string} id - Agent identifier
   */
  get(id) {
    return this.agents.get(id);
  }

  /**
   * List all registered agents
   */
  list() {
    return Array.from(this.agents.values()).map(agent => agent.getStatus());
  }

  /**
   * Find agents by capability
   * @param {string} capability - Capability to search for
   */
  findByCapability(capability) {
    const matchingAgents = [];

    for (const agent of this.agents.values()) {
      if (agent.getCapabilities().includes(capability)) {
        matchingAgents.push(agent.getStatus());
      }
    }

    return matchingAgents;
  }

  /**
   * Invoke an agent with a task
   * @param {string} id - Agent identifier
   * @param {string} task - Task to execute
   * @param {Object} context - Task context
   */
  async invoke(id, task, context = {}) {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error(`Agent ${id} not found`);
    }

    const currentStatus = this.agentStatus.get(id);
    if (currentStatus !== 'ready') {
      throw new Error(`Agent ${id} is not ready (status: ${currentStatus})`);
    }

    // Mark agent as busy
    this.agentStatus.set(id, 'busy');
    this.emit('agent:invoked', { id, task, context });

    try {
      const startTime = Date.now();
      const result = await agent.execute(task, context);
      const executionTime = Date.now() - startTime;

      // Mark agent as ready
      this.agentStatus.set(id, 'ready');

      // Add registry-level metrics
      const enhancedResult = {
        ...result,
        metrics: {
          ...result.metrics,
          executionTime,
          registryTime: Date.now() - startTime
        }
      };

      this.emit('agent:completed', {
        id,
        task,
        result: enhancedResult
      });

      return enhancedResult;
    } catch (error) {
      this.agentStatus.set(id, 'ready');
      this.emit('agent:error', { id, task, error });
      throw error;
    }
  }

  /**
   * Get agent status
   * @param {string} id - Agent identifier
   */
  getStatus(id) {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error(`Agent ${id} not found`);
    }

    const status = agent.getStatus();
    // Override with registry status if different
    const registryStatus = this.agentStatus.get(id);
    if (registryStatus === 'busy') {
      status.status = 'busy';
    }

    return status;
  }

  /**
   * Get all agent statuses
   */
  getAllStatuses() {
    const statuses = {};
    for (const [id, agent] of this.agents.entries()) {
      statuses[id] = this.getStatus(id);
    }
    return statuses;
  }

  /**
   * Shutdown all agents
   */
  async shutdown() {
    this.emit('registry:shutdown:start');

    // Clear message processing interval
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
      this.messageInterval = null;
    }

    const shutdownPromises = [];
    for (const [id, agent] of this.agents.entries()) {
      shutdownPromises.push(
        this.unregister(id).catch(error => {
          console.error(`Failed to shutdown agent ${id}:`, error);
        })
      );
    }

    await Promise.all(shutdownPromises);

    this.agents.clear();
    this.agentStatus.clear();
    this.messageQueue = [];

    this.emit('registry:shutdown:complete');
  }

  /**
   * Setup event listeners for an agent
   * @private
   */
  setupAgentListeners(id, agent) {
    // Forward agent events
    agent.on('ready', () => {
      this.emit('agent:ready', { id });
    });

    agent.on('error', (error) => {
      this.emit('agent:error', { id, error });
    });

    agent.on('task:start', (data) => {
      this.emit('agent:task:start', { id, ...data });
    });

    agent.on('task:complete', (data) => {
      this.emit('agent:task:complete', { id, ...data });
    });

    agent.on('message:send', async (data) => {
      await this.routeMessage(data);
    });
  }

  /**
   * Setup message routing between agents
   * @private
   */
  setupMessageRouting() {
    // Process message queue periodically
    this.messageInterval = setInterval(() => {
      this.processMessageQueue();
    }, 100);
  }

  /**
   * Route a message between agents
   * @private
   */
  async routeMessage(messageData) {
    const { from, to, message } = messageData;

    const targetAgent = this.agents.get(to);
    if (!targetAgent) {
      this.emit('message:failed', {
        from,
        to,
        reason: `Target agent ${to} not found`
      });
      return;
    }

    // Add to message queue
    this.messageQueue.push({
      from,
      to,
      message,
      timestamp: new Date().toISOString()
    });

    this.emit('message:queued', { from, to });
  }

  /**
   * Process queued messages
   * @private
   */
  async processMessageQueue() {
    if (this.messageQueue.length === 0) {
      return;
    }

    const message = this.messageQueue.shift();
    const targetAgent = this.agents.get(message.to);

    if (targetAgent && this.agentStatus.get(message.to) === 'ready') {
      try {
        await targetAgent.receiveMessage({
          from: message.from,
          content: message.message,
          timestamp: message.timestamp
        });

        this.emit('message:delivered', {
          from: message.from,
          to: message.to
        });
      } catch (error) {
        this.emit('message:failed', {
          from: message.from,
          to: message.to,
          error: error.message
        });
      }
    } else {
      // Re-queue message if agent not ready
      this.messageQueue.push(message);
    }
  }

  /**
   * Broadcast a message to all agents
   * @param {Object} message - Message to broadcast
   * @param {string} sender - Sender ID (optional)
   */
  async broadcast(message, sender = 'registry') {
    const promises = [];

    for (const [id, agent] of this.agents.entries()) {
      if (id !== sender) {
        promises.push(
          agent.receiveMessage({
            from: sender,
            content: message,
            timestamp: new Date().toISOString(),
            broadcast: true
          }).catch(error => {
            console.error(`Failed to broadcast to agent ${id}:`, error);
          })
        );
      }
    }

    await Promise.all(promises);
    this.emit('message:broadcast', { from: sender, count: promises.length });
  }

  /**
   * Execute a task using the most suitable agent
   * @param {string} capability - Required capability
   * @param {string} task - Task to execute
   * @param {Object} context - Task context
   */
  async executeWithCapability(capability, task, context = {}) {
    const agents = this.findByCapability(capability);
    if (agents.length === 0) {
      throw new Error(`No agents found with capability: ${capability}`);
    }

    // Find first available agent
    for (const agentInfo of agents) {
      const status = this.agentStatus.get(agentInfo.id);
      if (status === 'ready') {
        return await this.invoke(agentInfo.id, task, context);
      }
    }

    throw new Error(`All agents with capability ${capability} are busy`);
  }
}