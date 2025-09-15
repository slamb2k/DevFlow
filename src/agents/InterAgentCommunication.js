import { EventEmitter } from 'events';

/**
 * Inter-agent communication module for coordinating between specialized agents
 */
export class InterAgentCommunication extends EventEmitter {
  constructor() {
    super();

    // Message queue for coordinated workflows
    this.workflowQueue = [];

    // Active workflows
    this.activeWorkflows = new Map();

    // Agent collaboration patterns
    this.collaborationPatterns = this.loadCollaborationPatterns();
  }

  loadCollaborationPatterns() {
    return {
      'security-analysis': {
        name: 'Security Analysis Pipeline',
        agents: ['analyzer', 'security'],
        flow: [
          { agent: 'analyzer', task: 'analyze-dependencies', output: 'dependencies' },
          { agent: 'security', task: 'audit-dependencies', input: 'dependencies' },
        ],
      },
      'performance-optimization': {
        name: 'Performance Optimization Pipeline',
        agents: ['analyzer', 'optimizer'],
        flow: [
          { agent: 'analyzer', task: 'analyze-complexity', output: 'complexity' },
          { agent: 'optimizer', task: 'suggest-optimizations', input: 'complexity' },
        ],
      },
      'architecture-review': {
        name: 'Architecture Review Pipeline',
        agents: ['architect', 'analyzer', 'security'],
        flow: [
          { agent: 'architect', task: 'analyze-structure', output: 'structure' },
          { agent: 'analyzer', task: 'detect-patterns', input: 'structure' },
          { agent: 'security', task: 'scan-vulnerabilities', input: 'structure' },
        ],
      },
      'full-analysis': {
        name: 'Comprehensive Analysis Pipeline',
        agents: ['analyzer', 'architect', 'security', 'optimizer'],
        flow: [
          { agent: 'analyzer', task: 'analyze-project', output: 'analysis' },
          { agent: 'architect', task: 'validate-architecture', input: 'analysis' },
          { agent: 'security', task: 'generate-report', input: 'analysis' },
          { agent: 'optimizer', task: 'generate-report', input: 'analysis' },
        ],
      },
    };
  }

  /**
   * Create a coordinated workflow between agents
   */
  async createWorkflow(patternName, context, _registry) {
    const pattern = this.collaborationPatterns[patternName];
    if (!pattern) {
      throw new Error(`Unknown collaboration pattern: ${patternName}`);
    }

    const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const workflow = {
      id: workflowId,
      pattern: patternName,
      status: 'pending',
      context,
      results: {},
      startTime: Date.now(),
    };

    this.activeWorkflows.set(workflowId, workflow);
    this.emit('workflow:created', { workflowId, pattern: patternName });

    return workflowId;
  }

  /**
   * Execute a coordinated workflow
   */
  async executeWorkflow(workflowId, registry) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const pattern = this.collaborationPatterns[workflow.pattern];
    workflow.status = 'running';
    this.emit('workflow:started', { workflowId });

    try {
      let previousOutput = null;

      for (const step of pattern.flow) {
        const { agent, task, input, output } = step;

        // Check if agent is available
        if (!registry.has(agent)) {
          throw new Error(`Agent ${agent} not available`);
        }

        // Prepare context for this step
        const stepContext = { ...workflow.context };
        if (input && previousOutput) {
          stepContext[input] = previousOutput;
        }

        // Execute task
        this.emit('workflow:step:start', { workflowId, agent, task });

        const result = await registry.invoke(agent, task, stepContext);

        this.emit('workflow:step:complete', { workflowId, agent, task, result });

        // Store result
        workflow.results[`${agent}:${task}`] = result;

        // Prepare output for next step
        if (output) {
          previousOutput = result.result;
        }
      }

      workflow.status = 'completed';
      workflow.endTime = Date.now();
      workflow.duration = workflow.endTime - workflow.startTime;

      this.emit('workflow:completed', {
        workflowId,
        results: workflow.results,
        duration: workflow.duration,
      });

      return workflow.results;
    } catch (error) {
      workflow.status = 'failed';
      workflow.error = error.message;

      this.emit('workflow:failed', { workflowId, error: error.message });
      throw error;
    }
  }

  /**
   * Create a message for inter-agent communication
   */
  createMessage(from, to, type, data) {
    return {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from,
      to,
      type,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Send a request from one agent to another
   */
  async sendRequest(from, to, request, registry) {
    const message = this.createMessage(from, to, 'request', request);

    this.emit('message:sent', message);

    try {
      // Invoke target agent
      const response = await registry.invoke(to, request.task, request.context);

      const responseMessage = this.createMessage(to, from, 'response', response);
      this.emit('message:received', responseMessage);

      return response;
    } catch (error) {
      const errorMessage = this.createMessage(to, from, 'error', { error: error.message });
      this.emit('message:error', errorMessage);
      throw error;
    }
  }

  /**
   * Broadcast a message to multiple agents
   */
  async broadcastMessage(from, agents, message, registry) {
    const results = {};

    for (const agentId of agents) {
      if (registry.has(agentId)) {
        try {
          await registry.get(agentId).receiveMessage({
            from,
            content: message,
            timestamp: new Date().toISOString(),
            broadcast: true,
          });
          results[agentId] = { delivered: true };
        } catch (error) {
          results[agentId] = { delivered: false, error: error.message };
        }
      } else {
        results[agentId] = { delivered: false, error: 'Agent not found' };
      }
    }

    this.emit('broadcast:complete', { from, agents, results });
    return results;
  }

  /**
   * Coordinate parallel execution of tasks across agents
   */
  async executeParallel(tasks, registry) {
    const promises = tasks.map(async ({ agent, task, context }) => {
      try {
        const result = await registry.invoke(agent, task, context);
        return { agent, task, success: true, result };
      } catch (error) {
        return { agent, task, success: false, error: error.message };
      }
    });

    const results = await Promise.all(promises);

    this.emit('parallel:complete', { tasks: results });
    return results;
  }

  /**
   * Create a pipeline of agent tasks
   */
  async executePipeline(steps, initialContext, registry) {
    let context = { ...initialContext };
    const results = [];

    for (const step of steps) {
      const { agent, task, transform } = step;

      try {
        const result = await registry.invoke(agent, task, context);
        results.push({ agent, task, result });

        // Transform context for next step if transformer provided
        if (transform && typeof transform === 'function') {
          context = transform(context, result);
        } else {
          // Default: merge result into context
          context = { ...context, [`${agent}_${task}_result`]: result };
        }
      } catch (error) {
        this.emit('pipeline:error', { agent, task, error: error.message });
        throw error;
      }
    }

    this.emit('pipeline:complete', { results });
    return results;
  }

  /**
   * Get status of a workflow
   */
  getWorkflowStatus(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      return null;
    }

    return {
      id: workflow.id,
      pattern: workflow.pattern,
      status: workflow.status,
      duration: workflow.duration,
      error: workflow.error,
    };
  }

  /**
   * Cancel a running workflow
   */
  cancelWorkflow(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      return false;
    }

    if (workflow.status === 'running') {
      workflow.status = 'cancelled';
      this.emit('workflow:cancelled', { workflowId });
      return true;
    }

    return false;
  }

  /**
   * Clean up completed workflows
   */
  cleanupWorkflows(olderThan = 3600000) {
    // Default: 1 hour
    const now = Date.now();
    const toRemove = [];

    for (const [id, workflow] of this.activeWorkflows.entries()) {
      if (workflow.status !== 'running' && now - workflow.startTime > olderThan) {
        toRemove.push(id);
      }
    }

    toRemove.forEach((id) => this.activeWorkflows.delete(id));
    return toRemove.length;
  }

  /**
   * Get collaboration metrics
   */
  getMetrics() {
    const workflows = Array.from(this.activeWorkflows.values());

    return {
      total: workflows.length,
      pending: workflows.filter((w) => w.status === 'pending').length,
      running: workflows.filter((w) => w.status === 'running').length,
      completed: workflows.filter((w) => w.status === 'completed').length,
      failed: workflows.filter((w) => w.status === 'failed').length,
      averageDuration:
        workflows.filter((w) => w.duration).reduce((sum, w) => sum + w.duration, 0) /
          workflows.filter((w) => w.duration).length || 0,
    };
  }
}

// Export singleton instance
export const interAgentComm = new InterAgentCommunication();
