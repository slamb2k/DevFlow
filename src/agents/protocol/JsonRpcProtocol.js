/**
 * JSON-RPC 2.0 protocol implementation for agent communication
 * Provides standardized message format for inter-agent communication
 */
export class JsonRpcProtocol {
  constructor() {
    this.version = '2.0';
    this.requestId = 0;
  }

  /**
   * Create a JSON-RPC request
   * @param {string} method - Method name to call
   * @param {*} params - Method parameters
   * @param {string|number} id - Request ID (optional)
   */
  createRequest(method, params = null, id = null) {
    if (!method || typeof method !== 'string') {
      throw new Error('Method name is required and must be a string');
    }

    const request = {
      jsonrpc: this.version,
      method,
      id: id !== null ? id : ++this.requestId,
    };

    if (params !== null && params !== undefined) {
      request.params = params;
    }

    return request;
  }

  /**
   * Create a JSON-RPC notification (request without ID)
   * @param {string} method - Method name to call
   * @param {*} params - Method parameters
   */
  createNotification(method, params = null) {
    if (!method || typeof method !== 'string') {
      throw new Error('Method name is required and must be a string');
    }

    const notification = {
      jsonrpc: this.version,
      method,
    };

    if (params !== null && params !== undefined) {
      notification.params = params;
    }

    return notification;
  }

  /**
   * Create a JSON-RPC success response
   * @param {*} result - Result data
   * @param {string|number} id - Request ID
   */
  createResponse(result, id) {
    if (id === null || id === undefined) {
      throw new Error('Response ID is required');
    }

    return {
      jsonrpc: this.version,
      result,
      id,
    };
  }

  /**
   * Create a JSON-RPC error response
   * @param {number} code - Error code
   * @param {string} message - Error message
   * @param {*} data - Additional error data (optional)
   * @param {string|number} id - Request ID
   */
  createError(code, message, data = null, id = null) {
    const error = {
      code,
      message,
    };

    if (data !== null && data !== undefined) {
      error.data = data;
    }

    return {
      jsonrpc: this.version,
      error,
      id,
    };
  }

  /**
   * Create a batch request
   * @param {Array} requests - Array of request objects
   */
  createBatch(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new Error('Batch must be a non-empty array');
    }

    return requests;
  }

  /**
   * Parse a JSON-RPC message
   * @param {string|Object} message - JSON string or object to parse
   */
  parse(message) {
    let parsed;

    try {
      if (typeof message === 'string') {
        parsed = JSON.parse(message);
      } else {
        parsed = message;
      }
    } catch (error) {
      return {
        type: 'error',
        error: this.createError(
          JsonRpcProtocol.ERROR_CODES.PARSE_ERROR,
          'Invalid JSON',
          error.message
        ),
      };
    }

    // Handle batch
    if (Array.isArray(parsed)) {
      return {
        type: 'batch',
        requests: parsed.map((req) => this.parseRequest(req)),
      };
    }

    return this.parseRequest(parsed);
  }

  /**
   * Parse a single request
   * @private
   */
  parseRequest(request) {
    // Validate JSON-RPC version
    if (request.jsonrpc !== this.version) {
      return {
        type: 'error',
        error: this.createError(
          JsonRpcProtocol.ERROR_CODES.INVALID_REQUEST,
          `Invalid JSON-RPC version: ${request.jsonrpc}`,
          null,
          request.id || null
        ),
      };
    }

    // Check if it's a response
    if ('result' in request || 'error' in request) {
      return this.parseResponse(request);
    }

    // It's a request or notification
    if (!request.method || typeof request.method !== 'string') {
      return {
        type: 'error',
        error: this.createError(
          JsonRpcProtocol.ERROR_CODES.INVALID_REQUEST,
          'Method is required and must be a string',
          null,
          request.id || null
        ),
      };
    }

    // Check if it's a notification (no ID)
    if (!('id' in request)) {
      return {
        type: 'notification',
        method: request.method,
        params: request.params || null,
      };
    }

    // It's a request
    return {
      type: 'request',
      id: request.id,
      method: request.method,
      params: request.params || null,
    };
  }

  /**
   * Parse a response
   * @private
   */
  parseResponse(response) {
    if (!('id' in response)) {
      return {
        type: 'error',
        error: this.createError(
          JsonRpcProtocol.ERROR_CODES.INVALID_REQUEST,
          'Response must have an ID'
        ),
      };
    }

    if ('error' in response) {
      return {
        type: 'error',
        id: response.id,
        error: response.error,
      };
    }

    if ('result' in response) {
      return {
        type: 'response',
        id: response.id,
        result: response.result,
      };
    }

    return {
      type: 'error',
      error: this.createError(
        JsonRpcProtocol.ERROR_CODES.INTERNAL_ERROR,
        'Invalid response format',
        null,
        response.id
      ),
    };
  }

  /**
   * Validate a JSON-RPC message
   * @param {Object} message - Message to validate
   */
  validate(message) {
    const parsed = this.parse(message);
    return parsed.type !== 'error';
  }

  /**
   * Serialize a message to JSON string
   * @param {Object} message - Message to serialize
   */
  serialize(message) {
    return JSON.stringify(message);
  }

  /**
   * Standard JSON-RPC error codes
   */
  static ERROR_CODES = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,
    // Custom error codes
    AGENT_NOT_FOUND: -32000,
    AGENT_BUSY: -32001,
    AGENT_ERROR: -32002,
    CAPABILITY_NOT_FOUND: -32003,
    TASK_FAILED: -32004,
  };

  /**
   * Get error message for error code
   * @param {number} code - Error code
   */
  static getErrorMessage(code) {
    const messages = {
      [JsonRpcProtocol.ERROR_CODES.PARSE_ERROR]: 'Parse error',
      [JsonRpcProtocol.ERROR_CODES.INVALID_REQUEST]: 'Invalid request',
      [JsonRpcProtocol.ERROR_CODES.METHOD_NOT_FOUND]: 'Method not found',
      [JsonRpcProtocol.ERROR_CODES.INVALID_PARAMS]: 'Invalid parameters',
      [JsonRpcProtocol.ERROR_CODES.INTERNAL_ERROR]: 'Internal error',
      [JsonRpcProtocol.ERROR_CODES.AGENT_NOT_FOUND]: 'Agent not found',
      [JsonRpcProtocol.ERROR_CODES.AGENT_BUSY]: 'Agent is busy',
      [JsonRpcProtocol.ERROR_CODES.AGENT_ERROR]: 'Agent error',
      [JsonRpcProtocol.ERROR_CODES.CAPABILITY_NOT_FOUND]: 'Capability not found',
      [JsonRpcProtocol.ERROR_CODES.TASK_FAILED]: 'Task execution failed',
    };

    return messages[code] || 'Unknown error';
  }
}

/**
 * Agent communication wrapper using JSON-RPC protocol
 */
export class AgentCommunicator {
  constructor(agentId) {
    this.agentId = agentId;
    this.protocol = new JsonRpcProtocol();
    this.pendingRequests = new Map();
  }

  /**
   * Send a request to another agent
   * @param {string} targetAgent - Target agent ID
   * @param {string} method - Method to call
   * @param {*} params - Method parameters
   */
  async request(targetAgent, method, params = null) {
    const request = this.protocol.createRequest(method, params);

    return new Promise((resolve, reject) => {
      // Store pending request
      this.pendingRequests.set(request.id, {
        resolve,
        reject,
        timeout: setTimeout(() => {
          this.pendingRequests.delete(request.id);
          reject(new Error(`Request timeout: ${method} to ${targetAgent}`));
        }, 30000), // 30 second timeout
      });

      // Send request
      this.send(targetAgent, request);
    });
  }

  /**
   * Send a notification to another agent
   * @param {string} targetAgent - Target agent ID
   * @param {string} method - Method to call
   * @param {*} params - Method parameters
   */
  notify(targetAgent, method, params = null) {
    const notification = this.protocol.createNotification(method, params);
    this.send(targetAgent, notification);
  }

  /**
   * Handle incoming message
   * @param {Object} message - Received message
   */
  async handleMessage(message) {
    const parsed = this.protocol.parse(message);

    switch (parsed.type) {
      case 'request':
        return await this.handleRequest(parsed);
      case 'notification':
        return await this.handleNotification(parsed);
      case 'response':
        return this.handleResponse(parsed);
      case 'error':
        return this.handleError(parsed);
      case 'batch':
        return await this.handleBatch(parsed);
      default:
        throw new Error(`Unknown message type: ${parsed.type}`);
    }
  }

  /**
   * Handle request message
   * @private
   */
  async handleRequest(request) {
    // This should be overridden by the agent implementation
    return this.protocol.createError(
      JsonRpcProtocol.ERROR_CODES.METHOD_NOT_FOUND,
      `Method ${request.method} not implemented`,
      null,
      request.id
    );
  }

  /**
   * Handle notification message
   * @private
   */
  async handleNotification(notification) {
    // This should be overridden by the agent implementation
    console.log(`Notification received: ${notification.method}`);
  }

  /**
   * Handle response message
   * @private
   */
  handleResponse(response) {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(response.id);
      pending.resolve(response.result);
    }
  }

  /**
   * Handle error message
   * @private
   */
  handleError(error) {
    if (error.id) {
      const pending = this.pendingRequests.get(error.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(error.id);
        pending.reject(new Error(error.error.message));
      }
    } else {
      console.error('Received error:', error.error);
    }
  }

  /**
   * Handle batch message
   * @private
   */
  async handleBatch(batch) {
    const responses = [];
    for (const request of batch.requests) {
      const response = await this.handleMessage(request);
      if (response) {
        responses.push(response);
      }
    }
    return responses.length > 0 ? responses : null;
  }

  /**
   * Send message (to be implemented by registry)
   * @private
   */
  send(_targetAgent, _message) {
    // This will be implemented by the registry
    throw new Error('Send method must be implemented');
  }
}
