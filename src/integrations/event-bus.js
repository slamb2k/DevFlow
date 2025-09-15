import { EventEmitter } from 'events';

/**
 * Event bus for cross-platform event routing and communication
 */
export class EventBus extends EventEmitter {
  constructor() {
    super();
    this.routes = new Map();
    this.middleware = [];
    this.queue = [];
    this.is_paused = false;
    this.max_queue_size = 1000;
    this.priority_levels = {
      high: 100,
      medium: 50,
      low: 0,
    };
    this.history = [];
    this.history_enabled = false;
    this.history_max_size = 100;
    this.metrics_enabled = false;
    this.metrics = {};
    this.circuit_states = new Map();
  }

  /**
   * Emit an event synchronously
   */
  emit(event, data) {
    if (this.is_paused) {
      this.queue_event(event, data);
      return true;
    }

    // Record metrics
    if (this.metrics_enabled) {
      this.record_metric(event, 'emit');
    }

    // Record history
    if (this.history_enabled) {
      this.add_to_history(event, data);
    }

    // Apply middleware
    const processed_event = this.apply_middleware({ event, data });
    if (!processed_event) {
      return false;
    }

    // Handle wildcard listeners
    const wildcard_listeners = this.listeners('*');
    for (const listener of wildcard_listeners) {
      try {
        listener(event, processed_event.data);
      } catch (error) {
        this.handle_listener_error(error, event);
      }
    }

    // Handle namespace pattern listeners
    const namespace_listeners = this.get_namespace_listeners(event);
    for (const listener of namespace_listeners) {
      try {
        listener(event, processed_event.data);
      } catch (error) {
        this.handle_listener_error(error, event);
      }
    }

    // Regular event emission
    try {
      return super.emit(event, processed_event.data);
    } catch (error) {
      this.handle_listener_error(error, event);
      return false;
    }
  }

  /**
   * Emit an event asynchronously
   */
  async emit_async(event, data) {
    if (this.is_paused) {
      this.queue_event(event, data);
      return true;
    }

    const start_time = Date.now();

    // Record metrics
    if (this.metrics_enabled) {
      this.record_metric(event, 'emit_async');
    }

    // Record history
    if (this.history_enabled) {
      this.add_to_history(event, data);
    }

    // Apply middleware
    const processed_event = this.apply_middleware({ event, data });
    if (!processed_event) {
      return false;
    }

    const listeners = [
      ...this.listeners(event),
      ...this.listeners('*').map((l) => (d) => l(event, d)),
      ...this.get_namespace_listeners(event).map((l) => (d) => l(event, d)),
    ];

    const promises = listeners.map((listener) =>
      Promise.resolve()
        .then(() => listener(processed_event.data))
        .catch((error) => {
          this.handle_listener_error(error, event);
        })
    );

    await Promise.all(promises);

    // Record execution time
    if (this.metrics_enabled) {
      const duration = Date.now() - start_time;
      this.record_execution_time(event, duration);
    }

    return true;
  }

  /**
   * Subscribe to events with namespace patterns
   */
  on(event, handler) {
    if (event.includes(':*')) {
      // Store namespace pattern listeners separately
      const pattern = event.replace(':*', '');
      if (!this.namespace_patterns) {
        this.namespace_patterns = new Map();
      }
      if (!this.namespace_patterns.has(pattern)) {
        this.namespace_patterns.set(pattern, []);
      }
      this.namespace_patterns.get(pattern).push(handler);
      return this;
    }

    return super.on(event, handler);
  }

  /**
   * Get listeners for namespace patterns
   */
  get_namespace_listeners(event) {
    if (!this.namespace_patterns) {
      return [];
    }

    const listeners = [];
    for (const [pattern, handlers] of this.namespace_patterns) {
      if (event.startsWith(`${pattern}:`)) {
        listeners.push(...handlers);
      }
    }
    return listeners;
  }

  /**
   * Add a route between events
   */
  add_route(source_event, target_event, handler, options = {}) {
    if (!this.routes.has(source_event)) {
      this.routes.set(source_event, []);
    }

    this.routes.get(source_event).push({
      target: target_event,
      handler,
      transformer: options.transformer,
      filter: options.filter,
    });

    // Subscribe to source event
    this.on(source_event, async (data) => {
      await this.execute_route(source_event, data);
    });
  }

  /**
   * Execute routes for an event
   */
  async execute_route(source_event, data) {
    const routes = this.routes.get(source_event);
    if (!routes) {
      return;
    }

    for (const route of routes) {
      // Apply filter if present
      if (route.filter && !route.filter(data)) {
        continue;
      }

      // Apply transformer if present
      let transformed_data = data;
      if (route.transformer) {
        transformed_data = route.transformer(data);
      }

      // Execute handler
      await route.handler(transformed_data);
    }
  }

  /**
   * Route an event (convenience method)
   */
  async route_event(source_event, data) {
    await this.execute_route(source_event, data);
    return { routed: true };
  }

  /**
   * Add middleware
   */
  use(middleware) {
    this.middleware.push(middleware);
  }

  /**
   * Apply middleware chain
   */
  apply_middleware(event) {
    let current = event;

    for (const middleware of this.middleware) {
      let next_called = false;
      const next = (modified_event) => {
        next_called = true;
        current = modified_event || current;
      };

      middleware(current, next);

      if (!next_called) {
        return null; // Middleware stopped propagation
      }
    }

    return current;
  }

  /**
   * Pause event processing
   */
  pause() {
    this.is_paused = true;
  }

  /**
   * Resume event processing
   */
  resume() {
    this.is_paused = false;
    this.process_queue();
  }

  /**
   * Queue an event
   */
  queue_event(event, data) {
    if (this.queue.length >= this.max_queue_size) {
      throw new Error('Event queue is full');
    }

    const priority = data?.priority || 'low';
    const priority_value = this.priority_levels[priority] || 0;

    this.queue.push({
      event,
      data,
      priority: priority_value,
      timestamp: Date.now(),
    });

    // Sort by priority
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Process queued events
   */
  process_queue() {
    while (this.queue.length > 0 && !this.is_paused) {
      const item = this.queue.shift();
      this.emit(item.event, item.data);
    }
  }

  /**
   * Clear the event queue
   */
  clear_queue() {
    this.queue = [];
  }

  /**
   * Set maximum queue size
   */
  set_max_queue_size(size) {
    this.max_queue_size = size;
  }

  /**
   * Set priority levels
   */
  set_priority_levels(levels) {
    this.priority_levels = levels;
  }

  /**
   * Enable event history
   */
  enable_history(enabled, options = {}) {
    this.history_enabled = enabled;
    if (options.max_size) {
      this.history_max_size = options.max_size;
    }
  }

  /**
   * Add event to history
   */
  add_to_history(event, data) {
    this.history.push({
      event,
      data,
      timestamp: Date.now(),
    });

    // Trim history if needed
    if (this.history.length > this.history_max_size) {
      this.history = this.history.slice(-this.history_max_size);
    }
  }

  /**
   * Get event history
   */
  get_history() {
    return [...this.history];
  }

  /**
   * Replay event history
   */
  replay_history(options = {}) {
    const events_to_replay = options.filter ? this.history.filter(options.filter) : this.history;

    for (const item of events_to_replay) {
      this.emit(item.event, item.data);
    }
  }

  /**
   * Enable metrics collection
   */
  enable_metrics(enabled) {
    this.metrics_enabled = enabled;
    if (enabled && !this.metrics) {
      this.metrics = {};
    }
  }

  /**
   * Record a metric
   */
  record_metric(event, _type) {
    if (!this.metrics[event]) {
      this.metrics[event] = {
        count: 0,
        errors: 0,
        total_time: 0,
        avg_time: 0,
        error_rate: 0,
      };
    }

    this.metrics[event].count++;
  }

  /**
   * Record execution time
   */
  record_execution_time(event, duration) {
    if (!this.metrics[event]) {
      return;
    }

    this.metrics[event].total_time += duration;
    this.metrics[event].avg_time = this.metrics[event].total_time / this.metrics[event].count;
  }

  /**
   * Get metrics
   */
  get_metrics() {
    return { ...this.metrics };
  }

  /**
   * Handle listener errors
   */
  handle_listener_error(error, event) {
    console.error('Error in event handler:', error);

    // Record error metric
    if (this.metrics_enabled && this.metrics[event]) {
      this.metrics[event].errors++;
      this.metrics[event].error_rate = this.metrics[event].errors / this.metrics[event].count;
    }

    // Emit error event
    this.emit('error', { error, event });
  }

  /**
   * Remove all listeners for an event
   */
  remove_all_listeners(event) {
    this.removeAllListeners(event);

    // Also remove namespace pattern listeners
    if (this.namespace_patterns) {
      for (const [pattern, _handlers] of this.namespace_patterns) {
        if (event.startsWith(pattern)) {
          this.namespace_patterns.delete(pattern);
        }
      }
    }
  }
}
