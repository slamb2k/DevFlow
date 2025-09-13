/**
 * DevFlow Agent System
 * Export all agent-related components
 */

// Core agent classes
export { BaseAgent } from './BaseAgent.js';
export { AgentRegistry } from './AgentRegistry.js';

// Specialized agents
export { AnalyzerAgent } from './AnalyzerAgent.js';
export { ArchitectAgent } from './ArchitectAgent.js';
export { SecurityAgent } from './SecurityAgent.js';
export { OptimizerAgent } from './OptimizerAgent.js';

// Communication protocols
export { JsonRpcProtocol, AgentCommunicator } from './protocol/JsonRpcProtocol.js';
export { InterAgentCommunication, interAgentComm } from './InterAgentCommunication.js';

// Configuration
export {
  agentSchemas,
  getDefaultConfig,
  validateConfig,
  mergeWithDefaults
} from './config/agent-schemas.js';

// Re-export enhanced command registry for convenience
export { EnhancedCommandRegistry } from '../commands/EnhancedCommandRegistry.js';