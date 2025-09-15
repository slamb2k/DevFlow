import { jest } from '@jest/globals';
import request from 'supertest';
import { WebhookReceiver } from '../../src/integrations/webhook-receiver.js';
import { EventBus } from '../../src/integrations/event-bus.js';
import crypto from 'crypto';

describe('WebhookReceiver', () => {
  let webhook_receiver;
  let mock_event_bus;
  let app;

  beforeEach(() => {
    mock_event_bus = {
      emit: jest.fn(),
      emit_async: jest.fn().mockResolvedValue(true),
    };

    webhook_receiver = new WebhookReceiver({
      port: 0, // Use random port for testing
      event_bus: mock_event_bus,
    });

    app = webhook_receiver.get_app();
  });

  afterEach(async () => {
    await webhook_receiver.stop();
    jest.clearAllMocks();
  });

  describe('Webhook Endpoints', () => {
    it('should handle GitHub webhooks', async () => {
      const github_payload = {
        action: 'opened',
        pull_request: {
          id: 123,
          title: 'Test PR',
        },
      };

      const signature = webhook_receiver.generate_github_signature(
        JSON.stringify(github_payload),
        'test-secret'
      );

      webhook_receiver.set_platform_secret('github', 'test-secret');

      const response = await request(app)
        .post('/webhooks/github')
        .set('X-GitHub-Event', 'pull_request')
        .set('X-Hub-Signature-256', signature)
        .send(github_payload);

      expect(response.status).toBe(200);
      expect(mock_event_bus.emit_async).toHaveBeenCalledWith(
        'github:pull_request:opened',
        expect.objectContaining({
          platform: 'github',
          event: 'pull_request',
          action: 'opened',
          payload: github_payload,
        })
      );
    });

    it('should handle GitLab webhooks', async () => {
      const gitlab_payload = {
        object_kind: 'merge_request',
        object_attributes: {
          id: 456,
          title: 'Test MR',
          action: 'open',
        },
      };

      webhook_receiver.set_platform_secret('gitlab', 'gitlab-secret');

      const response = await request(app)
        .post('/webhooks/gitlab')
        .set('X-GitLab-Token', 'gitlab-secret')
        .set('X-GitLab-Event', 'Merge Request Hook')
        .send(gitlab_payload);

      expect(response.status).toBe(200);
      expect(mock_event_bus.emit_async).toHaveBeenCalledWith(
        'gitlab:merge_request:open',
        expect.objectContaining({
          platform: 'gitlab',
          event: 'merge_request',
          action: 'open',
          payload: gitlab_payload,
        })
      );
    });

    it('should handle Jira webhooks', async () => {
      const jira_payload = {
        webhookEvent: 'jira:issue_created',
        issue: {
          id: '10000',
          key: 'TEST-1',
          fields: {
            summary: 'Test Issue',
          },
        },
      };

      const response = await request(app).post('/webhooks/jira').send(jira_payload);

      expect(response.status).toBe(200);
      expect(mock_event_bus.emit_async).toHaveBeenCalledWith(
        'jira:issue_created',
        expect.objectContaining({
          platform: 'jira',
          event: 'issue_created',
          payload: jira_payload,
        })
      );
    });

    it('should handle Slack events', async () => {
      const slack_payload = {
        type: 'event_callback',
        event: {
          type: 'message',
          channel: 'C123456',
          text: 'Test message',
        },
      };

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = webhook_receiver.generate_slack_signature(
        JSON.stringify(slack_payload),
        'slack-signing-secret',
        timestamp
      );

      webhook_receiver.set_platform_secret('slack', 'slack-signing-secret');

      const response = await request(app)
        .post('/webhooks/slack')
        .set('X-Slack-Request-Timestamp', timestamp)
        .set('X-Slack-Signature', signature)
        .send(slack_payload);

      expect(response.status).toBe(200);
      expect(mock_event_bus.emit_async).toHaveBeenCalledWith(
        'slack:message',
        expect.objectContaining({
          platform: 'slack',
          event: 'message',
          payload: slack_payload.event,
        })
      );
    });

    it('should handle Slack URL verification', async () => {
      const verification_payload = {
        type: 'url_verification',
        challenge: 'test-challenge-string',
      };

      const response = await request(app).post('/webhooks/slack').send(verification_payload);

      expect(response.status).toBe(200);
      expect(response.text).toBe('test-challenge-string');
    });
  });

  describe('Security', () => {
    it('should reject unsigned GitHub webhooks', async () => {
      webhook_receiver.set_platform_secret('github', 'secret');

      const response = await request(app)
        .post('/webhooks/github')
        .set('X-GitHub-Event', 'push')
        .send({ ref: 'refs/heads/main' });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('signature');
    });

    it('should reject invalid GitLab tokens', async () => {
      webhook_receiver.set_platform_secret('gitlab', 'correct-token');

      const response = await request(app)
        .post('/webhooks/gitlab')
        .set('X-GitLab-Token', 'wrong-token')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('token');
    });

    it('should validate Slack request signatures', async () => {
      webhook_receiver.set_platform_secret('slack', 'signing-secret');

      const response = await request(app)
        .post('/webhooks/slack')
        .set('X-Slack-Request-Timestamp', Date.now().toString())
        .set('X-Slack-Signature', 'invalid-signature')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('signature');
    });

    it('should reject old Slack requests to prevent replay attacks', async () => {
      const old_timestamp = (Date.now() / 1000 - 301).toString(); // 5+ minutes old
      const payload = { type: 'event_callback' };
      const signature = webhook_receiver.generate_slack_signature(
        JSON.stringify(payload),
        'signing-secret',
        old_timestamp
      );

      webhook_receiver.set_platform_secret('slack', 'signing-secret');

      const response = await request(app)
        .post('/webhooks/slack')
        .set('X-Slack-Request-Timestamp', old_timestamp)
        .set('X-Slack-Signature', signature)
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('timestamp');
    });

    it('should validate webhook IP addresses when configured', async () => {
      webhook_receiver.set_ip_whitelist('github', ['192.168.1.0/24']);

      const response = await request(app)
        .post('/webhooks/github')
        .set('X-Forwarded-For', '10.0.0.1')
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('IP');
    });
  });

  describe('Event Processing', () => {
    it('should transform platform-specific events to common format', async () => {
      const github_payload = {
        action: 'closed',
        pull_request: {
          merged: true,
          id: 789,
        },
      };

      webhook_receiver.set_platform_secret('github', 'secret');
      const signature = webhook_receiver.generate_github_signature(
        JSON.stringify(github_payload),
        'secret'
      );

      await request(app)
        .post('/webhooks/github')
        .set('X-GitHub-Event', 'pull_request')
        .set('X-Hub-Signature-256', signature)
        .send(github_payload);

      expect(mock_event_bus.emit_async).toHaveBeenCalledWith(
        'github:pull_request:merged',
        expect.objectContaining({
          platform: 'github',
          event: 'pull_request',
          action: 'merged',
        })
      );
    });

    it('should handle webhook batching', async () => {
      const batch_payload = {
        events: [
          { type: 'issue_created', data: { id: 1 } },
          { type: 'issue_updated', data: { id: 2 } },
          { type: 'issue_closed', data: { id: 3 } },
        ],
      };

      await request(app).post('/webhooks/custom').send(batch_payload);

      expect(mock_event_bus.emit_async).toHaveBeenCalledTimes(3);
    });

    it('should deduplicate webhook events', async () => {
      const duplicate_payload = {
        id: 'event-123',
        action: 'created',
      };

      webhook_receiver.enable_deduplication(true);

      await request(app)
        .post('/webhooks/generic')
        .set('X-Event-ID', 'event-123')
        .send(duplicate_payload);

      await request(app)
        .post('/webhooks/generic')
        .set('X-Event-ID', 'event-123')
        .send(duplicate_payload);

      expect(mock_event_bus.emit_async).toHaveBeenCalledTimes(1);
    });

    it('should queue events when event bus is unavailable', async () => {
      mock_event_bus.emit_async.mockRejectedValueOnce(new Error('Bus unavailable'));

      const response = await request(app).post('/webhooks/generic').send({ test: true });

      expect(response.status).toBe(202); // Accepted but not processed
      expect(webhook_receiver.get_queue_size()).toBeGreaterThan(0);
    });
  });

  describe('Webhook Registration', () => {
    it('should register custom webhook handlers', async () => {
      const custom_handler = jest.fn().mockResolvedValue({
        processed: true,
      });

      webhook_receiver.register_handler('custom-platform', custom_handler);

      const response = await request(app)
        .post('/webhooks/custom-platform')
        .send({ custom: 'data' });

      expect(custom_handler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { custom: 'data' },
        })
      );
      expect(response.status).toBe(200);
    });

    it('should support middleware for webhook processing', async () => {
      const middleware = jest.fn().mockImplementation((req, res, next) => {
        req.webhook_metadata = { processed_by: 'middleware' };
        next();
      });

      webhook_receiver.use_middleware('github', middleware);

      await request(app).post('/webhooks/github').send({});

      expect(middleware).toHaveBeenCalled();
    });

    it('should validate webhook payloads against schemas', async () => {
      const schema = {
        type: 'object',
        required: ['action', 'repository'],
        properties: {
          action: { type: 'string' },
          repository: { type: 'object' },
        },
      };

      webhook_receiver.set_payload_schema('github', schema);

      const invalid_response = await request(app)
        .post('/webhooks/github')
        .send({ action: 'opened' }); // Missing repository

      expect(invalid_response.status).toBe(400);
      expect(invalid_response.body.error).toContain('validation');
    });
  });

  describe('Monitoring and Metrics', () => {
    it('should track webhook metrics', async () => {
      await request(app).post('/webhooks/github').send({});
      await request(app).post('/webhooks/gitlab').send({});
      await request(app).post('/webhooks/github').send({});

      const metrics = webhook_receiver.get_metrics();

      expect(metrics.total_requests).toBe(3);
      expect(metrics.by_platform.github).toBe(2);
      expect(metrics.by_platform.gitlab).toBe(1);
    });

    it('should track processing time', async () => {
      const slow_handler = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { processed: true };
      });

      webhook_receiver.register_handler('slow', slow_handler);

      await request(app).post('/webhooks/slow').send({});

      const metrics = webhook_receiver.get_metrics();
      expect(metrics.processing_times.slow.avg).toBeGreaterThan(90);
    });

    it('should expose health check endpoint', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        uptime: expect.any(Number),
        processed: expect.any(Number),
      });
    });

    it('should log webhook errors', async () => {
      const console_spy = jest.spyOn(console, 'error').mockImplementation();

      const error_handler = jest.fn().mockRejectedValue(new Error('Processing failed'));
      webhook_receiver.register_handler('error', error_handler);

      await request(app).post('/webhooks/error').send({});

      expect(console_spy).toHaveBeenCalledWith(
        expect.stringContaining('Webhook processing error'),
        expect.objectContaining({
          platform: 'error',
          error: expect.any(Error),
        })
      );

      console_spy.mockRestore();
    });
  });

  describe('Retry and Recovery', () => {
    it('should retry failed webhook processing', async () => {
      mock_event_bus.emit_async
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(true);

      webhook_receiver.enable_retry(true, { max_attempts: 3 });

      const response = await request(app).post('/webhooks/generic').send({ retry: true });

      expect(response.status).toBe(200);
      expect(mock_event_bus.emit_async).toHaveBeenCalledTimes(2);
    });

    it('should store failed webhooks for reprocessing', async () => {
      mock_event_bus.emit_async.mockRejectedValue(new Error('Persistent failure'));

      webhook_receiver.enable_retry(true, {
        max_attempts: 1,
        store_failures: true,
      });

      await request(app).post('/webhooks/generic').send({ failed: true });

      const failed_webhooks = webhook_receiver.get_failed_webhooks();
      expect(failed_webhooks).toHaveLength(1);
      expect(failed_webhooks[0].payload).toEqual({ failed: true });
    });

    it('should reprocess failed webhooks on demand', async () => {
      mock_event_bus.emit_async
        .mockRejectedValueOnce(new Error('Initial failure'))
        .mockResolvedValueOnce(true);

      webhook_receiver.enable_retry(true, { store_failures: true });

      await request(app).post('/webhooks/generic').send({ reprocess: true });

      const result = await webhook_receiver.reprocess_failed_webhooks();

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
      expect(mock_event_bus.emit_async).toHaveBeenCalledTimes(2);
    });
  });
});
