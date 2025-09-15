import { jest } from '@jest/globals'
import { EventBus } from '../../src/integrations/event-bus.js'

describe('EventBus', () => {
  let event_bus

  beforeEach(() => {
    event_bus = new EventBus()
    jest.clearAllMocks()
  })

  describe('Event Emission and Subscription', () => {
    it('should emit events to subscribers', () => {
      const handler = jest.fn()
      event_bus.on('test-event', handler)

      event_bus.emit('test-event', { data: 'test' })

      expect(handler).toHaveBeenCalledWith({ data: 'test' })
    })

    it('should support multiple subscribers for same event', () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()
      const handler3 = jest.fn()

      event_bus.on('multi-event', handler1)
      event_bus.on('multi-event', handler2)
      event_bus.on('multi-event', handler3)

      event_bus.emit('multi-event', { value: 42 })

      expect(handler1).toHaveBeenCalledWith({ value: 42 })
      expect(handler2).toHaveBeenCalledWith({ value: 42 })
      expect(handler3).toHaveBeenCalledWith({ value: 42 })
    })

    it('should support wildcard event subscriptions', () => {
      const wildcard_handler = jest.fn()
      event_bus.on('*', wildcard_handler)

      event_bus.emit('any-event', { test: true })
      event_bus.emit('another-event', { test: false })

      expect(wildcard_handler).toHaveBeenCalledTimes(2)
      expect(wildcard_handler).toHaveBeenCalledWith(
        'any-event',
        { test: true }
      )
      expect(wildcard_handler).toHaveBeenCalledWith(
        'another-event',
        { test: false }
      )
    })

    it('should support namespace pattern subscriptions', () => {
      const namespace_handler = jest.fn()
      event_bus.on('github:*', namespace_handler)

      event_bus.emit('github:issue:created', { id: 1 })
      event_bus.emit('github:pr:opened', { id: 2 })
      event_bus.emit('gitlab:issue:created', { id: 3 })

      expect(namespace_handler).toHaveBeenCalledTimes(2)
      expect(namespace_handler).not.toHaveBeenCalledWith(
        expect.anything(),
        { id: 3 }
      )
    })

    it('should handle one-time event subscriptions', () => {
      const once_handler = jest.fn()
      event_bus.once('once-event', once_handler)

      event_bus.emit('once-event', { first: true })
      event_bus.emit('once-event', { second: true })

      expect(once_handler).toHaveBeenCalledTimes(1)
      expect(once_handler).toHaveBeenCalledWith({ first: true })
    })

    it('should unsubscribe event handlers', () => {
      const handler = jest.fn()
      event_bus.on('unsub-event', handler)

      event_bus.emit('unsub-event', { call: 1 })
      event_bus.off('unsub-event', handler)
      event_bus.emit('unsub-event', { call: 2 })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({ call: 1 })
    })

    it('should remove all handlers for an event', () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      event_bus.on('clear-event', handler1)
      event_bus.on('clear-event', handler2)

      event_bus.remove_all_listeners('clear-event')
      event_bus.emit('clear-event', {})

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })
  })

  describe('Event Routing', () => {
    it('should route events between platforms', async () => {
      const route_handler = jest.fn().mockResolvedValue({ routed: true })
      event_bus.add_route('github:issue:created', 'jira:issue:create', route_handler)

      const result = await event_bus.route_event('github:issue:created', {
        issue: { id: 123, title: 'Test Issue' },
      })

      expect(route_handler).toHaveBeenCalledWith({
        issue: { id: 123, title: 'Test Issue' },
      })
      expect(result).toEqual({ routed: true })
    })

    it('should support multiple routes for same source event', async () => {
      const jira_handler = jest.fn().mockResolvedValue({ jira: true })
      const slack_handler = jest.fn().mockResolvedValue({ slack: true })

      event_bus.add_route('github:pr:merged', 'jira:issue:transition', jira_handler)
      event_bus.add_route('github:pr:merged', 'slack:notification', slack_handler)

      await event_bus.route_event('github:pr:merged', { pr_id: 456 })

      expect(jira_handler).toHaveBeenCalled()
      expect(slack_handler).toHaveBeenCalled()
    })

    it('should transform events during routing', async () => {
      const transformer = jest.fn().mockImplementation((data) => ({
        transformed: true,
        original: data,
      }))

      const handler = jest.fn()

      event_bus.add_route(
        'source:event',
        'target:event',
        handler,
        { transformer }
      )

      await event_bus.route_event('source:event', { value: 'test' })

      expect(transformer).toHaveBeenCalledWith({ value: 'test' })
      expect(handler).toHaveBeenCalledWith({
        transformed: true,
        original: { value: 'test' },
      })
    })

    it('should filter events during routing', async () => {
      const handler = jest.fn()
      const filter = (data) => data.priority === 'high'

      event_bus.add_route('source:event', 'target:event', handler, { filter })

      await event_bus.route_event('source:event', { priority: 'low' })
      await event_bus.route_event('source:event', { priority: 'high' })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({ priority: 'high' })
    })
  })

  describe('Event Queuing', () => {
    it('should queue events when paused', () => {
      const handler = jest.fn()
      event_bus.on('queued-event', handler)

      event_bus.pause()
      event_bus.emit('queued-event', { queued: true })

      expect(handler).not.toHaveBeenCalled()

      event_bus.resume()
      expect(handler).toHaveBeenCalledWith({ queued: true })
    })

    it('should process queued events in order', () => {
      const handler = jest.fn()
      event_bus.on('ordered-event', handler)

      event_bus.pause()
      event_bus.emit('ordered-event', { order: 1 })
      event_bus.emit('ordered-event', { order: 2 })
      event_bus.emit('ordered-event', { order: 3 })

      event_bus.resume()

      expect(handler).toHaveBeenNthCalledWith(1, { order: 1 })
      expect(handler).toHaveBeenNthCalledWith(2, { order: 2 })
      expect(handler).toHaveBeenNthCalledWith(3, { order: 3 })
    })

    it('should respect queue size limits', () => {
      event_bus.set_max_queue_size(2)
      event_bus.pause()

      event_bus.emit('event', { n: 1 })
      event_bus.emit('event', { n: 2 })
      expect(() => event_bus.emit('event', { n: 3 })).toThrow(
        'Event queue is full'
      )
    })

    it('should clear queue on demand', () => {
      const handler = jest.fn()
      event_bus.on('cleared-event', handler)

      event_bus.pause()
      event_bus.emit('cleared-event', { cleared: true })
      event_bus.clear_queue()
      event_bus.resume()

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('Event Priority', () => {
    it('should process high priority events first', () => {
      const handler = jest.fn()
      event_bus.on('priority-event', handler)

      event_bus.pause()
      event_bus.emit('priority-event', { id: 1, priority: 'low' })
      event_bus.emit('priority-event', { id: 2, priority: 'high' })
      event_bus.emit('priority-event', { id: 3, priority: 'medium' })

      event_bus.resume()

      expect(handler).toHaveBeenNthCalledWith(1, { id: 2, priority: 'high' })
      expect(handler).toHaveBeenNthCalledWith(2, { id: 3, priority: 'medium' })
      expect(handler).toHaveBeenNthCalledWith(3, { id: 1, priority: 'low' })
    })

    it('should support custom priority levels', () => {
      event_bus.set_priority_levels({
        critical: 100,
        high: 75,
        normal: 50,
        low: 25,
        background: 0,
      })

      const handler = jest.fn()
      event_bus.on('custom-priority', handler)

      event_bus.pause()
      event_bus.emit('custom-priority', { id: 1, priority: 'background' })
      event_bus.emit('custom-priority', { id: 2, priority: 'critical' })
      event_bus.emit('custom-priority', { id: 3, priority: 'normal' })

      event_bus.resume()

      expect(handler).toHaveBeenNthCalledWith(1, { id: 2, priority: 'critical' })
      expect(handler).toHaveBeenNthCalledWith(2, { id: 3, priority: 'normal' })
      expect(handler).toHaveBeenNthCalledWith(3, { id: 1, priority: 'background' })
    })
  })

  describe('Event Middleware', () => {
    it('should apply middleware to events', () => {
      const middleware = jest.fn().mockImplementation((event, next) => {
        event.data.middleware_applied = true
        next(event)
      })

      event_bus.use(middleware)

      const handler = jest.fn()
      event_bus.on('middleware-event', handler)

      event_bus.emit('middleware-event', { original: true })

      expect(middleware).toHaveBeenCalled()
      expect(handler).toHaveBeenCalledWith({
        original: true,
        middleware_applied: true,
      })
    })

    it('should chain multiple middleware', () => {
      const middleware1 = jest.fn().mockImplementation((event, next) => {
        event.data.step1 = true
        next(event)
      })

      const middleware2 = jest.fn().mockImplementation((event, next) => {
        event.data.step2 = true
        next(event)
      })

      event_bus.use(middleware1)
      event_bus.use(middleware2)

      const handler = jest.fn()
      event_bus.on('chained-event', handler)

      event_bus.emit('chained-event', {})

      expect(handler).toHaveBeenCalledWith({
        step1: true,
        step2: true,
      })
    })

    it('should allow middleware to stop propagation', () => {
      const blocking_middleware = jest.fn().mockImplementation((event, next) => {
        if (event.data.blocked) {
          return // Don't call next
        }
        next(event)
      })

      event_bus.use(blocking_middleware)

      const handler = jest.fn()
      event_bus.on('blocked-event', handler)

      event_bus.emit('blocked-event', { blocked: true })
      event_bus.emit('blocked-event', { blocked: false })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({ blocked: false })
    })
  })

  describe('Error Handling', () => {
    it('should handle errors in event handlers', () => {
      const error_handler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error')
      })
      const normal_handler = jest.fn()

      event_bus.on('error-event', error_handler)
      event_bus.on('error-event', normal_handler)

      const console_spy = jest.spyOn(console, 'error').mockImplementation()

      event_bus.emit('error-event', {})

      expect(console_spy).toHaveBeenCalledWith(
        expect.stringContaining('Error in event handler'),
        expect.any(Error)
      )
      expect(normal_handler).toHaveBeenCalled() // Other handlers should still run

      console_spy.mockRestore()
    })

    it('should emit error events', () => {
      const error_listener = jest.fn()
      event_bus.on('error', error_listener)

      const failing_handler = jest.fn().mockImplementation(() => {
        throw new Error('Test error')
      })

      event_bus.on('failing-event', failing_handler)
      event_bus.emit('failing-event', {})

      expect(error_listener).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          event: 'failing-event',
        })
      )
    })

    it('should handle async handler errors', async () => {
      const async_error_handler = jest.fn().mockRejectedValue(
        new Error('Async error')
      )

      event_bus.on('async-error', async_error_handler)

      const error_listener = jest.fn()
      event_bus.on('error', error_listener)

      await event_bus.emit_async('async-error', {})

      expect(error_listener).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          event: 'async-error',
        })
      )
    })
  })

  describe('Event History and Replay', () => {
    it('should record event history', () => {
      event_bus.enable_history(true)

      event_bus.emit('history-event-1', { data: 1 })
      event_bus.emit('history-event-2', { data: 2 })
      event_bus.emit('history-event-3', { data: 3 })

      const history = event_bus.get_history()

      expect(history).toHaveLength(3)
      expect(history[0]).toMatchObject({
        event: 'history-event-1',
        data: { data: 1 },
      })
    })

    it('should limit history size', () => {
      event_bus.enable_history(true, { max_size: 2 })

      event_bus.emit('event-1', {})
      event_bus.emit('event-2', {})
      event_bus.emit('event-3', {})

      const history = event_bus.get_history()

      expect(history).toHaveLength(2)
      expect(history[0].event).toBe('event-2')
      expect(history[1].event).toBe('event-3')
    })

    it('should replay event history', () => {
      event_bus.enable_history(true)

      event_bus.emit('replay-event-1', { id: 1 })
      event_bus.emit('replay-event-2', { id: 2 })

      const handler = jest.fn()
      event_bus.on('replay-event-1', handler)
      event_bus.on('replay-event-2', handler)

      event_bus.replay_history()

      expect(handler).toHaveBeenCalledTimes(2)
      expect(handler).toHaveBeenCalledWith({ id: 1 })
      expect(handler).toHaveBeenCalledWith({ id: 2 })
    })

    it('should filter events during replay', () => {
      event_bus.enable_history(true)

      event_bus.emit('include-event', { include: true })
      event_bus.emit('exclude-event', { include: false })

      const handler = jest.fn()
      event_bus.on('include-event', handler)
      event_bus.on('exclude-event', handler)

      event_bus.replay_history({
        filter: (event) => event.event === 'include-event',
      })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({ include: true })
    })
  })

  describe('Event Metrics', () => {
    it('should track event metrics', () => {
      event_bus.enable_metrics(true)

      event_bus.emit('metric-event', {})
      event_bus.emit('metric-event', {})
      event_bus.emit('another-metric', {})

      const metrics = event_bus.get_metrics()

      expect(metrics['metric-event'].count).toBe(2)
      expect(metrics['another-metric'].count).toBe(1)
    })

    it('should track handler execution time', async () => {
      event_bus.enable_metrics(true)

      const slow_handler = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      event_bus.on('timed-event', slow_handler)
      await event_bus.emit_async('timed-event', {})

      const metrics = event_bus.get_metrics()

      expect(metrics['timed-event'].total_time).toBeGreaterThan(40)
      expect(metrics['timed-event'].avg_time).toBeGreaterThan(40)
    })

    it('should track error rates', () => {
      event_bus.enable_metrics(true)

      const failing_handler = jest.fn()
        .mockImplementationOnce(() => { throw new Error('Fail') })
        .mockImplementationOnce(() => { /* success */ })

      event_bus.on('error-rate-event', failing_handler)

      event_bus.emit('error-rate-event', {})
      event_bus.emit('error-rate-event', {})

      const metrics = event_bus.get_metrics()

      expect(metrics['error-rate-event'].errors).toBe(1)
      expect(metrics['error-rate-event'].error_rate).toBe(0.5)
    })
  })
})