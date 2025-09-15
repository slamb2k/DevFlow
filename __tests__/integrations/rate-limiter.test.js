import { jest } from '@jest/globals';
import { RateLimiter } from '../../src/integrations/rate-limiter.js';

describe('RateLimiter', () => {
  let rate_limiter;

  beforeEach(() => {
    rate_limiter = new RateLimiter();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      rate_limiter.configure('github', {
        requests_per_hour: 5000,
        requests_per_minute: 100,
      });

      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(await rate_limiter.check_limit('github'));
      }

      expect(results.every((r) => r.allowed)).toBe(true);
    });

    it('should block requests exceeding rate limit', async () => {
      rate_limiter.configure('api', {
        requests_per_minute: 2,
      });

      const result1 = await rate_limiter.check_limit('api');
      const result2 = await rate_limiter.check_limit('api');
      const result3 = await rate_limiter.check_limit('api');

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result3.allowed).toBe(false);
      expect(result3.retry_after).toBeGreaterThan(0);
    });

    it('should reset limits after time window', async () => {
      rate_limiter.configure('service', {
        requests_per_minute: 1,
      });

      await rate_limiter.check_limit('service');
      let result = await rate_limiter.check_limit('service');
      expect(result.allowed).toBe(false);

      jest.advanceTimersByTime(60000); // Advance 1 minute

      result = await rate_limiter.check_limit('service');
      expect(result.allowed).toBe(true);
    });

    it('should track multiple rate limit windows', async () => {
      rate_limiter.configure('complex', {
        requests_per_second: 2,
        requests_per_minute: 10,
        requests_per_hour: 100,
      });

      // Use 2 requests per second
      await rate_limiter.check_limit('complex');
      await rate_limiter.check_limit('complex');

      // Third request in same second should fail
      let result = await rate_limiter.check_limit('complex');
      expect(result.allowed).toBe(false);

      // After 1 second, should allow again
      jest.advanceTimersByTime(1000);
      result = await rate_limiter.check_limit('complex');
      expect(result.allowed).toBe(true);
    });
  });

  describe('Token Bucket Algorithm', () => {
    it('should implement token bucket with refill', async () => {
      rate_limiter.configure('bucket', {
        algorithm: 'token_bucket',
        bucket_size: 10,
        refill_rate: 1, // 1 token per second
      });

      // Use all 10 tokens
      for (let i = 0; i < 10; i++) {
        await rate_limiter.consume('bucket', 1);
      }

      // Next request should fail
      const result = await rate_limiter.check_limit('bucket');
      expect(result.allowed).toBe(false);

      // After 5 seconds, should have 5 tokens
      jest.advanceTimersByTime(5000);

      for (let i = 0; i < 5; i++) {
        const res = await rate_limiter.consume('bucket', 1);
        expect(res.success).toBe(true);
      }

      const failed = await rate_limiter.consume('bucket', 1);
      expect(failed.success).toBe(false);
    });

    it('should handle burst requests with token bucket', async () => {
      rate_limiter.configure('burst', {
        algorithm: 'token_bucket',
        bucket_size: 20,
        refill_rate: 5,
      });

      // Should allow burst of 20 requests
      const results = [];
      for (let i = 0; i < 20; i++) {
        results.push(await rate_limiter.consume('burst', 1));
      }

      expect(results.every((r) => r.success)).toBe(true);

      // 21st request should fail
      const result = await rate_limiter.consume('burst', 1);
      expect(result.success).toBe(false);
    });

    it('should support variable token consumption', async () => {
      rate_limiter.configure('weighted', {
        algorithm: 'token_bucket',
        bucket_size: 100,
        refill_rate: 10,
      });

      // Heavy operation consumes 50 tokens
      let result = await rate_limiter.consume('weighted', 50);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(50);

      // Another heavy operation
      result = await rate_limiter.consume('weighted', 50);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(0);

      // Should fail for any request now
      result = await rate_limiter.consume('weighted', 1);
      expect(result.success).toBe(false);
    });
  });

  describe('Exponential Backoff', () => {
    it('should implement exponential backoff on failures', async () => {
      const backoff = rate_limiter.create_backoff_handler({
        initial_delay: 1000,
        max_delay: 32000,
        multiplier: 2,
      });

      expect(backoff.get_delay(0)).toBe(1000);
      expect(backoff.get_delay(1)).toBe(2000);
      expect(backoff.get_delay(2)).toBe(4000);
      expect(backoff.get_delay(3)).toBe(8000);
      expect(backoff.get_delay(4)).toBe(16000);
      expect(backoff.get_delay(5)).toBe(32000);
      expect(backoff.get_delay(10)).toBe(32000); // Max delay
    });

    it('should add jitter to prevent thundering herd', async () => {
      const backoff = rate_limiter.create_backoff_handler({
        initial_delay: 1000,
        jitter: true,
      });

      const delays = new Set();
      for (let i = 0; i < 10; i++) {
        delays.add(backoff.get_delay_with_jitter(1));
      }

      // Should have different delays due to jitter
      expect(delays.size).toBeGreaterThan(1);

      // All delays should be within expected range
      const values = Array.from(delays);
      expect(Math.min(...values)).toBeGreaterThan(0);
      expect(Math.max(...values)).toBeLessThanOrEqual(2000);
    });

    it('should execute with automatic retry and backoff', async () => {
      jest.useRealTimers(); // Use real timers for this test

      const failing_function = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('Success');

      const result = await rate_limiter.execute_with_backoff(failing_function, {
        max_retries: 3,
        initial_delay: 10,
      });

      expect(result).toBe('Success');
      expect(failing_function).toHaveBeenCalledTimes(3);

      jest.useFakeTimers(); // Restore fake timers
    });

    it('should respect max retries', async () => {
      jest.useRealTimers(); // Use real timers for this test

      const always_failing = jest.fn().mockRejectedValue(new Error('Always fails'));

      await expect(
        rate_limiter.execute_with_backoff(always_failing, {
          max_retries: 2,
          initial_delay: 10,
        })
      ).rejects.toThrow('Always fails');

      expect(always_failing).toHaveBeenCalledTimes(3); // Initial + 2 retries

      jest.useFakeTimers(); // Restore fake timers
    });
  });

  describe('Platform-Specific Limits', () => {
    it('should handle GitHub rate limits with headers', async () => {
      const headers = {
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4999',
        'x-ratelimit-reset': Math.floor(Date.now() / 1000) + 3600,
      };

      rate_limiter.update_from_headers('github', headers);

      const status = rate_limiter.get_status('github');
      expect(status.remaining).toBe(4999);
      expect(status.limit).toBe(5000);
    });

    it('should handle GitLab rate limits', async () => {
      const headers = {
        'ratelimit-limit': '600',
        'ratelimit-remaining': '599',
        'ratelimit-reset': Math.floor(Date.now() / 1000) + 60,
      };

      rate_limiter.update_from_headers('gitlab', headers);

      const status = rate_limiter.get_status('gitlab');
      expect(status.remaining).toBe(599);
      expect(status.limit).toBe(600);
    });

    it('should handle Jira rate limits', async () => {
      const headers = {
        'x-ratelimit-limit': '1000',
        'x-ratelimit-remaining': '500',
        'retry-after': '30',
      };

      rate_limiter.update_from_headers('jira', headers);

      const status = rate_limiter.get_status('jira');
      expect(status.remaining).toBe(500);
      expect(status.retry_after).toBe(30);
    });

    it('should handle Slack rate limits with retry-after', async () => {
      const headers = {
        'retry-after': '10',
      };

      rate_limiter.update_from_headers('slack', headers);

      const result = await rate_limiter.check_limit('slack');
      expect(result.allowed).toBe(false);
      expect(result.retry_after).toBe(10);
    });
  });

  describe('Adaptive Rate Limiting', () => {
    it('should adapt rate limits based on response times', async () => {
      rate_limiter.enable_adaptive_limiting('service', {
        target_response_time: 100,
        min_rate: 10,
        max_rate: 100,
      });

      // Simulate slow responses
      for (let i = 0; i < 10; i++) {
        rate_limiter.record_response_time('service', 200);
      }

      const status = rate_limiter.get_adaptive_status('service');
      expect(status.current_rate).toBeLessThan(100);
    });

    it('should increase rate for fast responses', async () => {
      rate_limiter.enable_adaptive_limiting('fast-service', {
        target_response_time: 100,
        min_rate: 10,
        max_rate: 100,
      });

      // Simulate fast responses
      for (let i = 0; i < 10; i++) {
        rate_limiter.record_response_time('fast-service', 50);
      }

      const status = rate_limiter.get_adaptive_status('fast-service');
      expect(status.current_rate).toBeGreaterThan(10);
    });

    it('should detect rate limit pressure', async () => {
      rate_limiter.configure('pressure-test', {
        requests_per_minute: 10,
      });

      // Use up most of the limit
      for (let i = 0; i < 8; i++) {
        await rate_limiter.check_limit('pressure-test');
      }

      const pressure = rate_limiter.get_pressure('pressure-test');
      expect(pressure).toBeGreaterThan(0.7);
      expect(pressure).toBeLessThan(0.9);
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should open circuit after consecutive failures', async () => {
      rate_limiter.configure_circuit_breaker('flaky-service', {
        failure_threshold: 3,
        timeout: 5000,
        reset_timeout: 10000,
      });

      // Record failures
      rate_limiter.record_failure('flaky-service');
      rate_limiter.record_failure('flaky-service');
      rate_limiter.record_failure('flaky-service');

      const state = rate_limiter.get_circuit_state('flaky-service');
      expect(state).toBe('open');

      // Should reject requests immediately
      const result = await rate_limiter.check_circuit('flaky-service');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('circuit open');
    });

    it('should transition to half-open after timeout', async () => {
      rate_limiter.configure_circuit_breaker('recovering', {
        failure_threshold: 2,
        reset_timeout: 5000,
      });

      rate_limiter.record_failure('recovering');
      rate_limiter.record_failure('recovering');

      jest.advanceTimersByTime(5000);

      const state = rate_limiter.get_circuit_state('recovering');
      expect(state).toBe('half-open');
    });

    it('should close circuit after successful requests in half-open', async () => {
      rate_limiter.configure_circuit_breaker('healed', {
        failure_threshold: 2,
        reset_timeout: 1000,
        success_threshold: 2,
      });

      rate_limiter.record_failure('healed');
      rate_limiter.record_failure('healed');

      jest.advanceTimersByTime(1000);

      // Call get_circuit_state to trigger transition to half-open
      const halfOpenState = rate_limiter.get_circuit_state('healed');
      expect(halfOpenState).toBe('half-open');

      rate_limiter.record_success('healed');
      rate_limiter.record_success('healed');

      const state = rate_limiter.get_circuit_state('healed');
      expect(state).toBe('closed');
    });
  });

  describe('Concurrency Limiting', () => {
    it('should limit concurrent requests', async () => {
      rate_limiter.configure_concurrency('api', {
        max_concurrent: 3,
      });

      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(rate_limiter.acquire_slot('api'));
      }

      const results = await Promise.all(requests);
      const acquired = results.filter((r) => r.acquired).length;

      expect(acquired).toBe(3);
    });

    it('should release slots after request completion', async () => {
      rate_limiter.configure_concurrency('limited', {
        max_concurrent: 1,
      });

      const slot1 = await rate_limiter.acquire_slot('limited');
      expect(slot1.acquired).toBe(true);

      const slot2 = await rate_limiter.acquire_slot('limited');
      expect(slot2.acquired).toBe(false);

      rate_limiter.release_slot('limited', slot1.id);

      const slot3 = await rate_limiter.acquire_slot('limited');
      expect(slot3.acquired).toBe(true);
    });

    it('should queue requests when slots are full', async () => {
      rate_limiter.configure_concurrency('queued', {
        max_concurrent: 2,
        enable_queue: true,
        max_queue_size: 5,
      });

      const slot1 = await rate_limiter.acquire_slot('queued');
      const slot2 = await rate_limiter.acquire_slot('queued');

      const queued = rate_limiter.queue_request('queued');

      expect(rate_limiter.get_queue_size('queued')).toBe(1);

      rate_limiter.release_slot('queued', slot1.id);

      const result = await queued;
      expect(result.acquired).toBe(true);
    });
  });

  describe('Monitoring and Metrics', () => {
    it('should track rate limit usage', async () => {
      rate_limiter.configure('tracked', {
        requests_per_minute: 100,
      });

      for (let i = 0; i < 10; i++) {
        await rate_limiter.check_limit('tracked');
      }

      const metrics = rate_limiter.get_metrics('tracked');
      expect(metrics.requests).toBe(10);
      expect(metrics.allowed).toBe(10);
      expect(metrics.blocked).toBe(0);
      expect(metrics.usage_percentage).toBe(10);
    });

    it('should emit events for rate limit violations', async () => {
      const event_handler = jest.fn();
      rate_limiter.on('rate_limit_exceeded', event_handler);

      rate_limiter.configure('event-test', {
        requests_per_minute: 1,
      });

      await rate_limiter.check_limit('event-test');
      await rate_limiter.check_limit('event-test');

      expect(event_handler).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'event-test',
          limit: 1,
        })
      );
    });

    it('should provide rate limit forecasting', async () => {
      rate_limiter.configure('forecast', {
        requests_per_hour: 1000,
      });

      // Use 100 requests
      for (let i = 0; i < 100; i++) {
        await rate_limiter.check_limit('forecast');
      }

      const forecast = rate_limiter.forecast_exhaustion('forecast');
      expect(forecast.minutes_until_exhaustion).toBeGreaterThan(0);
      expect(forecast.requests_remaining).toBe(900);
    });

    it('should generate rate limit reports', () => {
      rate_limiter.configure('report-service', {
        requests_per_minute: 60,
      });

      for (let i = 0; i < 30; i++) {
        rate_limiter.check_limit('report-service');
      }

      const report = rate_limiter.generate_report();
      expect(report.services).toHaveProperty('report-service');
      expect(report.services['report-service'].usage).toBe(50);
    });
  });
});
