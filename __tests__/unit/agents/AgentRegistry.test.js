import { jest } from '@jest/globals';
import { AgentRegistry } from '../../../src/agents/AgentRegistry.js';
import { BaseAgent } from '../../../src/agents/BaseAgent.js';

// Mock agent for testing
class MockAgent extends BaseAgent {
  constructor(config) {
    super(config);
    this.executeCalled = false;
  }

  async execute(task, context) {
    this.executeCalled = true;
    return {
      success: true,
      result: { processed: task }
    };
  }

  getCapabilities() {
    return ['mock-capability'];
  }
}

describe('AgentRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  afterEach(async () => {
    // Cleanup registry to prevent hanging intervals
    await registry.shutdown();
    jest.clearAllMocks();
  });

  describe('Agent Registration', () => {
    test('should register a new agent', async () => {
      const agent = new MockAgent({ id: 'mock-agent', name: 'Mock Agent' });

      await registry.register('mock', agent);

      expect(registry.has('mock')).toBe(true);
      expect(registry.get('mock')).toBe(agent);
    });

    test('should throw error when registering duplicate agent', async () => {
      const agent = new MockAgent({ id: 'mock-agent', name: 'Mock Agent' });

      await registry.register('mock', agent);

      await expect(
        registry.register('mock', agent)
      ).rejects.toThrow('Agent mock is already registered');
    });

    test('should list all registered agents', async () => {
      const agent1 = new MockAgent({ id: 'agent1', name: 'Agent 1' });
      const agent2 = new MockAgent({ id: 'agent2', name: 'Agent 2' });

      await registry.register('agent1', agent1);
      await registry.register('agent2', agent2);

      const agents = registry.list();
      expect(agents).toHaveLength(2);
      expect(agents.map(a => a.id)).toEqual(['agent1', 'agent2']);
    });
  });

  describe('Agent Invocation', () => {
    test('should invoke agent with task and context', async () => {
      const agent = new MockAgent({ id: 'mock-agent', name: 'Mock Agent' });
      await registry.register('mock', agent);

      const result = await registry.invoke('mock', 'test-task', { data: 'test' });

      expect(agent.executeCalled).toBe(true);
      expect(result.success).toBe(true);
      expect(result.result.processed).toBe('test-task');
    });

    test('should throw error when invoking non-existent agent', async () => {
      await expect(
        registry.invoke('non-existent', 'task', {})
      ).rejects.toThrow('Agent non-existent not found');
    });

    test('should measure execution time', async () => {
      const agent = new MockAgent({ id: 'mock-agent', name: 'Mock Agent' });
      await registry.register('mock', agent);

      const result = await registry.invoke('mock', 'test-task', {});

      expect(result.metrics).toBeDefined();
      expect(result.metrics.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Agent Discovery', () => {
    test('should find agents by capability', async () => {
      const agent1 = new MockAgent({ id: 'agent1', name: 'Agent 1' });
      const agent2 = new MockAgent({ id: 'agent2', name: 'Agent 2' });

      agent1.getCapabilities = () => ['capability-a', 'capability-b'];
      agent2.getCapabilities = () => ['capability-b', 'capability-c'];

      await registry.register('agent1', agent1);
      await registry.register('agent2', agent2);

      const agents = registry.findByCapability('capability-b');
      expect(agents).toHaveLength(2);

      const agentsA = registry.findByCapability('capability-a');
      expect(agentsA).toHaveLength(1);
      expect(agentsA[0].id).toBe('agent1');
    });

    test('should return empty array for unknown capability', async () => {
      const agent = new MockAgent({ id: 'agent', name: 'Agent' });
      await registry.register('agent', agent);

      const agents = registry.findByCapability('unknown');
      expect(agents).toEqual([]);
    });
  });

  describe('Agent Lifecycle', () => {
    test('should initialize agent on registration', async () => {
      const agent = new MockAgent({ id: 'mock-agent', name: 'Mock Agent' });
      agent.initialize = jest.fn().mockResolvedValue();

      await registry.register('mock', agent);

      expect(agent.initialize).toHaveBeenCalled();
    });

    test('should cleanup agent on unregister', async () => {
      const agent = new MockAgent({ id: 'mock-agent', name: 'Mock Agent' });
      agent.cleanup = jest.fn().mockResolvedValue();

      await registry.register('mock', agent);
      await registry.unregister('mock');

      expect(agent.cleanup).toHaveBeenCalled();
      expect(registry.has('mock')).toBe(false);
    });

    test('should cleanup all agents on shutdown', async () => {
      const agent1 = new MockAgent({ id: 'agent1', name: 'Agent 1' });
      const agent2 = new MockAgent({ id: 'agent2', name: 'Agent 2' });

      agent1.cleanup = jest.fn().mockResolvedValue();
      agent2.cleanup = jest.fn().mockResolvedValue();

      await registry.register('agent1', agent1);
      await registry.register('agent2', agent2);

      await registry.shutdown();

      expect(agent1.cleanup).toHaveBeenCalled();
      expect(agent2.cleanup).toHaveBeenCalled();
      expect(registry.list()).toHaveLength(0);
    });
  });

  describe('Agent State Management', () => {
    test('should get agent status', async () => {
      const agent = new MockAgent({ id: 'mock-agent', name: 'Mock Agent' });
      await registry.register('mock', agent);

      const status = registry.getStatus('mock');

      expect(status).toEqual({
        id: 'mock-agent',
        name: 'Mock Agent',
        status: 'ready',
        capabilities: ['mock-capability']
      });
    });

    test('should track agent execution state', async () => {
      const agent = new MockAgent({ id: 'mock-agent', name: 'Mock Agent' });
      agent.execute = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { success: true };
      });

      await registry.register('mock', agent);

      const promise = registry.invoke('mock', 'task', {});

      // Check status during execution
      let status = registry.getStatus('mock');
      expect(status.status).toBe('busy');

      await promise;

      // Check status after execution
      status = registry.getStatus('mock');
      expect(status.status).toBe('ready');
    });
  });
});