import { EventEmitter } from 'events';

/**
 * Rate limiter for API calls with exponential backoff
 */
export class RateLimiter extends EventEmitter {
  constructor() {
    super();
    this.limits = new Map();
    this.buckets = new Map();
    this.circuit_breakers = new Map();
    this.concurrency_slots = new Map();
    this.request_queues = new Map();
    this.response_times = new Map();
    this.adaptive_configs = new Map();
    this.metrics = new Map();
  }

  /**
   * Configure rate limits for a service
   */
  configure(service, config) {
    this.limits.set(service, config);

    // Initialize metrics
    if (!this.metrics.has(service)) {
      this.metrics.set(service, {
        requests: 0,
        allowed: 0,
        blocked: 0,
      });
    }

    // Initialize token bucket if specified
    if (config.algorithm === 'token_bucket') {
      this.buckets.set(service, {
        tokens: config.bucket_size,
        last_refill: Date.now(),
        bucket_size: config.bucket_size,
        refill_rate: config.refill_rate,
      });
    }
  }

  /**
   * Check if request is within rate limit
   */
  async check_limit(service) {
    const config = this.limits.get(service);
    if (!config) {
      return { allowed: true };
    }

    const metrics = this.metrics.get(service);
    metrics.requests++;

    // Check circuit breaker first
    const circuit_state = this.get_circuit_state(service);
    if (circuit_state === 'open') {
      metrics.blocked++;
      return {
        allowed: false,
        reason: 'circuit open',
        retry_after: 10,
      };
    }

    // Token bucket algorithm
    if (config.algorithm === 'token_bucket') {
      const bucket = this.buckets.get(service);
      this.refill_bucket(service);

      if (bucket.tokens >= 1) {
        bucket.tokens--;
        metrics.allowed++;
        return { allowed: true, remaining: bucket.tokens };
      } else {
        metrics.blocked++;
        return {
          allowed: false,
          retry_after: Math.ceil(1000 / config.refill_rate),
        };
      }
    }

    // Window-based rate limiting
    const now = Date.now();
    const window_key = `${service}:window`;

    if (!this[window_key]) {
      this[window_key] = {
        requests: [],
      };
    }

    const window = this[window_key];

    // Clean old requests
    if (config.requests_per_second) {
      window.requests = window.requests.filter((t) => now - t < 1000);
    } else if (config.requests_per_minute) {
      window.requests = window.requests.filter((t) => now - t < 60000);
    } else if (config.requests_per_hour) {
      window.requests = window.requests.filter((t) => now - t < 3600000);
    }

    // Check limits
    if (
      config.requests_per_second &&
      window.requests.filter((t) => now - t < 1000).length >= config.requests_per_second
    ) {
      metrics.blocked++;
      return { allowed: false, retry_after: 1 };
    }

    if (
      config.requests_per_minute &&
      window.requests.filter((t) => now - t < 60000).length >= config.requests_per_minute
    ) {
      metrics.blocked++;
      return { allowed: false, retry_after: 60 };
    }

    if (
      config.requests_per_hour &&
      window.requests.filter((t) => now - t < 3600000).length >= config.requests_per_hour
    ) {
      metrics.blocked++;
      return { allowed: false, retry_after: 3600 };
    }

    // Request allowed
    window.requests.push(now);
    metrics.allowed++;

    // Check if approaching limit and emit event
    const usage = this.get_pressure(service);
    if (usage > 0.8) {
      this.emit('rate_limit_warning', { service, usage });
    }

    if (window.requests.length > config.requests_per_minute) {
      this.emit('rate_limit_exceeded', {
        service,
        limit: config.requests_per_minute,
      });
    }

    return { allowed: true };
  }

  /**
   * Consume tokens from bucket
   */
  async consume(service, tokens) {
    const config = this.limits.get(service);
    if (!config || config.algorithm !== 'token_bucket') {
      return { success: false, error: 'Not configured for token bucket' };
    }

    const bucket = this.buckets.get(service);
    this.refill_bucket(service);

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return {
        success: true,
        remaining: bucket.tokens,
      };
    }

    return {
      success: false,
      tokens_available: bucket.tokens,
      tokens_requested: tokens,
    };
  }

  /**
   * Refill token bucket
   */
  refill_bucket(service) {
    const config = this.limits.get(service);
    const bucket = this.buckets.get(service);

    if (!bucket || !config.refill_rate) {
      return;
    }

    const now = Date.now();
    const time_passed = (now - bucket.last_refill) / 1000;
    const tokens_to_add = time_passed * config.refill_rate;

    bucket.tokens = Math.min(bucket.bucket_size, bucket.tokens + tokens_to_add);
    bucket.last_refill = now;
  }

  /**
   * Create backoff handler
   */
  create_backoff_handler(options = {}) {
    const initial_delay = options.initial_delay || 1000;
    const max_delay = options.max_delay || 32000;
    const multiplier = options.multiplier || 2;
    const jitter = options.jitter || false;

    return {
      get_delay: (attempt) => {
        const delay = Math.min(initial_delay * Math.pow(multiplier, attempt), max_delay);
        return delay;
      },
      get_delay_with_jitter: (attempt) => {
        const base_delay = Math.min(initial_delay * Math.pow(multiplier, attempt), max_delay);
        if (jitter) {
          return base_delay * (0.5 + Math.random() * 0.5);
        }
        return base_delay;
      },
    };
  }

  /**
   * Execute function with exponential backoff
   */
  async execute_with_backoff(fn, options = {}) {
    const max_retries = options.max_retries || 3;
    const initial_delay = options.initial_delay || 100;
    let attempts = 0;

    while (attempts <= max_retries) {
      try {
        return await fn();
      } catch (error) {
        attempts++;
        if (attempts > max_retries) {
          throw error;
        }
        const delay = initial_delay * Math.pow(2, attempts - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Update rate limits from response headers
   */
  update_from_headers(platform, headers) {
    const normalized = {};

    // Normalize header names
    for (const [key, value] of Object.entries(headers)) {
      normalized[key.toLowerCase()] = value;
    }

    // GitHub headers
    if (normalized['x-ratelimit-limit']) {
      this.configure(platform, {
        requests_per_hour: parseInt(normalized['x-ratelimit-limit']),
      });
    }

    // GitLab headers
    if (normalized['ratelimit-limit']) {
      this.configure(platform, {
        requests_per_minute: parseInt(normalized['ratelimit-limit']),
      });
    }

    // Store remaining and reset info
    if (!this.rate_limit_status) {
      this.rate_limit_status = new Map();
    }

    this.rate_limit_status.set(platform, {
      limit: parseInt(normalized['x-ratelimit-limit'] || normalized['ratelimit-limit'] || '0'),
      remaining: parseInt(
        normalized['x-ratelimit-remaining'] || normalized['ratelimit-remaining'] || '0'
      ),
      reset: parseInt(normalized['x-ratelimit-reset'] || normalized['ratelimit-reset'] || '0'),
      retry_after: parseInt(normalized['retry-after'] || '0'),
    });

    // If retry-after is set, temporarily block
    if (normalized['retry-after']) {
      this.temporarily_block(platform, parseInt(normalized['retry-after']));
    }
  }

  /**
   * Get rate limit status
   */
  get_status(platform) {
    return (
      this.rate_limit_status?.get(platform) || {
        limit: 0,
        remaining: 0,
        reset: 0,
        retry_after: 0,
      }
    );
  }

  /**
   * Temporarily block a service
   */
  temporarily_block(service, seconds) {
    if (!this.blocked_until) {
      this.blocked_until = new Map();
    }
    this.blocked_until.set(service, Date.now() + seconds * 1000);
  }

  /**
   * Enable adaptive rate limiting
   */
  enable_adaptive_limiting(service, config) {
    this.adaptive_configs.set(service, {
      ...config,
      current_rate: config.max_rate,
    });
  }

  /**
   * Record response time for adaptive limiting
   */
  record_response_time(service, time) {
    if (!this.response_times.has(service)) {
      this.response_times.set(service, []);
    }

    const times = this.response_times.get(service);
    times.push(time);

    // Keep only last 100 times
    if (times.length > 100) {
      times.shift();
    }

    // Adjust rate based on response times
    const adaptive = this.adaptive_configs.get(service);
    if (adaptive) {
      const avg_time = times.reduce((a, b) => a + b, 0) / times.length;

      if (avg_time > adaptive.target_response_time) {
        // Slow down
        adaptive.current_rate = Math.max(adaptive.min_rate, adaptive.current_rate * 0.9);
      } else {
        // Speed up
        adaptive.current_rate = Math.min(adaptive.max_rate, adaptive.current_rate * 1.1);
      }
    }
  }

  /**
   * Get adaptive status
   */
  get_adaptive_status(service) {
    return this.adaptive_configs.get(service) || null;
  }

  /**
   * Get pressure (usage percentage)
   */
  get_pressure(service) {
    const window_key = `${service}:window`;
    const window = this[window_key];
    const config = this.limits.get(service);

    if (!window || !config) {
      return 0;
    }

    const now = Date.now();
    let current_usage = 0;
    let limit = 0;

    if (config.requests_per_minute) {
      current_usage = window.requests.filter((t) => now - t < 60000).length;
      limit = config.requests_per_minute;
    } else if (config.requests_per_hour) {
      current_usage = window.requests.filter((t) => now - t < 3600000).length;
      limit = config.requests_per_hour;
    }

    return limit > 0 ? current_usage / limit : 0;
  }

  /**
   * Configure circuit breaker
   */
  configure_circuit_breaker(service, config) {
    this.circuit_breakers.set(service, {
      state: 'closed',
      failures: 0,
      successes: 0,
      failure_threshold: config.failure_threshold,
      success_threshold: config.success_threshold || 2,
      timeout: config.timeout || 5000,
      reset_timeout: config.reset_timeout || 10000,
      last_failure: null,
      opened_at: null,
    });
  }

  /**
   * Get circuit breaker state
   */
  get_circuit_state(service) {
    const circuit = this.circuit_breakers.get(service);
    if (!circuit) {
      return 'closed';
    }

    // Check if circuit should transition to half-open
    if (circuit.state === 'open' && circuit.opened_at) {
      if (Date.now() - circuit.opened_at >= circuit.reset_timeout) {
        circuit.state = 'half-open';
        circuit.failures = 0;
        circuit.successes = 0;
      }
    }

    return circuit.state;
  }

  /**
   * Record circuit breaker failure
   */
  record_failure(service) {
    const circuit = this.circuit_breakers.get(service);
    if (!circuit) {
      return;
    }

    circuit.failures++;
    circuit.last_failure = Date.now();

    if (circuit.failures >= circuit.failure_threshold) {
      circuit.state = 'open';
      circuit.opened_at = Date.now();
    }
  }

  /**
   * Record circuit breaker success
   */
  record_success(service) {
    const circuit = this.circuit_breakers.get(service);
    if (!circuit) {
      return;
    }

    if (circuit.state === 'half-open') {
      circuit.successes++;
      if (circuit.successes >= circuit.success_threshold) {
        circuit.state = 'closed';
        circuit.failures = 0;
        circuit.successes = 0;
      }
    }
  }

  /**
   * Check circuit breaker
   */
  async check_circuit(service) {
    const state = this.get_circuit_state(service);
    if (state === 'open') {
      return {
        allowed: false,
        reason: 'circuit open',
      };
    }
    return { allowed: true };
  }

  /**
   * Configure concurrency limits
   */
  configure_concurrency(service, config) {
    this.concurrency_slots.set(service, {
      max_concurrent: config.max_concurrent,
      current: 0,
      queue: [],
      enable_queue: config.enable_queue || false,
      max_queue_size: config.max_queue_size || 100,
    });
  }

  /**
   * Acquire a concurrency slot
   */
  async acquire_slot(service) {
    const config = this.concurrency_slots.get(service);
    if (!config) {
      return { acquired: true, id: Math.random() };
    }

    if (config.current < config.max_concurrent) {
      config.current++;
      const id = Math.random();
      return { acquired: true, id };
    }

    return { acquired: false };
  }

  /**
   * Release a concurrency slot
   */
  release_slot(service, _id) {
    const config = this.concurrency_slots.get(service);
    if (!config) {
      return;
    }

    config.current = Math.max(0, config.current - 1);

    // Process queue if enabled
    if (config.enable_queue && config.queue.length > 0) {
      const queued = config.queue.shift();
      if (queued) {
        config.current++;
        queued.resolve({ acquired: true, id: Math.random() });
      }
    }
  }

  /**
   * Queue a request
   */
  queue_request(service) {
    const config = this.concurrency_slots.get(service);
    if (!config || !config.enable_queue) {
      return Promise.resolve({ acquired: false });
    }

    if (config.queue.length >= config.max_queue_size) {
      return Promise.resolve({ acquired: false, reason: 'queue full' });
    }

    return new Promise((resolve) => {
      config.queue.push({ resolve });
    });
  }

  /**
   * Get queue size
   */
  get_queue_size(service) {
    const config = this.concurrency_slots.get(service);
    return config?.queue?.length || 0;
  }

  /**
   * Get metrics for a service
   */
  get_metrics(service) {
    const metrics = this.metrics.get(service);
    if (!metrics) {
      return null;
    }

    const config = this.limits.get(service);
    const limit = config?.requests_per_minute || config?.requests_per_hour || 0;

    return {
      ...metrics,
      usage_percentage: limit > 0 ? (metrics.requests / limit) * 100 : 0,
    };
  }

  /**
   * Forecast when rate limit will be exhausted
   */
  forecast_exhaustion(service) {
    const window_key = `${service}:window`;
    const window = this[window_key];
    const config = this.limits.get(service);

    if (!window || !config) {
      return null;
    }

    const now = Date.now();
    let current_usage = 0;
    let limit = 0;
    let _window_ms = 0;

    if (config.requests_per_hour) {
      current_usage = window.requests.filter((t) => now - t < 3600000).length;
      limit = config.requests_per_hour;
      _window_ms = 3600000;
    } else if (config.requests_per_minute) {
      current_usage = window.requests.filter((t) => now - t < 60000).length;
      limit = config.requests_per_minute;
      _window_ms = 60000;
    }

    const remaining = limit - current_usage;
    if (remaining <= 0) {
      return {
        minutes_until_exhaustion: 0,
        requests_remaining: 0,
      };
    }

    // Calculate rate of requests
    const recent_requests = window.requests.slice(-10);
    if (recent_requests.length < 2) {
      return {
        minutes_until_exhaustion: Infinity,
        requests_remaining: remaining,
      };
    }

    const time_span = recent_requests[recent_requests.length - 1] - recent_requests[0];
    const rate = recent_requests.length / time_span; // requests per ms

    const ms_until_exhaustion = remaining / rate;
    return {
      minutes_until_exhaustion: ms_until_exhaustion / 60000,
      requests_remaining: remaining,
    };
  }

  /**
   * Generate rate limit report
   */
  generate_report() {
    const report = {
      services: {},
      timestamp: Date.now(),
    };

    for (const [service, metrics] of this.metrics) {
      const config = this.limits.get(service);
      const limit = config?.requests_per_minute || config?.requests_per_hour || 0;

      report.services[service] = {
        requests: metrics.requests,
        allowed: metrics.allowed,
        blocked: metrics.blocked,
        usage: limit > 0 ? (metrics.requests / limit) * 100 : 0,
      };
    }

    return report;
  }
}
