import express from 'express';
import crypto from 'crypto';

/**
 * Webhook receiver for platform integrations
 */
export class WebhookReceiver {
  constructor(options = {}) {
    this.port = options.port || 3000;
    this.event_bus = options.event_bus;
    this.app = express();
    this.server = null;
    this.platform_secrets = new Map();
    this.custom_handlers = new Map();
    this.middlewares = new Map();
    this.payload_schemas = new Map();
    this.ip_whitelists = new Map();
    this.deduplication_enabled = false;
    this.deduplication_cache = new Set();
    this.failed_webhooks = [];
    this.retry_enabled = false;
    this.retry_options = {};
    this.metrics = {
      total_requests: 0,
      by_platform: {},
      processing_times: {},
    };
    this.start_time = Date.now();

    this.setup_middleware();
    this.setup_routes();
  }

  /**
   * Setup Express middleware
   */
  setup_middleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  /**
   * Setup webhook routes
   */
  setup_routes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: Date.now() - this.start_time,
        processed: this.metrics.total_requests,
      });
    });

    // Generic webhook handler
    this.app.post('/webhooks/:platform', async (req, res) => {
      const platform = req.params.platform;
      this.metrics.total_requests++;
      this.metrics.by_platform[platform] = (this.metrics.by_platform[platform] || 0) + 1;

      const start_time = Date.now();

      try {
        // Apply platform-specific middleware
        const middleware = this.middlewares.get(platform);
        if (middleware) {
          await new Promise((resolve, reject) => {
            middleware(req, res, (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          });
        }

        // Validate webhook signature/token
        if (!this.validate_webhook(platform, req)) {
          return res.status(401).json({ error: 'Invalid webhook signature or token' });
        }

        // Validate IP if whitelist is configured
        if (!this.validate_ip(platform, req)) {
          return res.status(403).json({ error: 'IP not whitelisted' });
        }

        // Validate payload schema if configured
        if (!this.validate_payload(platform, req.body)) {
          return res.status(400).json({ error: 'Invalid payload validation' });
        }

        // Check for duplicate events
        if (this.deduplication_enabled && this.is_duplicate(req)) {
          return res.status(200).json({ status: 'duplicate' });
        }

        // Process webhook
        await this.process_webhook(platform, req, res);

        // Record processing time
        const duration = Date.now() - start_time;
        if (!this.metrics.processing_times[platform]) {
          this.metrics.processing_times[platform] = { total: 0, count: 0, avg: 0 };
        }
        this.metrics.processing_times[platform].total += duration;
        this.metrics.processing_times[platform].count++;
        this.metrics.processing_times[platform].avg =
          this.metrics.processing_times[platform].total /
          this.metrics.processing_times[platform].count;
      } catch (error) {
        console.error('Webhook processing error:', { platform, error });

        if (this.retry_enabled && this.retry_options.store_failures) {
          this.failed_webhooks.push({
            platform,
            payload: req.body,
            headers: req.headers,
            timestamp: Date.now(),
            error: error.message,
          });
        }

        res.status(500).json({ error: 'Processing failed' });
      }
    });
  }

  /**
   * Process a webhook
   */
  async process_webhook(platform, req, res) {
    // Check for custom handler
    const custom_handler = this.custom_handlers.get(platform);
    if (custom_handler) {
      const result = await custom_handler(req);
      return res.status(200).json(result || { status: 'processed' });
    }

    // Platform-specific processing
    let event_data;
    switch (platform) {
      case 'github':
        event_data = await this.process_github_webhook(req);
        break;
      case 'gitlab':
        event_data = await this.process_gitlab_webhook(req);
        break;
      case 'jira':
        event_data = await this.process_jira_webhook(req);
        break;
      case 'slack':
        event_data = await this.process_slack_webhook(req, res);
        if (event_data === null) {
          return;
        } // Already handled
        break;
      default:
        event_data = await this.process_generic_webhook(req);
    }

    // Emit event to event bus
    if (this.event_bus && event_data) {
      await this.emit_with_retry(event_data.event_name, event_data.payload);
      res.status(200).json({ status: 'processed' });
    } else {
      res.status(200).json({ status: 'processed' });
    }
  }

  /**
   * Emit event with retry logic
   */
  async emit_with_retry(event_name, payload) {
    if (!this.retry_enabled) {
      return await this.event_bus.emit_async(event_name, payload);
    }

    const max_attempts = this.retry_options.max_attempts || 3;
    let attempts = 0;

    while (attempts < max_attempts) {
      try {
        return await this.event_bus.emit_async(event_name, payload);
      } catch (error) {
        attempts++;
        if (attempts >= max_attempts) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempts) * 1000));
      }
    }
  }

  /**
   * Process GitHub webhook
   */
  async process_github_webhook(req) {
    const event_type = req.headers['x-github-event'];
    const payload = req.body;

    let action = payload.action;
    if (event_type === 'pull_request' && payload.pull_request?.merged) {
      action = 'merged';
    }

    const event_name = `github:${event_type}:${action || 'triggered'}`;

    return {
      event_name,
      payload: {
        platform: 'github',
        event: event_type,
        action,
        payload,
      },
    };
  }

  /**
   * Process GitLab webhook
   */
  async process_gitlab_webhook(req) {
    const payload = req.body;
    const object_kind = payload.object_kind;
    const action = payload.object_attributes?.action || 'triggered';

    const event_name = `gitlab:${object_kind}:${action}`;

    return {
      event_name,
      payload: {
        platform: 'gitlab',
        event: object_kind,
        action,
        payload,
      },
    };
  }

  /**
   * Process Jira webhook
   */
  async process_jira_webhook(req) {
    const payload = req.body;
    const event_type = payload.webhookEvent?.replace('jira:', '');

    return {
      event_name: payload.webhookEvent || 'jira:event',
      payload: {
        platform: 'jira',
        event: event_type,
        payload,
      },
    };
  }

  /**
   * Process Slack webhook
   */
  async process_slack_webhook(req, res) {
    const payload = req.body;

    // Handle URL verification
    if (payload.type === 'url_verification') {
      res.send(payload.challenge);
      return null;
    }

    // Handle event callbacks
    if (payload.type === 'event_callback') {
      const event = payload.event;
      return {
        event_name: `slack:${event.type}`,
        payload: {
          platform: 'slack',
          event: event.type,
          payload: event,
        },
      };
    }

    return {
      event_name: 'slack:event',
      payload: {
        platform: 'slack',
        event: 'unknown',
        payload,
      },
    };
  }

  /**
   * Process generic webhook
   */
  async process_generic_webhook(req) {
    const payload = req.body;

    // Handle batch events
    if (payload.events && Array.isArray(payload.events)) {
      for (const event of payload.events) {
        await this.event_bus.emit_async(`custom:${event.type}`, event.data);
      }
      return null;
    }

    return {
      event_name: 'generic:webhook',
      payload: {
        platform: 'generic',
        event: 'webhook',
        payload,
      },
    };
  }

  /**
   * Validate webhook signature/token
   */
  validate_webhook(platform, req) {
    const secret = this.platform_secrets.get(platform);
    if (!secret) {
      return true; // No secret configured, allow
    }

    switch (platform) {
      case 'github':
        return this.validate_github_signature(req, secret);
      case 'gitlab':
        return this.validate_gitlab_token(req, secret);
      case 'slack':
        return this.validate_slack_signature(req, secret);
      default:
        return true;
    }
  }

  /**
   * Validate GitHub webhook signature
   */
  validate_github_signature(req, secret) {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
      return false;
    }

    const expected = this.generate_github_signature(JSON.stringify(req.body), secret);

    return signature === expected;
  }

  /**
   * Generate GitHub signature
   */
  generate_github_signature(payload, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Validate GitLab token
   */
  validate_gitlab_token(req, secret) {
    const token = req.headers['x-gitlab-token'];
    return token === secret;
  }

  /**
   * Validate Slack signature
   */
  validate_slack_signature(req, secret) {
    const timestamp = req.headers['x-slack-request-timestamp'];
    const signature = req.headers['x-slack-signature'];

    if (!timestamp || !signature) {
      return false;
    }

    // Prevent replay attacks
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      return false;
    }

    const expected = this.generate_slack_signature(JSON.stringify(req.body), secret, timestamp);

    return signature === expected;
  }

  /**
   * Generate Slack signature
   */
  generate_slack_signature(payload, secret, timestamp) {
    const base_string = `v0:${timestamp}:${payload}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(base_string);
    return `v0=${hmac.digest('hex')}`;
  }

  /**
   * Validate IP address
   */
  validate_ip(platform, req) {
    const whitelist = this.ip_whitelists.get(platform);
    if (!whitelist || whitelist.length === 0) {
      return true;
    }

    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    // Simplified IP validation for testing
    return !whitelist || whitelist.some((range) => ip?.includes(range.split('/')[0]));
  }

  /**
   * Validate payload against schema
   */
  validate_payload(platform, payload) {
    const schema = this.payload_schemas.get(platform);
    if (!schema) {
      return true;
    }

    // Simple schema validation
    if (schema.required) {
      for (const field of schema.required) {
        if (!payload[field]) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check for duplicate events
   */
  is_duplicate(req) {
    const event_id = req.headers['x-event-id'];
    if (!event_id) {
      return false;
    }

    if (this.deduplication_cache.has(event_id)) {
      return true;
    }

    this.deduplication_cache.add(event_id);
    // Clean up old entries periodically
    if (this.deduplication_cache.size > 1000) {
      this.deduplication_cache.clear();
    }

    return false;
  }

  /**
   * Queue a webhook for later processing
   */
  queue_webhook(event_data) {
    // Implementation would store in a persistent queue
    this.webhook_queue = this.webhook_queue || [];
    this.webhook_queue.push(event_data);
  }

  /**
   * Get queue size
   */
  get_queue_size() {
    return (this.webhook_queue || []).length;
  }

  /**
   * Set platform secret
   */
  set_platform_secret(platform, secret) {
    this.platform_secrets.set(platform, secret);
  }

  /**
   * Set IP whitelist
   */
  set_ip_whitelist(platform, ips) {
    this.ip_whitelists.set(platform, ips);
  }

  /**
   * Set payload schema
   */
  set_payload_schema(platform, schema) {
    this.payload_schemas.set(platform, schema);
  }

  /**
   * Register custom handler
   */
  register_handler(platform, handler) {
    this.custom_handlers.set(platform, handler);
  }

  /**
   * Use middleware for a platform
   */
  use_middleware(platform, middleware) {
    this.middlewares.set(platform, middleware);
  }

  /**
   * Enable deduplication
   */
  enable_deduplication(enabled) {
    this.deduplication_enabled = enabled;
  }

  /**
   * Enable retry
   */
  enable_retry(enabled, options = {}) {
    this.retry_enabled = enabled;
    this.retry_options = options;
  }

  /**
   * Get failed webhooks
   */
  get_failed_webhooks() {
    return [...this.failed_webhooks];
  }

  /**
   * Reprocess failed webhooks
   */
  async reprocess_failed_webhooks() {
    const failed = [...this.failed_webhooks];
    this.failed_webhooks = [];

    let processed = 0;
    let failed_again = 0;

    for (const webhook of failed) {
      try {
        await this.event_bus.emit_async(`${webhook.platform}:reprocessed`, webhook.payload);
        processed++;
      } catch (error) {
        failed_again++;
        this.failed_webhooks.push(webhook);
      }
    }

    return { processed, failed: failed_again };
  }

  /**
   * Get metrics
   */
  get_metrics() {
    return { ...this.metrics };
  }

  /**
   * Get Express app
   */
  get_app() {
    return this.app;
  }

  /**
   * Start the webhook server
   */
  async start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Webhook receiver listening on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the webhook server
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
