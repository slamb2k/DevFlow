/**
 * Enhanced Command Registry with Agent Integration
 * Extends the base CommandRegistry to support agent-powered commands
 */

import { CommandRegistry } from './CommandRegistry.js';
import { AgentRegistry } from '../agents/AgentRegistry.js';

export class EnhancedCommandRegistry extends CommandRegistry {
  constructor() {
    super();
    this.agentRegistry = new AgentRegistry();
    this.agentCommands = new Map();
  }

  /**
   * Initialize the enhanced registry
   */
  async initialize() {
    // Load built-in commands
    await this.loadBuiltinCommands();

    // Initialize agent registry
    await this.initializeAgents();

    return this;
  }

  /**
   * Initialize default agents
   */
  async initializeAgents() {
    // This will be expanded when specialized agents are implemented
    // For now, just set up the registry
    this.agentRegistry.on('agent:registered', ({ id, agent: _agent }) => {
      console.log(`Agent registered: ${id}`);
    });

    this.agentRegistry.on('agent:error', ({ id, error }) => {
      console.error(`Agent error (${id}):`, error);
    });
  }

  /**
   * Register an agent-powered command
   * @param {string} name - Command name
   * @param {string} agentId - Agent ID to handle the command
   * @param {Object} options - Command options
   */
  registerAgentCommand(name, agentId, options = {}) {
    // Validate command name
    if (!name || !/^[a-z0-9-]+$/.test(name)) {
      throw new Error(`Invalid command name: ${name}`);
    }

    this.agentCommands.set(name, {
      agentId,
      options,
    });

    // Register aliases
    if (options.aliases) {
      for (const alias of options.aliases) {
        this.aliases.set(alias, name);
      }
    }

    return this;
  }

  /**
   * Execute a command (enhanced to support agent commands)
   */
  async execute(name, args = [], context = {}) {
    // Check if it's an agent command
    const agentCommand = this.agentCommands.get(name);

    if (agentCommand) {
      return await this.executeAgentCommand(name, agentCommand.agentId, args, context);
    }

    // Fall back to regular command execution
    return await super.execute(name, args, context);
  }

  /**
   * Execute an agent-powered command
   * @private
   */
  async executeAgentCommand(commandName, agentId, args, context) {
    // Check if agent is registered
    if (!this.agentRegistry.has(agentId)) {
      throw new Error(`Agent ${agentId} not found for command ${commandName}`);
    }

    // Prepare task for agent
    const task = {
      command: commandName,
      args,
      type: 'command-execution',
    };

    // Execute via agent
    try {
      const result = await this.agentRegistry.invoke(agentId, task, context);

      if (result.success) {
        return result.result;
      } else {
        throw new Error(result.error || 'Agent execution failed');
      }
    } catch (error) {
      throw new Error(`Failed to execute agent command ${commandName}: ${error.message}`);
    }
  }

  /**
   * Register an agent with the registry
   * @param {string} id - Agent ID
   * @param {BaseAgent} agent - Agent instance
   */
  async registerAgent(id, agent) {
    await this.agentRegistry.register(id, agent);
    return this;
  }

  /**
   * Get agent registry
   */
  getAgentRegistry() {
    return this.agentRegistry;
  }

  /**
   * List all agents
   */
  listAgents() {
    return this.agentRegistry.list();
  }

  /**
   * Find agents by capability
   * @param {string} capability - Capability to search for
   */
  findAgentsByCapability(capability) {
    return this.agentRegistry.findByCapability(capability);
  }

  /**
   * Execute command with specific agent capability
   * @param {string} capability - Required capability
   * @param {string} command - Command to execute
   * @param {Array} args - Command arguments
   * @param {Object} context - Execution context
   */
  async executeWithCapability(capability, command, args = [], context = {}) {
    const task = {
      command,
      args,
      type: 'capability-execution',
    };

    return await this.agentRegistry.executeWithCapability(capability, task, context);
  }

  /**
   * Execute a pipeline with agent support
   */
  async pipeline(steps, initialContext = {}) {
    let context = { ...initialContext };

    for (const step of steps) {
      const { command, args = [], agent = null } = step;

      if (agent) {
        // Execute via specific agent
        context = await this.executeAgentCommand(command, agent, args, context);
      } else {
        // Execute normally
        context = await this.execute(command, args, context);
      }
    }

    return context;
  }

  /**
   * Get command help (enhanced for agent commands)
   */
  getHelp(name) {
    const agentCommand = this.agentCommands.get(name);

    if (agentCommand) {
      return {
        name,
        description: agentCommand.options.description || 'Agent-powered command',
        usage: agentCommand.options.usage || `/${name} [options]`,
        agent: agentCommand.agentId,
        options: agentCommand.options.helpOptions || [],
      };
    }

    return super.getHelp(name);
  }

  /**
   * Get all help (including agent commands)
   */
  getAllHelp() {
    const help = super.getAllHelp();

    // Add agent command help
    for (const [name, _agentCommand] of this.agentCommands) {
      help[name] = this.getHelp(name);
    }

    return help;
  }

  /**
   * Shutdown the registry and all agents
   */
  async shutdown() {
    await this.agentRegistry.shutdown();
  }

  /**
   * Create an agent-aware command dispatcher
   */
  createDispatcher() {
    return async (input, context = {}) => {
      // Handle slash commands
      if (input.startsWith('/')) {
        const commandString = input.slice(1);

        // Check for agent directive
        if (commandString.includes('@')) {
          const [cmdPart, agentPart] = commandString.split('@');
          const { command, args } = this.parse(cmdPart);

          // Execute with specific agent
          return await this.executeAgentCommand(command, agentPart, args, context);
        }

        // Normal command execution
        return await this.executeString(commandString, context);
      }

      throw new Error('Invalid command format. Commands must start with /');
    };
  }

  /**
   * Enable agent mode for existing commands
   * This allows existing commands to use agents for enhanced functionality
   */
  enableAgentMode() {
    // Hook into existing commands to add agent support
    const originalExecute = this.execute.bind(this);

    this.execute = async (name, args = [], context = {}) => {
      // Check if agent mode is requested
      if (context.useAgent && context.agentId) {
        return await this.executeAgentCommand(name, context.agentId, args, context);
      }

      // Check if there's a preferred agent for this command type
      const preferredAgent = this.findPreferredAgent(name);
      if (preferredAgent && context.autoAgent !== false) {
        context.agentId = preferredAgent;
        return await this.executeAgentCommand(name, preferredAgent, args, context);
      }

      return await originalExecute(name, args, context);
    };
  }

  /**
   * Find preferred agent for a command
   * @private
   */
  findPreferredAgent(commandName) {
    // Map commands to preferred agents
    const preferences = {
      'devflow-analyze': 'analyzer',
      'devflow-optimize': 'optimizer',
      'devflow-security': 'security',
      'devflow-architect': 'architect',
    };

    const agentId = preferences[commandName];
    if (agentId && this.agentRegistry.has(agentId)) {
      return agentId;
    }

    return null;
  }
}
