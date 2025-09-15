import { jest } from '@jest/globals';
import { IntegrationManager } from '../../src/integrations/integration-manager.js';
import { BaseIntegration } from '../../src/integrations/base-integration.js';
import { EventBus } from '../../src/integrations/event-bus.js';
import { CredentialManager } from '../../src/integrations/credential-manager.js';
import { RateLimiter } from '../../src/integrations/rate-limiter.js';
import path from 'path';
import { promises as fs } from 'fs';

describe('IntegrationManager', () => {
  let integration_manager;
  let mock_event_bus;
  let mock_credential_manager;

  beforeEach(() => {
    mock_event_bus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    };
    mock_credential_manager = {
      get_credentials: jest.fn(),
      save_credentials: jest.fn(),
      delete_credentials: jest.fn(),
      validate_credentials: jest.fn(),
    };

    integration_manager = new IntegrationManager({
      event_bus: mock_event_bus,
      credential_manager: mock_credential_manager,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Plugin Loading', () => {
    it('should load plugins from the integrations directory', async () => {
      const plugins_loaded = await integration_manager.load_plugins();
      expect(plugins_loaded).toBe(true);
      expect(integration_manager.get_loaded_plugins()).toBeInstanceOf(Array);
    });

    it('should validate plugin interface before loading', async () => {
      const invalid_plugin = { name: 'invalid' };
      const result = await integration_manager.load_plugin(invalid_plugin);
      expect(result).toBe(false);
    });

    it('should handle plugin loading errors gracefully', async () => {
      const malformed_plugin_path = '/non/existent/plugin.js';
      const result = await integration_manager.load_plugin_from_path(malformed_plugin_path);
      expect(result).toBe(false);
    });

    it('should maintain plugin registry with metadata', () => {
      const mock_plugin = {
        name: 'github',
        version: '1.0.0',
        platform: 'github',
        initialize: jest.fn(),
      };
      integration_manager.register_plugin(mock_plugin);
      const registry = integration_manager.get_plugin_registry();
      expect(registry['github']).toBeDefined();
      expect(registry['github'].version).toBe('1.0.0');
    });

    it('should support plugin hot-reloading', async () => {
      const mock_plugin = {
        name: 'gitlab',
        version: '1.0.0',
        platform: 'gitlab',
        initialize: jest.fn(),
        cleanup: jest.fn(),
      };
      integration_manager.register_plugin(mock_plugin);
      const result = await integration_manager.reload_plugin('gitlab');
      expect(result).toBe(true);
      expect(mock_plugin.cleanup).toHaveBeenCalled();
    });
  });

  describe('Plugin Lifecycle Management', () => {
    let mock_plugin;

    beforeEach(() => {
      mock_plugin = {
        name: 'test-plugin',
        platform: 'test',
        initialize: jest.fn().mockResolvedValue(true),
        cleanup: jest.fn().mockResolvedValue(true),
        connect: jest.fn().mockResolvedValue(true),
        disconnect: jest.fn().mockResolvedValue(true),
        get_status: jest.fn().mockReturnValue('connected'),
      };
    });

    it('should initialize plugins on startup', async () => {
      integration_manager.register_plugin(mock_plugin);
      await integration_manager.initialize_plugin('test-plugin');
      expect(mock_plugin.initialize).toHaveBeenCalled();
    });

    it('should cleanup plugins on shutdown', async () => {
      integration_manager.register_plugin(mock_plugin);
      await integration_manager.initialize_plugin('test-plugin');
      await integration_manager.shutdown();
      expect(mock_plugin.cleanup).toHaveBeenCalled();
    });

    it('should handle plugin connection lifecycle', async () => {
      integration_manager.register_plugin(mock_plugin);
      await integration_manager.connect_plugin('test-plugin');
      expect(mock_plugin.connect).toHaveBeenCalled();

      await integration_manager.disconnect_plugin('test-plugin');
      expect(mock_plugin.disconnect).toHaveBeenCalled();
    });

    it('should track plugin status', () => {
      integration_manager.register_plugin(mock_plugin);
      const status = integration_manager.get_plugin_status('test-plugin');
      expect(status).toBe('connected');
    });

    it('should emit lifecycle events', async () => {
      integration_manager.register_plugin(mock_plugin);
      await integration_manager.initialize_plugin('test-plugin');
      expect(mock_event_bus.emit).toHaveBeenCalledWith('plugin:initialized', {
        plugin: 'test-plugin',
        platform: 'test',
      });
    });
  });

  describe('Cross-Platform Communication', () => {
    it('should route events between plugins', async () => {
      const source_plugin = {
        name: 'github',
        platform: 'github',
        initialize: jest.fn(),
      };
      const target_plugin = {
        name: 'jira',
        platform: 'jira',
        initialize: jest.fn(),
        handle_event: jest.fn().mockResolvedValue(true),
      };

      integration_manager.register_plugin(source_plugin);
      integration_manager.register_plugin(target_plugin);

      const event = {
        source: 'github',
        target: 'jira',
        type: 'issue:created',
        data: { issue_id: 123 },
      };

      await integration_manager.route_event(event);
      expect(target_plugin.handle_event).toHaveBeenCalledWith(event);
    });

    it('should support event mapping between platforms', () => {
      const mapping = {
        'github:issue:created': 'jira:issue:create',
        'gitlab:merge_request:opened': 'github:pull_request:create',
      };
      integration_manager.set_event_mappings(mapping);

      const mapped_event = integration_manager.map_event('github:issue:created');
      expect(mapped_event).toBe('jira:issue:create');
    });

    it('should handle broadcast events to multiple plugins', async () => {
      const plugin1 = {
        name: 'slack',
        platform: 'slack',
        handle_event: jest.fn(),
      };
      const plugin2 = {
        name: 'discord',
        platform: 'discord',
        handle_event: jest.fn(),
      };

      integration_manager.register_plugin(plugin1);
      integration_manager.register_plugin(plugin2);

      await integration_manager.broadcast_event({
        type: 'notification',
        data: { message: 'Build completed' },
      });

      expect(plugin1.handle_event).toHaveBeenCalled();
      expect(plugin2.handle_event).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle plugin initialization failures', async () => {
      const failing_plugin = {
        name: 'failing',
        platform: 'test',
        initialize: jest.fn().mockRejectedValue(new Error('Init failed')),
      };

      integration_manager.register_plugin(failing_plugin);
      const result = await integration_manager.initialize_plugin('failing');
      expect(result).toBe(false);
      expect(integration_manager.get_plugin_status('failing')).toBe('failed');
    });

    it('should retry failed operations with exponential backoff', async () => {
      const retryable_plugin = {
        name: 'retryable',
        platform: 'test',
        connect: jest
          .fn()
          .mockRejectedValueOnce(new Error('Temporary failure'))
          .mockResolvedValueOnce(true),
      };

      integration_manager.register_plugin(retryable_plugin);
      const result = await integration_manager.connect_plugin('retryable', {
        retry: true,
        max_retries: 3,
      });

      expect(result).toBe(true);
      expect(retryable_plugin.connect).toHaveBeenCalledTimes(2);
    });

    it('should gracefully degrade when plugins are unavailable', async () => {
      const result = await integration_manager.execute_plugin_action('non-existent', 'some-action');
      expect(result).toEqual({
        success: false,
        error: 'Plugin not found: non-existent',
      });
    });

    it('should log errors with context', async () => {
      const console_spy = jest.spyOn(console, 'error').mockImplementation();

      const error_plugin = {
        name: 'error-plugin',
        platform: 'test',
        initialize: jest.fn().mockRejectedValue(new Error('Test error')),
      };

      integration_manager.register_plugin(error_plugin);
      await integration_manager.initialize_plugin('error-plugin');

      expect(console_spy).toHaveBeenCalledWith(
        expect.stringContaining('Plugin initialization failed'),
        expect.objectContaining({
          plugin: 'error-plugin',
          error: expect.any(Error),
        })
      );

      console_spy.mockRestore();
    });
  });

  describe('Configuration Management', () => {
    it('should load plugin configurations', async () => {
      const config = {
        github: {
          api_url: 'https://api.github.com',
          timeout: 5000,
        },
      };
      integration_manager.set_plugin_config('github', config.github);
      const loaded_config = integration_manager.get_plugin_config('github');
      expect(loaded_config).toEqual(config.github);
    });

    it('should validate plugin configurations', () => {
      const invalid_config = {
        timeout: 'not-a-number',
      };
      const is_valid = integration_manager.validate_plugin_config('github', invalid_config);
      expect(is_valid).toBe(false);
    });

    it('should merge default and custom configurations', () => {
      const defaults = {
        timeout: 3000,
        retry_count: 3,
      };
      const custom = {
        timeout: 5000,
      };
      integration_manager.set_plugin_defaults('github', defaults);
      integration_manager.set_plugin_config('github', custom);

      const merged = integration_manager.get_plugin_config('github');
      expect(merged).toEqual({
        timeout: 5000,
        retry_count: 3,
      });
    });
  });
});

describe('BaseIntegration', () => {
  let base_integration;

  beforeEach(() => {
    base_integration = new BaseIntegration({
      name: 'test-integration',
      platform: 'test',
      version: '1.0.0',
    });
  });

  describe('Interface Implementation', () => {
    it('should define required methods', () => {
      expect(base_integration.initialize).toBeDefined();
      expect(base_integration.connect).toBeDefined();
      expect(base_integration.disconnect).toBeDefined();
      expect(base_integration.cleanup).toBeDefined();
      expect(base_integration.handle_event).toBeDefined();
      expect(base_integration.get_status).toBeDefined();
    });

    it('should throw error for unimplemented abstract methods', async () => {
      await expect(base_integration.connect()).rejects.toThrow(
        'Method connect must be implemented'
      );
    });

    it('should provide base implementation for common functionality', () => {
      expect(base_integration.get_name()).toBe('test-integration');
      expect(base_integration.get_platform()).toBe('test');
      expect(base_integration.get_version()).toBe('1.0.0');
    });

    it('should maintain internal state', () => {
      base_integration.set_status('connected');
      expect(base_integration.get_status()).toBe('connected');

      base_integration.set_status('disconnected');
      expect(base_integration.get_status()).toBe('disconnected');
    });

    it('should handle configuration', () => {
      const config = {
        api_key: 'test-key',
        endpoint: 'https://api.test.com',
      };
      base_integration.set_config(config);
      expect(base_integration.get_config()).toEqual(config);
    });
  });

  describe('Event Handling', () => {
    it('should emit events', () => {
      const event_spy = jest.fn();
      base_integration.on('test-event', event_spy);

      base_integration.emit('test-event', { data: 'test' });
      expect(event_spy).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should handle event subscriptions', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      base_integration.on('event', handler1);
      base_integration.on('event', handler2);

      base_integration.emit('event', { test: true });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should support event unsubscription', () => {
      const handler = jest.fn();
      base_integration.on('event', handler);
      base_integration.off('event', handler);

      base_integration.emit('event', { test: true });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should validate configuration on set', () => {
      const invalid_config = null;
      expect(() => base_integration.set_config(invalid_config)).toThrow('Invalid configuration');
    });

    it('should handle errors in event handlers', () => {
      const error_handler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      const console_spy = jest.spyOn(console, 'error').mockImplementation();

      base_integration.on('event', error_handler);
      base_integration.emit('event', {});

      expect(console_spy).toHaveBeenCalledWith(
        expect.stringContaining('Error in event handler'),
        expect.any(Error)
      );

      console_spy.mockRestore();
    });
  });
});

describe('Plugin Architecture', () => {
  describe('Plugin Discovery', () => {
    it('should auto-discover plugins in integrations directory', async () => {
      const integration_manager = new IntegrationManager();
      const plugins = await integration_manager.discover_plugins(
        path.join(process.cwd(), 'src', 'integrations')
      );
      expect(plugins).toBeInstanceOf(Array);
    });

    it('should filter plugins by platform', () => {
      const integration_manager = new IntegrationManager();
      const mock_plugins = [
        { name: 'github', platform: 'github' },
        { name: 'gitlab', platform: 'gitlab' },
        { name: 'jira', platform: 'jira' },
      ];
      mock_plugins.forEach((p) => integration_manager.register_plugin(p));

      const github_plugins = integration_manager.get_plugins_by_platform('github');
      expect(github_plugins).toHaveLength(1);
      expect(github_plugins[0].name).toBe('github');
    });

    it('should support plugin dependencies', async () => {
      const integration_manager = new IntegrationManager();
      const dependent_plugin = {
        name: 'dependent',
        platform: 'test',
        dependencies: ['base-plugin'],
        initialize: jest.fn(),
      };
      const base_plugin = {
        name: 'base-plugin',
        platform: 'test',
        initialize: jest.fn(),
      };

      integration_manager.register_plugin(dependent_plugin);
      integration_manager.register_plugin(base_plugin);

      await integration_manager.initialize_all_plugins();

      expect(base_plugin.initialize).toHaveBeenCalled();
      expect(dependent_plugin.initialize).toHaveBeenCalled();
    });
  });

  describe('Plugin Isolation', () => {
    it('should isolate plugin errors', async () => {
      const integration_manager = new IntegrationManager();
      const failing_plugin = {
        name: 'failing',
        platform: 'test',
        initialize: jest.fn().mockRejectedValue(new Error('Plugin error')),
      };
      const working_plugin = {
        name: 'working',
        platform: 'test',
        initialize: jest.fn().mockResolvedValue(true),
      };

      integration_manager.register_plugin(failing_plugin);
      integration_manager.register_plugin(working_plugin);

      await integration_manager.initialize_all_plugins();

      expect(integration_manager.get_plugin_status('failing')).toBe('failed');
      expect(integration_manager.get_plugin_status('working')).toBe('initialized');
    });

    it('should provide plugin sandboxing', () => {
      const integration_manager = new IntegrationManager();
      const plugin1_context = integration_manager.create_plugin_context('plugin1');
      const plugin2_context = integration_manager.create_plugin_context('plugin2');

      expect(plugin1_context).not.toBe(plugin2_context);
      expect(plugin1_context.storage).not.toBe(plugin2_context.storage);
    });
  });

  describe('Plugin Communication', () => {
    it('should support inter-plugin messaging', async () => {
      const integration_manager = new IntegrationManager();
      const receiver_plugin = {
        name: 'receiver',
        platform: 'test',
        receive_message: jest.fn().mockResolvedValue({ status: 'received' }),
      };

      integration_manager.register_plugin(receiver_plugin);

      const result = await integration_manager.send_plugin_message('sender', 'receiver', {
        type: 'test',
        data: 'message',
      });

      expect(receiver_plugin.receive_message).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'sender',
          type: 'test',
          data: 'message',
        })
      );
      expect(result).toEqual({ status: 'received' });
    });

    it('should queue messages for offline plugins', async () => {
      const integration_manager = new IntegrationManager();
      const offline_plugin = {
        name: 'offline',
        platform: 'test',
        get_status: jest.fn().mockReturnValue('disconnected'),
      };

      integration_manager.register_plugin(offline_plugin);

      await integration_manager.send_plugin_message('sender', 'offline', { data: 'queued' });

      const queue = integration_manager.get_message_queue('offline');
      expect(queue).toHaveLength(1);
      expect(queue[0]).toMatchObject({ data: 'queued' });
    });
  });
});
